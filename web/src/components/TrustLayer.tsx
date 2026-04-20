"use client";

import { useTranslation } from "@/components/LocaleProvider";

/** SVG text logos for partner/data source brands — no external images needed */
const PARTNERS = [
  { name: "K-Rauta", width: 70 },
  { name: "Stark", width: 50 },
  { name: "Ruukki", width: 55 },
  { name: "DVV", width: 35 },
  { name: "MML", width: 40 },
  { name: "Sarokas", width: 60 },
];

export default function TrustLayer() {
  const { locale } = useTranslation();

  const stats = [
    {
      value: "1 200+",
      label: locale === "fi" ? "Tuotetta" : "Products",
    },
    {
      value: "6",
      label: locale === "fi" ? "Toimittajaa" : "Suppliers",
    },
    {
      value: "100%",
      label: locale === "fi" ? "Ilmainen" : "Free",
    },
    {
      value: "GDPR",
      label: locale === "fi" ? "Tietosuoja" : "Compliant",
    },
  ];

  return (
    <div className="trust-layer">
      {/* Partner logos */}
      <div className="trust-partners">
        <span className="trust-partners-label">
          {locale === "fi" ? "TIETOLAHTEET JA TOIMITTAJAT" : "DATA SOURCES & SUPPLIERS"}
        </span>
        <div className="trust-logo-row">
          {PARTNERS.map((p) => (
            <span
              key={p.name}
              className="trust-logo"
              style={{ minWidth: p.width }}
            >
              {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="trust-stats-bar">
        {stats.map((s, i) => (
          <div key={i} className="trust-stat">
            <span className="trust-stat-value">{s.value}</span>
            <span className="trust-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div className="trust-proof">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--forest)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span className="trust-proof-text">
          {locale === "fi"
            ? "Virallinen rakennusdata DVV:lta ja MML:lta. Ei analytiikkaevasteita. Tietosi EU:ssa."
            : "Official building data from DVV and MML. No analytics cookies. Your data stays in the EU."}
        </span>
      </div>
    </div>
  );
}
