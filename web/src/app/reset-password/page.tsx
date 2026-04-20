"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useTranslation } from "@/components/LocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) setToken(t);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.resetPasswordMismatch"));
      return;
    }

    if (!token) {
      setError(t("auth.resetPasswordInvalid"));
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetPasswordInvalid"));
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="anim-up" style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          <span className="heading-display" style={{ fontSize: 24 }}>
            <span style={{ color: "var(--text-primary)" }}>Hel</span>
            <span style={{ color: "var(--amber)" }}>scoop</span>
          </span>
        </Link>

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
              {t("auth.resetPasswordSubmit")}
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
            {t("auth.resetPasswordSuccess")}
          </p>
        </div>

        <Link
          href="/"
          className="btn btn-primary"
          style={{
            width: "100%",
            padding: "13px 16px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="anim-up" style={{ width: "100%", maxWidth: 400 }}>
      <Link href="/" style={{ textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
        <span className="heading-display" style={{ fontSize: 24 }}>
          <span style={{ color: "var(--text-primary)" }}>Hel</span>
          <span style={{ color: "var(--amber)" }}>scoop</span>
        </span>
      </Link>

      <h2 className="heading-display" style={{ fontSize: 24, marginBottom: 8 }}>
        {t("auth.resetPasswordTitle")}
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5, marginBottom: 28 }}>
        {t("auth.resetPasswordSubtitle")}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label className="label-mono" style={{ display: "block", marginBottom: 8 }}>
            {t("auth.resetPasswordNew")}
          </label>
          <input
            className="input"
            type="password"
            placeholder={t("auth.resetPasswordNewPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
          />
        </div>

        <div>
          <label className="label-mono" style={{ display: "block", marginBottom: 8 }}>
            {t("auth.resetPasswordConfirm")}
          </label>
          <input
            className="input"
            type="password"
            placeholder={t("auth.resetPasswordConfirmPlaceholder")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
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
          disabled={loading || !password || !confirmPassword}
          style={{
            width: "100%",
            padding: "13px 16px",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {loading ? <span className="btn-spinner" /> : t("auth.resetPasswordSubmit")}
        </button>
      </form>

      <div className="divider-amber" style={{ marginTop: 28, marginBottom: 20 }} />

      <div style={{ textAlign: "center" }}>
        <Link href="/" style={{ color: "var(--amber)", fontSize: 13, textDecoration: "none" }}>
          {t("auth.forgotPasswordBack")}
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();

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

      <Suspense fallback={
        <div className="anim-up" style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <span className="heading-display" style={{ fontSize: 24 }}>
            <span style={{ color: "var(--text-primary)" }}>Hel</span>
            <span style={{ color: "var(--amber)" }}>scoop</span>
          </span>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 16 }}>
            {t("auth.loading")}
          </p>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
