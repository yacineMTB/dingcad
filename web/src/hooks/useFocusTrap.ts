"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Trap keyboard focus within a container element while a dialog is open.
 *
 * - On mount, saves the previously-focused element and focuses the first
 *   focusable child inside the container.
 * - Tab / Shift+Tab cycle within the container's focusable elements.
 * - Escape calls `onClose` and restores focus to the previously-focused element.
 * - On unmount, restores focus to the previously-focused element.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    // Save the element that had focus before the dialog opened
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the container
    const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      // If no focusable children, focus the container itself
      container.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);

      // Restore focus to the previously-focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [open, containerRef, onClose]);
}
