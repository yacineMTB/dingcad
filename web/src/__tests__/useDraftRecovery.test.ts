import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraftRecovery } from "@/hooks/useDraftRecovery";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const PROJECT_ID = "proj-abc-123";
const DRAFT_KEY = `helscoop-draft-${PROJECT_ID}`;
const SAVED = "const height = 3; scene.add(box(1,1,height));";
const EDITED = "const height = 5; scene.add(box(1,1,height));";
const DRAFT_DEBOUNCE_MS = 2000;

// ---------------------------------------------------------------------------
// useDraftRecovery
// ---------------------------------------------------------------------------

describe("useDraftRecovery", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // ── mount behaviour ───────────────────────────────────────────────────────

  it("reports hasDraft=false when localStorage has no entry", () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );
    expect(result.current.hasDraft).toBe(false);
  });

  it("reports hasDraft=false when localStorage draft matches savedScript", () => {
    localStorage.setItem(DRAFT_KEY, SAVED);
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );
    expect(result.current.hasDraft).toBe(false);
  });

  it("reports hasDraft=true when localStorage has a draft that differs from savedScript", () => {
    localStorage.setItem(DRAFT_KEY, EDITED);
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );
    expect(result.current.hasDraft).toBe(true);
  });

  it("does nothing when projectId is null", () => {
    localStorage.setItem(DRAFT_KEY, EDITED);
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(null, SAVED, SAVED, onRestore)
    );
    expect(result.current.hasDraft).toBe(false);
  });

  // ── restore ───────────────────────────────────────────────────────────────

  it("restore() calls onRestore with the draft content and clears hasDraft", () => {
    localStorage.setItem(DRAFT_KEY, EDITED);
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );

    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.restore();
    });

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(EDITED);
    expect(result.current.hasDraft).toBe(false);
  });

  it("restore() does nothing when there is no draft", () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );

    act(() => {
      result.current.restore();
    });

    expect(onRestore).not.toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  // ── discard ───────────────────────────────────────────────────────────────

  it("discard() removes the draft from localStorage and clears hasDraft", () => {
    localStorage.setItem(DRAFT_KEY, EDITED);
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );

    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.discard();
    });

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  // ── clearDraft (post-save) ────────────────────────────────────────────────

  it("clearDraft() removes localStorage entry and clears hasDraft", () => {
    localStorage.setItem(DRAFT_KEY, EDITED);
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useDraftRecovery(PROJECT_ID, SAVED, SAVED, onRestore)
    );

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  // ── debounced write ───────────────────────────────────────────────────────

  it("writes to localStorage after the debounce delay when script differs from saved", async () => {
    const onRestore = vi.fn();

    // Start with matching script so initial check does not fire debounce
    const { rerender } = renderHook(
      ({ current, saved }) =>
        useDraftRecovery(PROJECT_ID, current, saved, onRestore),
      { initialProps: { current: SAVED, saved: SAVED } }
    );

    // Allow the initialCheckDoneRef tick to fire
    await act(async () => {
      vi.runAllTimers();
    });

    // Now simulate the user editing the script
    rerender({ current: EDITED, saved: SAVED });

    // Draft should NOT be written yet (debounce in progress)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    // Advance past the debounce threshold
    await act(async () => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 100);
    });

    expect(localStorage.getItem(DRAFT_KEY)).toBe(EDITED);
  });

  it("does NOT write to localStorage before the debounce delay expires", async () => {
    const onRestore = vi.fn();

    const { rerender } = renderHook(
      ({ current, saved }) =>
        useDraftRecovery(PROJECT_ID, current, saved, onRestore),
      { initialProps: { current: SAVED, saved: SAVED } }
    );

    await act(async () => {
      vi.runAllTimers();
    });

    rerender({ current: EDITED, saved: SAVED });

    // Advance only halfway through the debounce window
    await act(async () => {
      vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS / 2);
    });

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("clears localStorage immediately (no debounce) when currentScript reverts to savedScript", async () => {
    localStorage.setItem(DRAFT_KEY, EDITED);
    const onRestore = vi.fn();

    // Start with an edited script
    const { rerender } = renderHook(
      ({ current, saved }) =>
        useDraftRecovery(PROJECT_ID, current, saved, onRestore),
      { initialProps: { current: EDITED, saved: SAVED } }
    );

    await act(async () => {
      vi.runAllTimers();
    });

    // Simulate the user reverting to the saved version
    rerender({ current: SAVED, saved: SAVED });

    // The removal should happen synchronously (no timer advance needed)
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  // ── projectId change ──────────────────────────────────────────────────────

  it("re-checks localStorage when projectId changes", () => {
    const OTHER_PROJECT = "proj-other-999";
    const OTHER_KEY = `helscoop-draft-${OTHER_PROJECT}`;
    const OTHER_DRAFT = "const x = 42; scene.add(box(x,1,1));";

    localStorage.setItem(OTHER_KEY, OTHER_DRAFT);

    const onRestore = vi.fn();

    const { result, rerender } = renderHook(
      ({ id, saved }) =>
        useDraftRecovery(id, saved, saved, onRestore),
      { initialProps: { id: PROJECT_ID, saved: SAVED } }
    );

    // No draft for first project
    expect(result.current.hasDraft).toBe(false);

    // Switch to a project that has a stored draft
    rerender({ id: OTHER_PROJECT, saved: SAVED });

    expect(result.current.hasDraft).toBe(true);
  });
});
