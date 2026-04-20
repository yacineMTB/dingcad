"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { SkeletonProjectCard } from "@/components/Skeleton";
import { useTranslation } from "@/components/LocaleProvider";
import { useAnalytics } from "@/hooks/useAnalytics";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProjectCard from "@/components/ProjectCard";
import TemplateGrid from "@/components/TemplateGrid";
import AddressSearch from "@/components/AddressSearch";
import Link from "next/link";
import type { Project, Template, BuildingResult } from "@/types";

type SortKey = "modified" | "created" | "name" | "cost";

export default function ProjectList({
  onCreateFromBuilding,
}: {
  onCreateFromBuilding?: (building: BuildingResult) => Promise<void> | void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [trashProjects, setTrashProjects] = useState<Project[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const { track } = useAnalytics();
  const router = useRouter();
  const templateRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getProjects(), api.getTemplates()])
      .then(([projs, tmpls]) => {
        if (mounted) {
          setProjects(projs);
          setTemplates(tmpls);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          toast(err instanceof Error ? err.message : t('toast.loadProjectsFailed'), "error");
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [toast, t]);

  async function createProject() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      track("project_created", { source: "blank" });
      const p = await api.createProject({ name: newName });
      setProjects([p, ...projects]);
      setNewName("");
      toast(t('toast.projectCreated'), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.createProjectFailed'), "error");
    }
    setCreating(false);
  }

  async function createFromTemplate(tmpl: Template) {
    setCreating(true);
    try {
      track("project_created", { source: "template" });
      const p = await api.createProject({
        name: tmpl.name,
        description: tmpl.description,
        scene_js: tmpl.scene_js,
      });
      if (tmpl.bom.length > 0) {
        await api.saveBOM(p.id, tmpl.bom);
      }
      setProjects([{ ...p, estimated_cost: tmpl.estimated_cost }, ...projects]);
      toast(t('toast.templateCreated'), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.templateFailed'), "error");
    }
    setCreating(false);
  }

  function deleteProject(id: string) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
      toast(t('toast.projectDeleted'), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.deleteFailed'), "error");
    }
  }

  async function duplicateProject(id: string) {
    try {
      const p = await api.duplicateProject(id);
      setProjects([p, ...projects]);
      toast(t('toast.projectDuplicated'), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.duplicateFailed'), "error");
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.name || typeof data.name !== "string" || !data.scene_js || typeof data.scene_js !== "string") {
        toast(t("toast.projectImportInvalid"), "error");
        setImporting(false);
        return;
      }

      track("project_imported", { format: "helscoop" });

      const project = await api.createProject({
        name: data.name,
        description: data.description || undefined,
        scene_js: data.scene_js,
      });

      if (Array.isArray(data.bom) && data.bom.length > 0) {
        const bomItems = data.bom
          .filter((b: Record<string, unknown>) => b.material_id && b.quantity)
          .map((b: Record<string, unknown>) => ({
            material_id: String(b.material_id),
            quantity: Number(b.quantity),
            unit: (b.unit as string) || "kpl",
          }));
        if (bomItems.length > 0) {
          await api.saveBOM(project.id, bomItems);
        }
      }

      toast(t("toast.projectImported"), "success");
      router.push(`/project/${project.id}`);
    } catch (err) {
      if (err instanceof SyntaxError) {
        toast(t("toast.projectImportInvalid"), "error");
      } else {
        toast(err instanceof Error ? err.message : t("toast.projectImportFailed"), "error");
      }
    }
    setImporting(false);
  }

  async function loadTrash() {
    setTrashLoading(true);
    try {
      const items = await api.getTrashProjects();
      setTrashProjects(items);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.deleteFailed'), "error");
    }
    setTrashLoading(false);
  }

  async function toggleTrash() {
    if (!showTrash) {
      await loadTrash();
    }
    setShowTrash(!showTrash);
  }

  async function restoreProject(id: string) {
    try {
      await api.restoreProject(id);
      setTrashProjects(trashProjects.filter((p) => p.id !== id));
      const refreshed = await api.getProjects();
      setProjects(refreshed);
      toast(t('toast.projectRestored'), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.restoreFailed'), "error");
    }
  }

  function requestPermanentDelete(id: string) {
    setPermanentDeleteTarget(id);
  }

  async function confirmPermanentDelete() {
    if (!permanentDeleteTarget) return;
    const id = permanentDeleteTarget;
    setPermanentDeleteTarget(null);
    try {
      await api.permanentDeleteProject(id);
      setTrashProjects(trashProjects.filter((p) => p.id !== id));
      toast(t('toast.projectPermanentlyDeleted'), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.permanentDeleteFailed'), "error");
    }
  }

  function projectCountText(count: number): string {
    if (locale === 'fi') {
      return `${count} projekti${count !== 1 ? "a" : ""}`;
    }
    return `${count} project${count !== 1 ? "s" : ""}`;
  }

  function trashDaysInfo(deletedAt: string): { days: number; remaining: number } {
    const deleted = new Date(deletedAt);
    const now = new Date();
    const days = Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, 30 - days);
    return { days, remaining };
  }

  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...result];
    switch (sortKey) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, locale === "fi" ? "fi" : "en"));
        break;
      case "created":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "cost":
        sorted.sort((a, b) => Number(b.estimated_cost) - Number(a.estimated_cost));
        break;
      case "modified":
      default:
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
    }

    return sorted;
  }, [projects, searchQuery, sortKey, locale]);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Top bar */}
      <div className="nav-bar">
        <div className="nav-inner" style={{ maxWidth: 1080 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="heading-display" style={{ fontSize: 20 }}>
              <span style={{ color: "var(--text-primary)" }}>Hel</span>
              <span style={{ color: "var(--amber)" }}>scoop</span>
            </span>
            <div style={{ width: 1, height: 20, background: "var(--border-strong)", margin: "0 4px" }} />
            <span className="label-mono">{t('nav.projects')}</span>
          </div>
          <div className="nav-links">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link href="/settings" className="btn btn-ghost" style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {t('nav.settings')}
            </Link>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setToken(null); window.location.reload(); }}>
              {t('nav.logout')}
            </button>
          </div>
          <button
            className="nav-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              )}
            </svg>
          </button>
        </div>
        <div className={`nav-mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
          <ThemeToggle />
            <LanguageSwitcher />
          <Link href="/settings" className="btn btn-ghost" style={{ fontSize: 12, width: "100%", justifyContent: "flex-start", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {t('nav.settings')}
          </Link>
          <button className="btn btn-ghost" style={{ fontSize: 12, width: "100%", justifyContent: "flex-start" }} onClick={() => { setToken(null); window.location.reload(); }}>
            {t('nav.logout')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Hero create section */}
        <div className="anim-up" style={{ marginBottom: 48 }}>
          <h1 className="heading-display" style={{ fontSize: 36, marginBottom: 6 }}>
            {t('project.myProjects')}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 24 }}>
            {loading
              ? t('project.loadingProjects')
              : projects.length > 0
                ? projectCountText(projects.length)
                : t('project.startFirst')}
          </p>

          <div style={{ display: "flex", gap: 8, maxWidth: 560 }}>
            <input
              className="input"
              placeholder={t('project.newProjectPlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              style={{ flex: 1 }}
            />
            <button
              className={`btn ${newName.trim() ? "btn-primary" : "btn-ghost"}`}
              onClick={createProject}
              disabled={creating || !newName.trim()}
              style={{ padding: "11px 24px" }}
            >
              {creating ? <span className="btn-spinner" /> : t('project.create')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".helscoop,.json"
              onChange={handleImportFile}
              style={{ display: "none" }}
              aria-label={t('project.importProject')}
            />
            <button
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 6 }}
              data-tooltip={t('project.importProject')}
              aria-label={t('project.importProject')}
            >
              {importing ? (
                <span className="btn-spinner" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
              {t('project.import')}
            </button>
          </div>

          {/* Template picker */}
          <div ref={templateRef} />
          <TemplateGrid
            templates={templates}
            loading={loading}
            creating={creating}
            onCreateFromTemplate={createFromTemplate}
          />

          {/* Address import */}
          {onCreateFromBuilding && (
            <div style={{ marginTop: 28 }}>
              <div className="label-mono" style={{ marginBottom: 14, letterSpacing: "0.1em" }}>
                {t('search.sectionLabel')}
              </div>
              <AddressSearch onCreateProject={onCreateFromBuilding} compact />
            </div>
          )}
        </div>

        {loading ? (
          <div className="dash-project-grid">
            {[0, 1, 2].map((i) => (
              <SkeletonProjectCard key={i} delay={i * 0.08} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="anim-up delay-1 dash-empty-onboarding">
            <div className="empty-state-illustration">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="empty-onboarding-heading">{t('project.emptyOnboardingHeading')}</h2>
            <p className="empty-onboarding-subtitle">{t('project.emptyOnboardingSubtitle')}</p>

            {onCreateFromBuilding && (
              <div className="empty-onboarding-search">
                <AddressSearch onCreateProject={onCreateFromBuilding} compact />
              </div>
            )}

            <div className="empty-onboarding-divider">
              <span>{t('project.emptyOnboardingOr')}</span>
            </div>

            <button
              className="empty-state-cta"
              onClick={() => {
                templateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              {t('project.emptyOnboardingTemplate')}
            </button>
          </div>
        ) : (
          <>
            {/* Search and sort bar */}
            <div className="anim-up delay-1 dash-search-bar">
              <div className="dash-search-wrap">
                <svg
                  className="dash-search-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className="input"
                  placeholder={t('project.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
              </div>
              <select
                className="select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="modified">{t('project.sortByModified')}</option>
                <option value="name">{t('project.sortByName')}</option>
                <option value="created">{t('project.sortByCreated')}</option>
                <option value="cost">{t('project.sortByCost')}</option>
              </select>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="anim-up dash-no-results">
                <div className="empty-state-illustration">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13" cy="13" r="8" />
                    <line x1="19" y1="19" x2="27" y2="27" />
                    <rect x="8" y="16" width="10" height="8" rx="0.5" />
                    <polyline points="8,16 13,12 18,16" />
                  </svg>
                </div>
                <p className="dash-no-results-title">
                  {t('project.noSearchResults')}
                </p>
                <p className="dash-no-results-desc">
                  {t('project.noSearchResultsDesc')}
                </p>
                <button
                  className="empty-state-cta"
                  onClick={() => setSearchQuery("")}
                >
                  {t('project.noSearchResultsCta')}
                </button>
              </div>
            ) : (
              <div className="dash-project-grid">
                {filteredProjects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
                    onDuplicate={duplicateProject}
                    onDelete={deleteProject}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Trash section */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 80px" }}>
        <button
          className="btn btn-ghost"
          onClick={toggleTrash}
          style={{ fontSize: 13, gap: 6, marginBottom: showTrash ? 20 : 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {showTrash ? t('project.hideTrash') : t('project.showTrash')}
          {trashProjects.length > 0 && showTrash && (
            <span className="badge badge-amber" style={{ marginLeft: 4 }}>{trashProjects.length}</span>
          )}
        </button>

        {showTrash && (
          <div>
            {trashLoading ? (
              <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "20px 0" }}>
                {t('project.loadingProjects')}
              </div>
            ) : trashProjects.length === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 4 }}>
                  {t('project.trashEmpty')}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: 12, opacity: 0.7 }}>
                  {t('project.trashEmptyDesc')}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {trashProjects.map((p) => {
                  const info = trashDaysInfo(p.deleted_at!);
                  return (
                    <div
                      key={p.id}
                      className="card"
                      style={{ padding: "16px 20px", opacity: 0.75 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 className="heading-display" style={{ fontSize: 16, marginBottom: 4 }}>
                            {p.name}
                          </h3>
                          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
                            {t('project.trashInfo', { days: info.days, remaining: info.remaining })}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "6px 14px", fontSize: 12, gap: 4 }}
                            onClick={() => restoreProject(p.id)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                            {t('project.restore')}
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "6px 14px", fontSize: 12, gap: 4 }}
                            onClick={() => requestPermanentDelete(p.id)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            {t('project.permanentDelete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('dialog.deleteProjectTitle')}
        message={t('dialog.deleteProjectMessage')}
        confirmText={t('project.delete')}
        cancelText={t('dialog.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={permanentDeleteTarget !== null}
        title={t('dialog.permanentDeleteTitle')}
        message={t('dialog.permanentDeleteMessage')}
        confirmText={t('project.permanentDelete')}
        cancelText={t('dialog.cancel')}
        variant="danger"
        onConfirm={confirmPermanentDelete}
        onCancel={() => setPermanentDeleteTarget(null)}
      />
    </div>
  );
}
