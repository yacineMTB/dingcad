"use client";

import { useState, type ReactNode } from "react";
import { api, setToken } from "@/lib/api";
import { useTranslation } from "@/components/LocaleProvider";
import { useAnalytics } from "@/hooks/useAnalytics";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import HeroIllustration from "@/components/HeroIllustration";
import TrustLayer from "@/components/TrustLayer";
import ScrollReveal from "@/components/ScrollReveal";
import type { BuildingResult } from "@/types";

export default function LoginForm({
  onLogin,
  pendingBuilding,
  addressSearch,
}: {
  onLogin: () => void;
  pendingBuilding: BuildingResult | null;
  addressSearch?: ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { t } = useTranslation();
  const { track } = useAnalytics();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isRegister && !acceptedTerms) {
      setError(t('legal.acceptTermsRequired'));
      return;
    }
    setLoading(true);
    try {
      const result = isRegister
        ? await api.register(email, password, name)
        : await api.login(email, password);
      setToken(result.token);
      track(isRegister ? "auth_register" : "auth_login", {} as Record<string, never>);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    }
    setLoading(false);
  }

  const features = [
    {
      icon: "M3 21h18M9 8h1M9 12h1M5 21V5l7-3 7 3v16",
      num: "28",
      label: t('brand.featureMaterials'),
      desc: t('brand.featureMaterialsDesc'),
    },
    {
      icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6",
      num: "6",
      label: t('brand.featureSuppliers'),
      desc: t('brand.featureSuppliersDesc'),
    },
    {
      icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
      num: "AI",
      label: t('brand.featureAI'),
      desc: t('brand.featureAIDesc'),
    },
  ];

  return (
    <div className="login-grid">
      {/* Left: Brand panel */}
      <div className="login-brand">
        <HeroIllustration />
        <div style={{ position: "relative", zIndex: 1 }}>
          <ScrollReveal>
            <div style={{ marginBottom: 36 }}>
              <h1 className="heading-display brand-title">
                <span>Hel</span><span className="brand-title-accent">scoop</span>
              </h1>
              <p className="brand-subtitle">
                {t('brand.description')}
              </p>
            </div>
          </ScrollReveal>

          {addressSearch && (
            <ScrollReveal delay={0.1}>
              <div style={{ marginBottom: 28 }}>
                <div className="label-mono brand-tagline" style={{ marginBottom: 10 }}>
                  {t('search.sectionLabel')}
                </div>
                {addressSearch}
              </div>
            </ScrollReveal>
          )}

          <div style={{ display: "flex", flexDirection: "column", marginBottom: 36 }}>
            {features.map((item, i) => (
              <ScrollReveal key={i} delay={0.15 + i * 0.07}>
                <div className="brand-feature-item">
                  <div className="brand-feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <div className="brand-feature-label">
                      <span className="brand-feature-num">{item.num}</span>
                      {item.label}
                    </div>
                    <div className="brand-feature-desc">{item.desc}</div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={0.35}>
            <TrustLayer />
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <div className="label-mono brand-tagline">
              {t('brand.tagline')}
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="login-form-panel">
        <div style={{
          position: "absolute",
          top: 20,
          right: 20,
          display: "flex",
          gap: 4,
          alignItems: "center",
        }}>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <div className="anim-up delay-1" style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 className="heading-display" style={{ fontSize: 24, marginBottom: 8 }}>
              {isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>
              {pendingBuilding
                ? t('auth.loginSubtitleBuilding') + pendingBuilding.address
                : isRegister
                  ? t('auth.registerSubtitle')
                  : t('auth.loginSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {isRegister && (
              <div>
                <label htmlFor="login-name" className="label-mono" style={{ display: "block", marginBottom: 8 }}>{t('auth.name')}</label>
                <input
                  id="login-name"
                  className="input"
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="label-mono" style={{ display: "block", marginBottom: 8 }}>{t('auth.email')}</label>
              <input
                id="login-email"
                className="input"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="label-mono" style={{ display: "block", marginBottom: 8 }}>{t('auth.password')}</label>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              {!isRegister && (
                <div style={{ marginTop: 8, textAlign: "right" }}>
                  <a
                    href="/forgot-password"
                    className="link-muted"
                    style={{ fontSize: 12 }}
                  >
                    {t('auth.forgotPassword')}
                  </a>
                </div>
              )}
            </div>

            {isRegister && (
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-secondary)",
              }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{
                    marginTop: 2,
                    accentColor: "var(--amber)",
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                  }}
                />
                <span>
                  {t('legal.acceptTerms').split(t('legal.termsOfService'))[0]}
                  <a href="/terms" target="_blank" style={{ color: "var(--amber)", textDecoration: "none" }}>
                    {t('legal.termsOfService')}
                  </a>
                  {" "}{t('legal.and')}{" "}
                  <a href="/privacy" target="_blank" style={{ color: "var(--amber)", textDecoration: "none" }}>
                    {t('legal.privacyPolicy')}
                  </a>
                </span>
              </label>
            )}

            {error && (
              <div className="anim-up" style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--danger-dim)",
                color: "var(--danger)",
                fontSize: 13,
                border: "1px solid rgba(199,95,95,0.12)",
                lineHeight: 1.4,
                animationDuration: "0.2s",
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px 16px",
                fontSize: 14,
                marginTop: 4,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {loading ? <span className="btn-spinner" /> : isRegister ? t('auth.register') : t('auth.login')}
            </button>
          </form>

          <div className="divider-amber" style={{ marginTop: 32, marginBottom: 24 }} />

          <div style={{ textAlign: "center" }}>
            <button
              className="link-amber"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              style={{ fontSize: 13 }}
            >
              {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
          </div>

          <div style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            gap: 16,
          }}>
            <a href="/privacy" className="link-muted" style={{ fontSize: 11 }}>
              {t('legal.privacyPolicy')}
            </a>
            <a href="/terms" className="link-muted" style={{ fontSize: 11 }}>
              {t('legal.termsOfService')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
