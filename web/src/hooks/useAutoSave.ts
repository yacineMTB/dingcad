import { useCallback, useEffect, useRef } from "react";

/**
 * Fields that can be auto-saved. Each key maps to a saveable project field.
 */
export interface SaveableFields {
  name: string;
  description: string;
  scene_js: string;
  bom: { material_id: string; quantity: number; unit: string }[];
}

export interface AutoSaveCallbacks {
  /** Called with only the changed project fields (name, description, scene_js). */
  onSaveProject: (dirty: Partial<Pick<SaveableFields, "name" | "description" | "scene_js">>) => Promise<void>;
  /** Called when BOM has changed. */
  onSaveBom: (bom: SaveableFields["bom"]) => Promise<void>;
  /** Called when scene_js changed and save succeeded, to capture a new thumbnail. */
  onSaveThumbnail: () => Promise<void>;
  /** Called on save status transitions. */
  onStatusChange: (status: "saved" | "saving" | "unsaved") => void;
  /** Called on save success with the snapshot that was actually saved. */
  onSaveSuccess: (saved: SaveableFields) => void;
  /** Called on save failure. */
  onSaveError: (err: unknown) => void;
}

export interface AutoSaveOptions {
  /** Debounce delay in ms for discrete changes (param slider, BOM). Default: 2000. */
  debounceMs?: number;
  /** Debounce delay in ms during rapid-fire changes (typing). Default: 4000. */
  typingDebounceMs?: number;
  /** Threshold in ms: if two changes arrive within this window, use typingDebounceMs. Default: 800. */
  rapidFireThresholdMs?: number;
  /** Whether the initial data load is complete. Auto-save is suppressed until true. */
  initialLoadDone: boolean;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_TYPING_DEBOUNCE_MS = 4000;
const DEFAULT_RAPID_FIRE_THRESHOLD_MS = 800;

/**
 * Deeply compare two BOM arrays by material_id, quantity, unit.
 */
function bomEquals(
  a: SaveableFields["bom"],
  b: SaveableFields["bom"]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].material_id !== b[i].material_id ||
      a[i].quantity !== b[i].quantity ||
      a[i].unit !== b[i].unit
    ) {
      return false;
    }
  }
  return true;
}

/**
 * A hook that tracks dirty fields and debounces auto-save requests.
 *
 * Instead of saving the entire payload every 2 seconds, this hook:
 * - Diffs current values against the last-saved snapshot
 * - Only sends changed fields in the PUT
 * - Uses a longer debounce during rapid typing
 * - Captures thumbnails only when scene_js actually changed
 * - Flushes pending saves on unmount / beforeunload
 */
