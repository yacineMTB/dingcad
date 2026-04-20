import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { SaveableFields, AutoSaveCallbacks } from "@/hooks/useAutoSave";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeFields(overrides: Partial<SaveableFields> = {}): SaveableFields {
  return {
    name: "Test Project",
    description: "A description",
    scene_js: "scene.add(box(1,1,1));",
    bom: [{ material_id: "mat-1", quantity: 10, unit: "kpl" }],
    ...overrides,
  };
}

function makeCallbacks(overrides: Partial<AutoSaveCallbacks> = {}): AutoSaveCallbacks {
  return {
    onSaveProject: vi.fn().mockResolvedValue(undefined),
    onSaveBom: vi.fn().mockResolvedValue(undefined),
    onSaveThumbnail: vi.fn().mockResolvedValue(undefined),
    onStatusChange: vi.fn(),
    onSaveSuccess: vi.fn(),
    onSaveError: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── basic debounce ────────────────────────────────────────────────────────

  it("does not save before initialLoadDone is true", async () => {
    const fields = makeFields();
    const callbacks = makeCallbacks();

    renderHook(() =>
      useAutoSave(fields, callbacks, { initialLoadDone: false })
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(callbacks.onSaveProject).not.toHaveBeenCalled();
    expect(callbacks.onSaveBom).not.toHaveBeenCalled();
  });

  it("does not save when fields have not changed from initial snapshot", async () => {
    const fields = makeFields();
    const callbacks = makeCallbacks();

    renderHook(() =>
      useAutoSave(fields, callbacks, { initialLoadDone: true })
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(callbacks.onSaveProject).not.toHaveBeenCalled();
    expect(callbacks.onSaveBom).not.toHaveBeenCalled();
  });

  it("saves only the changed project field after debounce", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    // Simulate user changing only the name
    const updated = makeFields({ name: "New Name" });
    rerender({ fields: updated });

    // Not saved yet (within debounce window)
    expect(callbacks.onSaveProject).not.toHaveBeenCalled();

    // Advance past the default 2s debounce
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveProject).toHaveBeenCalledTimes(1);
    expect(callbacks.onSaveProject).toHaveBeenCalledWith({ name: "New Name" });
    // BOM didn't change, so no BOM save
    expect(callbacks.onSaveBom).not.toHaveBeenCalled();
  });

  it("does not send scene_js when only name changed", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    rerender({ fields: makeFields({ name: "Different Name" }) });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    const callArg = (callbacks.onSaveProject as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg).toEqual({ name: "Different Name" });
    expect(callArg).not.toHaveProperty("scene_js");
    expect(callArg).not.toHaveProperty("description");
  });

  it("sends only scene_js when only scene_js changed", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    rerender({ fields: makeFields({ scene_js: "scene.add(sphere(2));" }) });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveProject).toHaveBeenCalledWith({
      scene_js: "scene.add(sphere(2));",
    });
  });

  // ── BOM diffing ───────────────────────────────────────────────────────────

  it("saves BOM when BOM items change", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    const newBom = [
      { material_id: "mat-1", quantity: 20, unit: "kpl" },
    ];
    rerender({ fields: makeFields({ bom: newBom }) });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveBom).toHaveBeenCalledTimes(1);
    expect(callbacks.onSaveBom).toHaveBeenCalledWith(newBom);
    // Project fields didn't change
    expect(callbacks.onSaveProject).not.toHaveBeenCalled();
  });

  it("does not save BOM when BOM items are identical", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    // Change name but BOM stays the same
    rerender({
      fields: makeFields({
        name: "Renamed",
        bom: [{ material_id: "mat-1", quantity: 10, unit: "kpl" }],
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveBom).not.toHaveBeenCalled();
    expect(callbacks.onSaveProject).toHaveBeenCalledWith({ name: "Renamed" });
  });

  // ── thumbnail throttling ─────────────────────────────────────────────────

  it("captures thumbnail only when scene_js changed", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    // Only change name (not scene_js)
    rerender({ fields: makeFields({ name: "No Scene Change" }) });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveThumbnail).not.toHaveBeenCalled();

    // Now change scene_js
    rerender({ fields: makeFields({ name: "No Scene Change", scene_js: "scene.add(cylinder(1,3));" }) });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveThumbnail).toHaveBeenCalledTimes(1);
  });

  // ── rapid-fire / typing debounce ──────────────────────────────────────────

  it("uses longer debounce when changes arrive rapidly", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) =>
        useAutoSave(fields, callbacks, {
          initialLoadDone: true,
          debounceMs: 2000,
          typingDebounceMs: 4000,
          rapidFireThresholdMs: 800,
        }),
      { initialProps: { fields: initial } }
    );

    // Simulate rapid typing: changes 500ms apart
    rerender({ fields: makeFields({ scene_js: "a" }) });
    await act(async () => { vi.advanceTimersByTime(500); });

    rerender({ fields: makeFields({ scene_js: "ab" }) });
    await act(async () => { vi.advanceTimersByTime(500); });

    rerender({ fields: makeFields({ scene_js: "abc" }) });

    // After 2100ms total from last change, the 4s typing debounce should NOT have fired
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(callbacks.onSaveProject).not.toHaveBeenCalled();

    // After 4100ms from last change, it should fire
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(callbacks.onSaveProject).toHaveBeenCalledTimes(1);
  });

  // ── manual save (saveNow) ────────────────────────────────────────────────

  it("saveNow triggers an immediate save", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { result, rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    rerender({ fields: makeFields({ name: "Manual Save" }) });

    // Save immediately without waiting for debounce
    await act(async () => {
      await result.current.saveNow();
    });

    expect(callbacks.onSaveProject).toHaveBeenCalledWith({ name: "Manual Save" });
  });

  // ── error handling ────────────────────────────────────────────────────────

  it("calls onSaveError and sets status to unsaved on failure", async () => {
    const initial = makeFields();
    const error = new Error("Network error");
    const callbacks = makeCallbacks({
      onSaveProject: vi.fn().mockRejectedValue(error),
    });

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    rerender({ fields: makeFields({ name: "Will Fail" }) });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveError).toHaveBeenCalledWith(error);
    // Status transitions: unsaved -> saving -> unsaved (on error)
    const statusCalls = (callbacks.onStatusChange as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0]
    );
    expect(statusCalls).toContain("saving");
    expect(statusCalls[statusCalls.length - 1]).toBe("unsaved");
  });

  // ── onSaveSuccess receives the saved snapshot ─────────────────────────────

  it("onSaveSuccess receives the saved snapshot values", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    const updatedFields = makeFields({ name: "Saved Name", scene_js: "new code;" });
    rerender({ fields: updatedFields });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveSuccess).toHaveBeenCalledTimes(1);
    const savedSnapshot = (callbacks.onSaveSuccess as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedSnapshot.name).toBe("Saved Name");
    expect(savedSnapshot.scene_js).toBe("new code;");
  });

  // ── no duplicate saves after snapshot updated ────────────────────────────

  it("does not re-save after a successful save when fields haven't changed again", async () => {
    const initial = makeFields();
    const callbacks = makeCallbacks();

    const { rerender } = renderHook(
      ({ fields }) => useAutoSave(fields, callbacks, { initialLoadDone: true }),
      { initialProps: { fields: initial } }
    );

    const updated = makeFields({ name: "Changed Once" });
    rerender({ fields: updated });

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(callbacks.onSaveProject).toHaveBeenCalledTimes(1);

    // Re-render with the same fields (no new changes)
    rerender({ fields: updated });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should still only have been called once
    expect(callbacks.onSaveProject).toHaveBeenCalledTimes(1);
  });
});
