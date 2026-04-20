"use client";

import { SkeletonBlock } from "@/components/Skeleton";
import { useTranslation } from "@/components/LocaleProvider";
import type { Template } from "@/types";

const TEMPLATE_ICONS: Record<string, string> = {
  sauna: "M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M5 21V5l7-3 7 3v16",
  garage: "M3 21V8l9-5 9 5v13M3 21h18M9 21v-6h6v6",
  shed: "M3 21V10l4-3h10l4 3v11M3 21h18M10 21v-4h4v4",
  pergola: "M4 22V12M20 22V12M2 12h20M6 12v-2M10 12v-2M14 12v-2M18 12v-2",
  kanala: "M3 21h18M5 21V11l7-4 7 4v10M9 21v-4h6v4M10 11h1M14 11h1M8 15h1",
};

export default function TemplateGrid({
  templates,
  loading,
  creating,
  onCreateFromTemplate,
}: {
  templates: Template[];
  loading: boolean;
  creating: boolean;
  onCreateFromTemplate: (tmpl: Template) => void;
}) {
  const { t } = useTranslation();

  return (
    <div style={{ marginTop: 28 }}>
      <div className="label-mono" style={{ marginBottom: 14, letterSpacing: "0.1em" }}>
        {t('project.orStartFromTemplate')}
      </div>
      {loading ? (
        <div className="template-grid">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{
                padding: "24px 20px",
                animation: `fadeIn 0.3s ease ${i * 0.08}s both`,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <SkeletonBlock width={48} height={48} radius="var(--radius-sm)" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                  <SkeletonBlock width="70%" height={16} />
                  <SkeletonBlock width={60} height={20} radius={100} />
                </div>
              </div>
              <SkeletonBlock width="90%" height={12} />
              <SkeletonBlock width="60%" height={12} style={{ marginTop: 6 }} />
            </div>
          ))}
        </div>
      ) : templates.length > 0 ? (
        <div className="template-grid">
          {templates.map((tmpl, i) => (
            <button
              key={tmpl.id}
              className="card card-interactive anim-up"
              disabled={creating}
              onClick={() => onCreateFromTemplate(tmpl)}
              style={{
                animationDelay: `${i * 0.06}s`,
                padding: "24px 20px",
                cursor: creating ? "wait" : "pointer",
                textAlign: "left",
                width: "100%",
                font: "inherit",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 10 }}>
                <div className="template-icon" style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: "stroke 0.15s ease" }}
                  >
                    <path d={TEMPLATE_ICONS[tmpl.icon] || TEMPLATE_ICONS.shed} />
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="heading-display" style={{ fontSize: 15, marginBottom: 4 }}>
                    {tmpl.name}
                  </div>
                  <span className="badge badge-amber">
                    ~{Number(tmpl.estimated_cost).toLocaleString("fi-FI")} &euro;
                  </span>
                </div>
              </div>
              <div style={{
                color: "var(--text-muted)",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {tmpl.description}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