export function useAutoSave(
  fields: SaveableFields,
  callbacks: AutoSaveCallbacks,
  options: AutoSaveOptions
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    typingDebounceMs = DEFAULT_TYPING_DEBOUNCE_MS,
    rapidFireThresholdMs = DEFAULT_RAPID_FIRE_THRESHOLD_MS,
    initialLoadDone,
  } = options;

  // Snapshot of last-saved values
  const savedRef = useRef<SaveableFields>({ ...fields });
  // Current values ref (kept in sync) for use in flush callbacks
  const currentRef = useRef<SaveableFields>(fields);
  // Timer for debounced save
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp of last change event, for rapid-fire detection
  const lastChangeRef = useRef<number>(0);
  // Whether a save is currently in flight (to avoid overlapping saves)
  const savingRef = useRef(false);
  // Whether there are pending dirty changes that haven't been saved yet
  const dirtyRef = useRef(false);
  // Stable ref to callbacks to avoid re-creating closures
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // Keep currentRef in sync
  currentRef.current = fields;

  /**
   * Compute which fields have changed since the last saved snapshot.
   * Returns null if nothing changed.
   */
  const computeDirtyFields = useCallback(
    (current: SaveableFields, saved: SaveableFields) => {
      const projectDirty: Partial<Pick<SaveableFields, "name" | "description" | "scene_js">> = {};
      let hasProjectChanges = false;
      let sceneChanged = false;

      if (current.name !== saved.name) {
        projectDirty.name = current.name;
        hasProjectChanges = true;
      }
      if (current.description !== saved.description) {
        projectDirty.description = current.description;
        hasProjectChanges = true;
      }
      if (current.scene_js !== saved.scene_js) {
        projectDirty.scene_js = current.scene_js;
        hasProjectChanges = true;
        sceneChanged = true;
      }

      const bomChanged = !bomEquals(current.bom, saved.bom);

      return {
        projectDirty: hasProjectChanges ? projectDirty : null,
        bomChanged,
        sceneChanged,
        hasAnyChanges: hasProjectChanges || bomChanged,
      };
    },
    []
  );

  /**
   * Execute a save with only the dirty fields.
   */
  const doSave = useCallback(async () => {
    if (savingRef.current) return;

    const current = { ...currentRef.current };
    const saved = savedRef.current;
    const { projectDirty, bomChanged, sceneChanged, hasAnyChanges } =
      computeDirtyFields(current, saved);

    if (!hasAnyChanges) {
      cbRef.current.onStatusChange("saved");
      dirtyRef.current = false;
      return;
    }

    savingRef.current = true;
    cbRef.current.onStatusChange("saving");

    try {
      const promises: Promise<void>[] = [];

      if (projectDirty) {
        promises.push(cbRef.current.onSaveProject(projectDirty));
      }
      if (bomChanged) {
        promises.push(cbRef.current.onSaveBom(current.bom));
      }

      await Promise.all(promises);

      // Thumbnail only when scene_js changed and save succeeded
      if (sceneChanged) {
        // Fire-and-forget; don't block the save status
        cbRef.current.onSaveThumbnail().catch(() => {});
      }

      // Update saved snapshot
      savedRef.current = { ...current };
      dirtyRef.current = false;
      cbRef.current.onStatusChange("saved");
      cbRef.current.onSaveSuccess(current);
    } catch (err) {
      cbRef.current.onStatusChange("unsaved");
      cbRef.current.onSaveError(err);
    } finally {
      savingRef.current = false;
    }
  }, [computeDirtyFields]);

  /**
   * Schedule a debounced save. Uses a longer debounce window when changes
   * arrive in rapid succession (typing).
   */
  const scheduleAutoSave = useCallback(() => {
    if (!initialLoadDone) return;

    const now = Date.now();
    const timeSinceLastChange = now - lastChangeRef.current;
    lastChangeRef.current = now;

    dirtyRef.current = true;
    cbRef.current.onStatusChange("unsaved");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Use longer debounce if changes arrive rapidly (e.g. typing)
    const delay =
      timeSinceLastChange < rapidFireThresholdMs
        ? typingDebounceMs
        : debounceMs;

    timerRef.current = setTimeout(() => {
      doSave();
    }, delay);
  }, [initialLoadDone, debounceMs, typingDebounceMs, rapidFireThresholdMs, doSave]);

  /**
   * Force an immediate save (for Cmd+S, manual save button, etc.)
   */
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSave();
  }, [doSave]);

  /**
   * Synchronous flush for beforeunload. Uses sendBeacon-style approach
   * but since we can't easily do that with auth headers, we just fire
   * the async save and hope it lands.
   */
  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Best-effort flush — call doSave but can't await in beforeunload
    doSave();
  }, [doSave]);

  /**
   * Update the saved snapshot externally (e.g., after initial load).
   */
  const setSavedSnapshot = useCallback((snapshot: SaveableFields) => {
    savedRef.current = { ...snapshot };
  }, []);

  // React to field changes — schedule auto-save
  useEffect(() => {
    if (!initialLoadDone) return;
    // Compare against saved snapshot to decide if we need to schedule
    const { hasAnyChanges } = computeDirtyFields(fields, savedRef.current);
    if (hasAnyChanges) {
      scheduleAutoSave();
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    fields.name,
    fields.description,
    fields.scene_js,
    fields.bom,
    initialLoadDone,
    scheduleAutoSave,
    computeDirtyFields,
    // Note: we intentionally depend on the individual field values, not `fields` object identity
  ]);

  // beforeunload handler — flush on page leave
  useEffect(() => {
    const handler = () => {
      flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      // Also flush on unmount (component teardown / navigation)
      flush();
    };
  }, [flush]);

  return {
    /** Force an immediate save (e.g., Cmd+S). */
    saveNow,
    /** Update the saved snapshot (call after initial data load). */
    setSavedSnapshot,
    /** Whether there are pending unsaved changes. */
    isDirty: dirtyRef.current,
  };
}
