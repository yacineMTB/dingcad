"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import type { KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";

/**
 * Detect whether the user is on macOS to show the correct modifier symbol.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = isMacPlatform();
  const parts: string[] = [];

  if (shortcut.mod) {
    parts.push(isMac ? "\u2318" : "Ctrl");
  }
  if (shortcut.shift) {
    parts.push(isMac ? "\u21E7" : "Shift");
  }

  // Prettify special key names
  const keyMap: Record<string, string> = {
    Enter: "\u23CE",
    Escape: "Esc",
    "/": "/",
    "?": "?",
  };
  parts.push(keyMap[shortcut.code] || shortcut.code.toUpperCase());

  return parts.join(isMac ? "" : "+");
}

export default function KeyboardShortcutsHelp({
  open,
  onClose,
  shortcuts,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Return all focusable elements within the dialog panel.
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!panelRef.current) return [];
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }, []);

  // Save previously focused element, auto-focus close button, restore on
  // unmount / close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape & focus trap
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, getFocusableElements]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.15s ease both",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--backdrop)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          background: "var(--surface-overlay, var(--bg-elevated))",
          backdropFilter: "blur(8px)",
          border: "1px solid var(--surface-border-overlay)",
          borderRadius: "var(--radius-lg)",
          padding: "28px 28px 24px",
          boxShadow: "var(--shadow-lg)",
          animation: "dialogSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            id="shortcuts-dialog-title"
            className="heading-display"
            style={{
              fontSize: 18,
              margin: 0,
              color: "var(--text-primary)",
            }}
          >
            {t("shortcuts.title")}
          </h2>
          <button
            ref={closeButtonRef}
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Shortcut rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.descriptionKey}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-tertiary)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                {t(shortcut.descriptionKey)}
              </span>
              <kbd
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 8px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  minWidth: 28,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {formatShortcut(shortcut)}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {t("shortcuts.escToClose")}
        </div>
      </div>
    </div>
  );
}
