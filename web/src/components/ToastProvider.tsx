"use client";

import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from "react";
import { ToastContainer, type ToastItem, type ToastType, type ToastAction } from "./Toast";

export interface ToastOptions {
  /** Duration in ms before auto-dismiss. 0 = manual only. Default 4000 */
  duration?: number;
  /** Action button (e.g. { label: "Undo", onClick: () => ... }) */
  action?: ToastAction;
  /** Group key — toasts with the same key stack into one with a count badge */
  group?: string;
}

interface ToastContextValue {
  /** Show a toast notification. Backward-compatible: toast("msg") or toast("msg", "success") */
  toast: (message: string, type?: ToastType, options?: ToastOptions) => number;
  /** Show a progress toast. Returns an id for updating. */
  toastProgress: (message: string, progress?: number) => number;
  /** Update progress on an existing progress toast (0-100). Set to 100 to auto-complete. */
  updateProgress: (id: number, progress: number, message?: string) => void;
  /** Dismiss a specific toast by id */
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const toast = useCallback((message: string, type: ToastType = "info", options?: ToastOptions): number => {
    const id = nextId++;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        createdAt: Date.now(),
        duration: options?.duration,
        action: options?.action,
        group: options?.group,
      },
    ]);
    return id;
  }, []);

  const toastProgress = useCallback((message: string, progress: number = 0): number => {
    const id = nextId++;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type: "progress" as ToastType,
        progress,
        duration: 0, // no auto-dismiss for progress toasts
        createdAt: Date.now(),
      },
    ]);
    return id;
  }, []);

  const updateProgress = useCallback((id: number, progress: number, message?: string) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, progress: Math.min(100, Math.max(0, progress)), ...(message ? { message } : {}) }
          : t
      )
    );
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, toastProgress, updateProgress, dismissToast: dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
