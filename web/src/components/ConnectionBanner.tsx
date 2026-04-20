"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ConnectionState = "connected" | "disconnected" | "reconnecting" | "reconnected";

/**
 * Saved once at module level so the wrapper can never stack.
 * Even if React strict-mode double-fires the effect, the guard
 * below ensures we only wrap `window.fetch` a single time.
 */
let nativeFetch: typeof window.fetch | null = null;

export default function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>("connected");
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const { t } = useTranslation();

  // Use a ref so the fetch wrapper always reads the latest state
  // without needing to be in the useEffect dependency array.
  const stateRef = useRef<ConnectionState>(state);
  stateRef.current = state;

  const checkConnection = useCallback(async () => {
    // Always call the real fetch for the health check, not the wrapper
    const fetchFn = nativeFetch ?? window.fetch;
    try {
      const res = await fetchFn.call(window, `${API_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        if (stateRef.current === "disconnected" || stateRef.current === "reconnecting") {
          setState("reconnected");
          retryCountRef.current = 0;
          // Auto-hide after 3 seconds
          setTimeout(() => setState("connected"), 3000);
        }
        return true;
      }
    } catch {
      // Network error
    }
    return false;
  }, []); // no deps -- reads stateRef

  const startRetrying = useCallback(() => {
    setState("reconnecting");

    const retry = async () => {
      const connected = await checkConnection();
      if (!connected) {
        retryCountRef.current++;
        // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000);
        retryTimeoutRef.current = setTimeout(retry, delay);
      }
    };

    retry();
  }, [checkConnection]);

  const handleRetryNow = useCallback(() => {
    // Cancel any pending retry timer and check immediately
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    setState("reconnecting");
    checkConnection().then((ok) => {
      if (!ok) {
        startRetrying();
      }
    });
  }, [checkConnection, startRetrying]);

  useEffect(() => {
    // Save the native fetch exactly once and install the wrapper once.
    if (nativeFetch === null) {
      nativeFetch = window.fetch;

      const wrappedFetch: typeof window.fetch = async (...args) => {
        try {
          // Always delegate to the original native fetch
          const response = await nativeFetch!.apply(window, args);
          return response;
        } catch (error) {
          // Only trigger disconnect for API calls
          const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
          if (url.startsWith(API_URL)) {
            if (stateRef.current === "connected") {
              setState("disconnected");
              // Inline start-retrying to avoid stale closure over startRetrying
              retryCountRef.current = 0;
              setState("reconnecting");

              const retry = async () => {
                const fetchFn = nativeFetch ?? window.fetch;
                let ok = false;
                try {
                  const res = await fetchFn.call(window, `${API_URL}/health`, {
                    method: "GET",
                    signal: AbortSignal.timeout(5000),
                  });
                  ok = res.ok;
                } catch {
                  // still offline
                }
                if (ok) {
                  setState("reconnected");
                  retryCountRef.current = 0;
                  setTimeout(() => setState("connected"), 3000);
                } else {
                  retryCountRef.current++;
                  const delay = Math.min(2000 * Math.pow(2, retryCountRef.current - 1), 30000);
                  retryTimeoutRef.current = setTimeout(retry, delay);
                }
              };
              retry();
            }
          }
          throw error;
        }
      };

      window.fetch = wrappedFetch;
    }

    // Cleanup: restore native fetch and cancel pending retries
    return () => {
      if (nativeFetch !== null) {
        window.fetch = nativeFetch;
        nativeFetch = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []); // runs once on mount, cleans up on unmount

  if (state === "connected") return null;

  const isReconnected = state === "reconnected";

  return (
    <div
      className="anim-up"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "8px 16px",
        background: isReconnected ? "var(--forest)" : "var(--amber)",
        color: isReconnected ? "var(--text-primary)" : "var(--bg-primary)",
        fontSize: 13,
        fontWeight: 500,
        textAlign: "center",
        fontFamily: "var(--font-body)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "background 0.3s ease",
      }}
    >
      {!isReconnected && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: "breathe 1.5s ease-in-out infinite",
          }}
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      )}
      {isReconnected && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {isReconnected
        ? t("errors.reconnected")
        : t("errors.connectionLost")}
      {!isReconnected && (
        <button
          onClick={handleRetryNow}
          style={{
            marginLeft: 8,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "var(--font-body)",
            background: "var(--bg-primary)",
            color: "var(--amber)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {t("errors.retryNow")}
        </button>
      )}
    </div>
  );
}
