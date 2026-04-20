"use client";

import { useTranslation } from "@/components/LocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: "var(--text-primary)",
        marginBottom: 8,
        fontFamily: "var(--font-display)",
      }}>
        {title}
      </h3>
      <p style={{
        color: "var(--text-secondary)",
        fontSize: 14,
        lineHeight: 1.7,
        margin: 0,
      }}>
        {body}
      </p>
    </div>
  );
}

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div className="nav-bar">
        <div className="nav-inner" style={{ maxWidth: 720 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span className="heading-display" style={{ fontSize: 20 }}>
              <span style={{ color: "var(--text-primary)" }}>Hel</span>
              <span style={{ color: "var(--amber)" }}>scoop</span>
            </span>
          </Link>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div className="anim-up">
          <h1 className="heading-display" style={{ fontSize: 36, marginBottom: 8 }}>
            {t("legal.termsTitle")}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 32 }}>
            {t("legal.lastUpdated")}: 2026-04-19
          </p>
        </div>

        <div className="card anim-up delay-1" style={{ padding: "32px 28px" }}>
          <p style={{
            color: "var(--text-secondary)",
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 32,
            paddingBottom: 24,
            borderBottom: "1px solid var(--border)",
          }}>
            {t("legal.termsIntro")}
          </p>

          <Section title={t("legal.termsUse")} body={t("legal.termsUseBody")} />
          <Section title={t("legal.termsIP")} body={t("legal.termsIPBody")} />
          <Section title={t("legal.termsAI")} body={t("legal.termsAIBody")} />
          <Section title={t("legal.termsPrices")} body={t("legal.termsPricesBody")} />
          <Section title={t("legal.termsLiability")} body={t("legal.termsLiabilityBody")} />
          <Section title={t("legal.termsChanges")} body={t("legal.termsChangesBody")} />
        </div>

        <div className="anim-up delay-2" style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/privacy"
            style={{
              color: "var(--amber)",
              fontSize: 13,
              textDecoration: "none",
              marginRight: 20,
            }}
          >
            {t("legal.privacyPolicy")}
          </Link>
          <Link
            href="/"
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t("auth.forgotPasswordBack")}
          </Link>
        </div>
      </div>
    </div>
  );
}
