"use client";

import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  /** Human-readable key combo, e.g. "Cmd+S" */
  key: string;
  /** Whether the shortcut requires metaKey (Mac) or ctrlKey (other) */
  mod?: boolean;
  /** Whether Shift must also be held */
  shift?: boolean;
  /** The actual key value to match (e.g. "s", "Enter", "Escape", "/", "?") */
  code: string;
  /** Action to execute */
  action: () => void;
  /** i18n key for description shown in help overlay */
  descriptionKey: string;
}

/**
 * Register global keyboard shortcuts on the window.
 *
 * Shortcuts that overlap browser defaults (e.g. Cmd+S) have their
 * default behaviour suppressed via `preventDefault()`.
 *
 * The hook is safe to call with a changing list of shortcuts --
 * it re-registers whenever the array reference changes.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when a text input/textarea is focused,
      // unless the shortcut requires a modifier key.
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const isMod = e.metaKey || e.ctrlKey;

        // Check modifier requirement
        if (shortcut.mod && !isMod) continue;
        if (!shortcut.mod && isMod) continue;

        // Check shift requirement
        if (shortcut.shift && !e.shiftKey) continue;
        if (!shortcut.shift && e.shiftKey && shortcut.mod) continue;

        // Match the key
        if (e.key !== shortcut.code) continue;

        // Skip non-modifier shortcuts when typing in inputs
        if (isInput && !shortcut.mod && shortcut.code !== "Escape") continue;

        e.preventDefault();
        shortcut.action();
        return;
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
