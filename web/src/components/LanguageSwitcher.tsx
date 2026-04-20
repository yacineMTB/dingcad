"use client";

import { useTranslation } from "@/components/LocaleProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      className="lang-switch"
      aria-label="Switch language"
      onClick={() => setLocale(locale === "fi" ? "en" : "fi")}
    >
      <span style={{ opacity: locale === "fi" ? 1 : 0.4, transition: "opacity 0.15s ease" }}>FI</span>
      <span style={{ opacity: 0.3 }}>|</span>
      <span style={{ opacity: locale === "en" ? 1 : 0.4, transition: "opacity 0.15s ease" }}>EN</span>
    </button>
  );
}
