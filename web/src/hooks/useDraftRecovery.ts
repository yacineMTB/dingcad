"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DRAFT_DEBOUNCE_MS = 2000;

function draftKey(projectId: string): string {
  return `helscoop-draft-${projectId}`;
}

interface DraftRecoveryState {
  /** True when a draft exists that differs from the saved version */
  hasDraft: boolean;
  /** Restore the draft into the editor */
  restore: () => void;
  /** Discard the draft from localStorage */
  discard: () => void;
}

/**
 * Persist unsaved scene script changes to localStorage.
 *
 * - Debounced write (~2s after last edit) on every script change
 * - On mount, checks for an existing draft that differs from the saved version
 * - Returns controls to restore or discard the draft
 * - Clears the draft on successful save (call `clearDraft` after save)
 */
export function useDraftRecovery(
  projectId: string | null,
  currentScript: string,
  savedScript: string,
  onRestore: (draft: string) => void,
): DraftRecoveryState & { clearDraft: () => void } {
  const [hasDraft, setHasDraft] = useState(false);
  const draftContentRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialCheckDoneRef = useRef(false);

  // Check for existing draft on mount (once per projectId)
  useEffect(() => {
    if (!projectId) return;
    initialCheckDoneRef.current = false;

    try {
      const stored = localStorage.getItem(draftKey(projectId));
      if (stored && stored !== savedScript) {
        draftContentRef.current = stored;
        setHasDraft(true);
      } else {
        draftContentRef.current = null;
        setHasDraft(false);
      }
    } catch {
      // localStorage may be unavailable (private browsing, quota, etc.)
    }

    // Mark initial check as done after a tick so the debounced save
    // doesn't fire on the initial script load.
    const t = setTimeout(() => {
      initialCheckDoneRef.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [projectId, savedScript]);

  // Debounced save to localStorage on every script change
  useEffect(() => {
    if (!projectId || !initialCheckDoneRef.current) return;

    // If the current script matches the saved version, clear the draft
    if (currentScript === savedScript) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      try {
        localStorage.removeItem(draftKey(projectId));
      } catch {
        // ignore
      }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(projectId), currentScript);
      } catch {
        // quota exceeded or unavailable — silently ignore
      }
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [projectId, currentScript, savedScript]);

  const restore = useCallback(() => {
    if (draftContentRef.current) {
      onRestore(draftContentRef.current);
    }
    draftContentRef.current = null;
    setHasDraft(false);
  }, [onRestore]);

  const discard = useCallback(() => {
    if (projectId) {
      try {
        localStorage.removeItem(draftKey(projectId));
      } catch {
        // ignore
      }
    }
    draftContentRef.current = null;
    setHasDraft(false);
  }, [projectId]);

  const clearDraft = useCallback(() => {
    if (projectId) {
      try {
        localStorage.removeItem(draftKey(projectId));
      } catch {
        // ignore
      }
    }
    draftContentRef.current = null;
    setHasDraft(false);
  }, [projectId]);

  return { hasDraft, restore, discard, clearDraft };
}
