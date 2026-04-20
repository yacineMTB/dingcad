"use client";

import { useEffect, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info" | "warning" | "progress";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
  /** 0-100 for progress toasts, undefined for others */
  progress?: number;
  /** Optional action button (e.g. Undo) */
  action?: ToastAction;
  /** Duration in ms before auto-dismiss. 0 = manual dismiss only. Default 4000 */
  duration?: number;
  /** Group key for stacking similar toasts */
  group?: string;
  /** Count of grouped toasts (set internally) */
  groupCount?: number;
  /** Timestamp for ordering */
  createdAt: number;
}

const TYPE_STYLES: Record<ToastType, { bg: string; color: string; border: string; icon: string }> = {
  success: {
    bg: "var(--forest-dim)",
    color: "var(--forest)",
    border: "rgba(74, 124, 89, 0.25)",
    icon: "M20 6L9 17l-5-5",
  },
  error: {
    bg: "var(--danger-dim)",
    color: "var(--danger)",
    border: "rgba(199, 95, 95, 0.2)",
    icon: "M18 6L6 18M6 6l12 12",
  },
  info: {
    bg: "var(--amber-glow)",
    color: "var(--amber-light)",
    border: "var(--amber-border)",
    icon: "M12 2v10M12 16v2",
  },
  warning: {
    bg: "var(--warning-dim)",
    color: "var(--warning)",
    border: "var(--warning-border)",
    icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  },
  progress: {
    bg: "var(--amber-glow)",
    color: "var(--amber-light)",
    border: "var(--amber-border)",
    icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  },
};

/** Max visible toasts before showing overflow count */
const MAX_VISIBLE = 5;

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const grouped = groupToasts(toasts);
  const visible = grouped.slice(0, MAX_VISIBLE);
  const overflowCount = grouped.length - MAX_VISIBLE;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        pointerEvents: "none",
        maxHeight: "calc(100vh - 48px)",
      }}
    >
      {overflowCount > 0 && (
        <div
          style={{
            padding: "8px 16px",
            background: "var(--surface-float)",
            border: "1px solid var(--surface-border-float)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-muted)",
            fontSize: 12,
            fontFamily: "var(--font-body)",
            textAlign: "center",
            pointerEvents: "auto",
            backdropFilter: "blur(12px)",
          }}
        >
          +{overflowCount} more
        </div>
      )}
      {visible.map((t) =>
        t.type === "progress" ? (
          <ProgressToast key={t.id} toast={t} onDismiss={onDismiss} />
        ) : (
          <ToastMessage key={t.id} toast={t} onDismiss={onDismiss} />
        )
      )}
    </div>
  );
}

/** Group toasts with the same group key, keeping the latest */
function groupToasts(toasts: ToastItem[]): ToastItem[] {
  const groups = new Map<string, ToastItem[]>();
  const ungrouped: ToastItem[] = [];

  for (const t of toasts) {
    if (t.group) {
      const existing = groups.get(t.group) || [];
      existing.push(t);
      groups.set(t.group, existing);
    } else {
      ungrouped.push(t);
    }
  }

  const result: ToastItem[] = [...ungrouped];
  groups.forEach((items) => {
    const latest = items[items.length - 1];
    if (items.length > 1) {
      result.push({ ...latest, groupCount: items.length });
    } else {
      result.push(latest);
    }
  });

  return result.sort((a, b) => a.createdAt - b.createdAt);
}

function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const style = TYPE_STYLES[toast.type];
  const duration = toast.duration ?? 4000;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    if (duration > 0) {
      const timer = setTimeout(dismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, duration, dismiss]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 18px",
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "var(--radius-md)",
        color: style.color,
        fontSize: 13,
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        boxShadow: "var(--shadow-md)",
        backdropFilter: "blur(12px)",
        pointerEvents: "auto",
        cursor: "pointer",
        transform: visible && !exiting ? "translateX(0)" : "translateX(120%)",
        opacity: visible && !exiting ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
        maxWidth: 420,
      }}
      onClick={() => {
        if (!toast.action) dismiss();
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
        style={{ flexShrink: 0 }}
      >
        <path d={style.icon} />
      </svg>
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.groupCount && toast.groupCount > 1 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            background: style.border,
            borderRadius: "var(--radius-lg)",
            padding: "2px 7px",
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {toast.groupCount}
        </span>
      )}
      {toast.action && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.action!.onClick();
            dismiss();
          }}
          style={{
            background: "none",
            border: `1px solid ${style.border}`,
            borderRadius: "var(--radius-sm)",
            color: style.color,
            fontSize: 12,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            padding: "4px 10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = style.border;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = "none";
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        style={{
          background: "none",
          border: "none",
          color: style.color,
          opacity: 0.5,
          cursor: "pointer",
          padding: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "opacity 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "0.5";
        }}
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ProgressToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const progress = toast.progress ?? 0;
  const isComplete = progress >= 100;
  const style = isComplete ? TYPE_STYLES.success : TYPE_STYLES.progress;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(dismiss, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${toast.message} ${Math.round(progress)}%`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 18px",
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "var(--radius-md)",
        color: style.color,
        fontSize: 13,
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        boxShadow: "var(--shadow-md)",
        backdropFilter: "blur(12px)",
        pointerEvents: "auto",
        transform: visible && !exiting ? "translateX(0)" : "translateX(120%)",
        opacity: visible && !exiting ? 1 : 0,
        transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        maxWidth: 420,
        minWidth: 280,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isComplete ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d={TYPE_STYLES.success.icon} />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, animation: "toast-spin 1.5s linear infinite" }}
          >
            <path d={TYPE_STYLES.progress.icon} />
          </svg>
        )}
        <span style={{ flex: 1 }}>{toast.message}</span>
        <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(progress)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${toast.message} progress`}
        style={{
          height: 3,
          borderRadius: "2px",
          background: isComplete ? "rgba(74, 124, 89, 0.2)" : "rgba(229, 160, 75, 0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, Math.max(0, progress))}%`,
            borderRadius: "2px",
            background: isComplete ? "var(--forest)" : "var(--amber)",
            transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
