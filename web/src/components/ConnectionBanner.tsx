"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@/components/LocaleProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ConnectionState = "connected" | "disconnected" | "reconnecting" | "reconnected";

export default function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>("connected");
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const { t } = useTranslation();

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        if (state === "disconnected" || state === "reconnecting") {
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
  }, [state]);

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

  useEffect(() => {
    // Listen for fetch errors globally by overriding fetch
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        return response;
      } catch (error) {
        // Only trigger for API calls
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
        if (url.startsWith(API_URL)) {
          if (state === "connected") {
            setState("disconnected");
            startRetrying();
          }
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [state, startRetrying]);

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
    </div>
  );
}
