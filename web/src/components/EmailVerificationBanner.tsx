"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  emailVerified: boolean;
}

export default function EmailVerificationBanner({ emailVerified }: Props) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (emailVerified || dismissed) return null;

  async function handleResend() {
    setResending(true);
    try {
      await api.resendVerification();
      setResent(true);
    } catch {
      // Silently fail — user can try again
    }
    setResending(false);
  }

  return (
    <div style={{
      background: "var(--amber-glow, rgba(196,145,92,0.08))",
      border: "1px solid var(--amber-border, rgba(196,145,92,0.2))",
      borderRadius: "var(--radius-sm, 6px)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      fontSize: 13,
      color: "var(--text-primary)",
      marginBottom: 16,
    }}>
      <span>
        Vahvista sahkopostiosoitteesi. Tarkista postilaatikkosi.
        {" / "}
        Please verify your email. Check your inbox.
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {resent ? (
          <span style={{ color: "var(--success, #4ade80)", fontSize: 12 }}>
            Lahetetty! / Sent!
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 12px" }}
          >
            {resending ? <span className="btn-spinner" /> : "Lähetä uudelleen / Resend"}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            transition: "color var(--transition-fast)",
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Sulje / Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
