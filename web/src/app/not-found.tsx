"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

export default function NotFound() {
  const { t } = useTranslation();

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
        {/* House SVG with question mark */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          style={{ marginBottom: 32 }}
        >
          {/* Roof */}
          <path
            d="M20 55L60 20L100 55"
            stroke="var(--amber)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Walls */}
          <rect
            x="28"
            y="55"
            width="64"
            height="45"
            rx="2"
            stroke="var(--text-muted)"
            strokeWidth="2"
            fill="none"
          />
          {/* Door */}
          <rect
            x="50"
            y="72"
            width="20"
            height="28"
            rx="2"
            stroke="var(--text-muted)"
            strokeWidth="2"
            fill="none"
          />
          {/* Question mark on door */}
          <text
            x="60"
            y="92"
            textAnchor="middle"
            fontSize="22"
            fontWeight="700"
            fontFamily="var(--font-display)"
            fill="var(--amber)"
          >
            ?
          </text>
          {/* Window */}
          <rect
            x="35"
            y="62"
            width="10"
            height="10"
            rx="1"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>

        <h1
          className="heading-display"
          style={{ fontSize: 28, marginBottom: 8 }}
        >
          <span style={{ color: "var(--text-primary)" }}>404</span>
        </h1>

        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            marginBottom: 8,
          }}
        >
          {t("errors.notFoundTitle")}
        </p>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          {t("errors.notFoundMessage")}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link
            href="/"
            className="btn btn-primary"
            style={{
              padding: "12px 24px",
              textDecoration: "none",
              fontSize: 14,
            }}
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t("errors.backToProjects")}
          </Link>
        </div>
      </div>

      {/* Logo at bottom */}
      <div style={{ marginTop: 48 }}>
        <span className="heading-display" style={{ fontSize: 16, opacity: 0.4 }}>
          <span style={{ color: "var(--text-primary)" }}>Hel</span>
          <span style={{ color: "var(--amber)" }}>scoop</span>
        </span>
      </div>
    </div>
  );
}
