"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/LocaleProvider";
import type { Project } from "@/types";

export default function ProjectCard({
  project,
  index,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  index: number;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();

  return (
    <div
      className="card card-interactive anim-up project-card-grid"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/project/${project.id}`);
        }
      }}
      style={{
        animationDelay: `${index * 0.04}s`,
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
      }}
      onClick={() => (router.push(`/project/${project.id}`))}
    >
      {/* Thumbnail or placeholder */}
      <div className="project-card-thumb" style={{
        background: project.thumbnail_url
          ? `url(${project.thumbnail_url}) center/cover no-repeat`
          : undefined,
      }}>
        {!project.thumbnail_url && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}
        <div className="project-card-thumb-fade" />
      </div>
      <div style={{ padding: "14px 22px 18px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h3 className="heading-display" style={{ fontSize: 18 }}>{project.name}</h3>
            {project.estimated_cost > 0 && (
              <span className="badge badge-amber">
                {Number(project.estimated_cost).toFixed(0)} &euro;
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-muted)", fontSize: 13 }}>
            <span>{project.description || t('project.emptyDescription')}</span>
            <span style={{ opacity: 0.5 }}>&middot;</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {new Date(project.updated_at).toLocaleDateString(locale === 'fi' ? 'fi-FI' : 'en-GB')}
            </span>
          </div>
        </div>
        <div className="project-card-actions" onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 11, gap: 4 }} onClick={() => (router.push(`/project/${project.id}`))}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {t('project.open')}
          </button>
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 11, gap: 4 }} onClick={() => onDuplicate(project.id)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {t('project.copy')}
          </button>
          <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 11, gap: 4 }} onClick={() => onDelete(project.id)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {t('project.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
