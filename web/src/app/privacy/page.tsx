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

export default function PrivacyPage() {
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
            {t("legal.privacyTitle")}
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
            {t("legal.privacyIntro")}
          </p>

          <Section title={t("legal.privacyDataCollected")} body={t("legal.privacyDataCollectedBody")} />
          <Section title={t("legal.privacyHowUsed")} body={t("legal.privacyHowUsedBody")} />
          <Section title={t("legal.privacyStorage")} body={t("legal.privacyStorageBody")} />
          <Section title={t("legal.privacyThirdParty")} body={t("legal.privacyThirdPartyBody")} />
          <Section title={t("legal.privacyRights")} body={t("legal.privacyRightsBody")} />
          <Section title={t("legal.privacyCookies")} body={t("legal.privacyCookiesBody")} />
          <Section title={t("legal.privacyContact")} body={t("legal.privacyContactBody")} />
        </div>

        <div className="anim-up delay-2" style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/terms"
            style={{
              color: "var(--amber)",
              fontSize: 13,
              textDecoration: "none",
              marginRight: 20,
            }}
          >
            {t("legal.termsOfService")}
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
