"use client";

/**
 * Privacy-first analytics hook using Plausible Analytics.
 *
 * Plausible is GDPR-compliant by design: no cookies, no personal data,
 * no consent banner required. All events are anonymous.
 *
 * The hook provides a thin `track()` wrapper so we can swap providers
 * later without touching every component.
 */

import { useCallback, useEffect, useRef } from "react";

// ── Event name literals ────────────────────────────────────────────
export type AnalyticsEvent =
  | "address_search"
  | "project_created"
  | "editor_session"
  | "bom_item_added"
  | "bom_item_removed"
  | "bom_item_undo_remove"
  | "bom_exported"
  | "project_exported"
  | "project_imported"
  | "chat_message_sent"
  | "chat_code_applied"
  | "auth_register"
  | "auth_login"
  | "page_view";

// ── Property maps per event ────────────────────────────────────────
export interface AnalyticsEventProps {
  address_search: { query_length: number; had_result: boolean };
  project_created: { source: "address" | "template" | "blank"; building_type?: string };
  editor_session: { duration_s: number; used_code_editor: boolean; used_chat: boolean };
  bom_item_added: { material_id: string; category?: string };
  bom_item_removed: { material_id: string };
  bom_item_undo_remove: { material_id: string };
  bom_exported: { format: "pdf" | "csv" | "json" };
  project_exported: { format: "helscoop" };
  project_imported: { format: "helscoop" };
  chat_message_sent: { suggestion_used: boolean };
  chat_code_applied: Record<string, never>;
  auth_register: Record<string, never>;
  auth_login: Record<string, never>;
  page_view: { path: string };
}

// ── Plausible global type (injected by their <script>) ─────────────
declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

// ── The domain we report to — matches the Plausible site ID ────────
const PLAUSIBLE_DOMAIN = "helscoop.fi";

/**
 * Whether analytics is enabled.
 * Disabled during SSR, in dev (localhost), and when Plausible hasn't loaded.
 * We still accept `track()` calls gracefully (they become no-ops).
 */
function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  // Disable in dev / localhost
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return false;
  }
  return typeof window.plausible === "function";
}

/**
 * Low-level fire-and-forget event dispatch.
 */
function sendEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
) {
  if (!isEnabled()) {
    // In dev, log to console for debugging
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    ) {
      // eslint-disable-next-line no-console
      console.debug(`[analytics] ${name}`, props ?? "");
    }
    return;
  }
  window.plausible!(name, props ? { props } : undefined);
}

// ── Public hook ────────────────────────────────────────────────────

export function useAnalytics() {
  /**
   * Track a typed analytics event.
   *
   * Usage:
   *   const { track } = useAnalytics();
   *   track("address_search", { query_length: 12, had_result: true });
   */
  const track = useCallback(
    <E extends AnalyticsEvent>(
      event: E,
      props: AnalyticsEventProps[E],
    ) => {
      sendEvent(event, props as Record<string, string | number | boolean>);
    },
    [],
  );

  return { track };
}

/**
 * Hook to track editor session duration.
 * Call once per editor mount; it fires `editor_session` on unmount
 * with the elapsed seconds.
 */
export function useEditorSession() {
  const startRef = useRef(Date.now());
  const usedCodeRef = useRef(false);
  const usedChatRef = useRef(false);

  const markCodeEditor = useCallback(() => {
    usedCodeRef.current = true;
  }, []);

  const markChat = useCallback(() => {
    usedChatRef.current = true;
  }, []);

  useEffect(() => {
    const start = startRef.current;
    return () => {
      const duration_s = Math.round((Date.now() - start) / 1000);
      if (duration_s < 2) return; // skip bounces
      sendEvent("editor_session", {
        duration_s,
        used_code_editor: usedCodeRef.current,
        used_chat: usedChatRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { markCodeEditor, markChat };
}

// Re-export domain for the script tag
export { PLAUSIBLE_DOMAIN };
