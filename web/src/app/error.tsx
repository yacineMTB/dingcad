"use client";

import { useState } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div className="anim-up" style={{ maxWidth: 420 }}>
        {/* Warning icon */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--amber)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 24 }}
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>

        <h1
          className="heading-display"
          style={{ fontSize: 24, marginBottom: 8 }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred. Please try again.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <button
            onClick={reset}
            className="btn btn-primary"
            style={{ padding: "12px 24px", fontSize: 14 }}
          >
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
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Try again
          </button>
          <Link
            href="/"
            className="btn btn-ghost"
            style={{
              padding: "12px 24px",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Back to dashboard
          </Link>
        </div>

        {/* Error details (development only) */}
        {process.env.NODE_ENV === "development" && error.message && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "var(--font-body)",
              }}
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
            {showDetails && (
              <pre
                style={{
                  marginTop: 12,
                  padding: "16px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  textAlign: "left",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "var(--danger)",
                  overflow: "auto",
                  maxHeight: 200,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Logo at bottom */}
      <div style={{ marginTop: 48 }}>
        <span
          className="heading-display"
          style={{ fontSize: 16, opacity: 0.4 }}
        >
          <span style={{ color: "var(--text-primary)" }}>Hel</span>
          <span style={{ color: "var(--amber)" }}>scoop</span>
        </span>
      </div>
    </div>
  );
}
