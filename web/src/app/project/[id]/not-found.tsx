"use client";

import Link from "next/link";
import { useTranslation } from "@/components/LocaleProvider";

export default function ProjectNotFound() {
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
        {/* Empty blueprint icon */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 24 }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" stroke="var(--amber)" />
        </svg>

        <h1
          className="heading-display"
          style={{ fontSize: 24, marginBottom: 8 }}
        >
          {t("errors.projectNotFoundTitle")}
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          {t("errors.projectNotFoundMessage")}
        </p>

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
