"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/components/LocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: "var(--bg-primary)",
    }}>
      <div style={{
        position: "fixed",
        top: 20,
        right: 20,
        display: "flex",
        gap: 4,
        alignItems: "center",
      }}>
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="anim-up" style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          <span className="heading-display" style={{ fontSize: 24 }}>
            <span style={{ color: "var(--text-primary)" }}>Hel</span>
            <span style={{ color: "var(--amber)" }}>scoop</span>
          </span>
        </Link>

        {submitted ? (
          <div className="anim-up">
            <div style={{
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              background: "var(--forest-dim)",
              border: "1px solid rgba(34,197,94,0.15)",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  {t("auth.forgotPasswordSend")}
                </span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
                {t("auth.forgotPasswordSent")}
              </p>
            </div>
            <Link href="/" style={{ color: "var(--amber)", fontSize: 13, textDecoration: "none" }}>
              {t("auth.forgotPasswordBack")}
            </Link>
          </div>
        ) : (
          <>
            <h2 className="heading-display" style={{ fontSize: 24, marginBottom: 8 }}>
              {t("auth.forgotPasswordTitle")}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5, marginBottom: 28 }}>
              {t("auth.forgotPasswordSubtitle")}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="label-mono" style={{ display: "block", marginBottom: 8 }}>
                  {t("auth.email")}
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--danger-dim)",
                  color: "var(--danger)",
                  fontSize: 13,
                  border: "1px solid rgba(199,95,95,0.12)",
                  lineHeight: 1.4,
                }}>
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: "100%",
                  padding: "13px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {loading ? <span className="btn-spinner" /> : t("auth.forgotPasswordSend")}
              </button>
            </form>

            <div className="divider-amber" style={{ marginTop: 28, marginBottom: 20 }} />

            <div style={{ textAlign: "center" }}>
              <Link href="/" style={{ color: "var(--amber)", fontSize: 13, textDecoration: "none" }}>
                {t("auth.forgotPasswordBack")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
