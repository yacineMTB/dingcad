"use client";

import { useTranslation } from "@/components/LocaleProvider";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSaved?: string | null;
}

/**
 * A pill-shaped save status indicator for the editor toolbar.
 *
 * States:
 * - saved:   muted checkmark + timestamp, unobtrusive
 * - saving:  amber spinner animation, visible but non-distracting
 * - unsaved: amber dot indicating pending changes
 * - error:   red exclamation, draws attention to failed saves
 */
export default function SaveStatusIndicator({
  status,
  lastSaved,
}: SaveStatusIndicatorProps) {
  const { t } = useTranslation();

  return (
    <div
      className="save-status-pill"
      data-status={status}
      role="status"
      aria-live="polite"
      aria-label={
        status === "error"
          ? t("saveStatus.error")
          : status === "saving"
            ? t("saveStatus.saving")
            : status === "unsaved"
              ? t("saveStatus.unsaved")
              : lastSaved
                ? `${t("saveStatus.saved")} ${lastSaved}`
                : t("saveStatus.saved")
      }
    >
      <span className="save-status-icon" data-status={status}>
        {status === "saved" && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {status === "saving" && (
          <svg
            className="save-status-spinner"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
        {status === "unsaved" && (
          <span className="save-status-dot" />
        )}
        {status === "error" && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </span>
      <span className="save-status-label">
        {status === "error"
          ? t("saveStatus.error")
          : status === "saving"
            ? t("saveStatus.saving")
            : status === "unsaved"
              ? t("saveStatus.unsaved")
              : lastSaved
                ? `${t("saveStatus.saved")} ${lastSaved}`
                : t("saveStatus.saved")}
      </span>
    </div>
  );
}
