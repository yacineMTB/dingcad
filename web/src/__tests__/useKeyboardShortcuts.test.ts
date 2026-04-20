import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from "@/hooks/useKeyboardShortcuts";

function fireKey(
  key: string,
  opts: Partial<KeyboardEventInit> = {},
  target?: HTMLElement
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  (target || window).dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  it("fires action for a simple key match", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "?", code: "?", action, descriptionKey: "help" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("?");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("fires action for Ctrl/Meta + key combination", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "Cmd+S", code: "s", mod: true, action, descriptionKey: "save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // With metaKey (Mac)
    fireKey("s", { metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);

    // With ctrlKey (Windows/Linux)
    fireKey("s", { ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("does NOT fire mod shortcut when no modifier is pressed", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "Cmd+S", code: "s", mod: true, action, descriptionKey: "save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("s");
    expect(action).not.toHaveBeenCalled();
  });

  it("does NOT fire non-mod shortcut when a modifier is pressed", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "?", code: "?", action, descriptionKey: "help" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("?", { metaKey: true });
    expect(action).not.toHaveBeenCalled();
  });

  it("fires Shift+Mod shortcut correctly", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: "Cmd+Shift+Z",
        code: "Z",
        mod: true,
        shift: true,
        action,
        descriptionKey: "redo",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("Z", { metaKey: true, shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire Shift+Mod shortcut without Shift", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      {
        key: "Cmd+Shift+Z",
        code: "Z",
        mod: true,
        shift: true,
        action,
        descriptionKey: "redo",
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("Z", { metaKey: true }); // no shift
    expect(action).not.toHaveBeenCalled();
  });

  it("skips non-modifier shortcuts when typing in an input", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "?", code: "?", action, descriptionKey: "help" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Simulate typing in an input field
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireKey("?", {}, input);

    expect(action).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("allows Escape shortcut even when input is focused", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "Esc", code: "Escape", action, descriptionKey: "close" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireKey("Escape", {}, input);
    expect(action).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it("allows modifier shortcuts when typing in an input", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "Cmd+S", code: "s", mod: true, action, descriptionKey: "save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    fireKey("s", { metaKey: true }, textarea);
    expect(action).toHaveBeenCalledTimes(1);
    document.body.removeChild(textarea);
  });

  it("matches only the first matching shortcut", () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "?", code: "?", action: action1, descriptionKey: "help1" },
      { key: "?", code: "?", action: action2, descriptionKey: "help2" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey("?");
    expect(action1).toHaveBeenCalledTimes(1);
    expect(action2).not.toHaveBeenCalled();
  });

  it("cleans up event listener on unmount", () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: "?", code: "?", action, descriptionKey: "help" },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    unmount();

    fireKey("?");
    expect(action).not.toHaveBeenCalled();
  });
});
