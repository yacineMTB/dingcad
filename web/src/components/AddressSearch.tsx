"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useTranslation } from "@/components/LocaleProvider";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { BuildingResult } from "@/types";

function Viewport3DLoading() {
  const { t } = useTranslation();
  return (
    <div style={{ width: "100%", height: "100%", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
      {t('editor.loading3D')}
    </div>
  );
}

const Viewport3D = dynamic(() => import("@/components/Viewport3D"), {
  ssr: false,
  loading: () => <Viewport3DLoading />,
});

const BUILDING_TYPE_LABELS: Record<string, Record<string, string>> = {
  fi: { omakotitalo: "Omakotitalo", rivitalo: "Rivitalo", kerrostalo: "Kerrostalo", paritalo: "Paritalo" },
  en: { omakotitalo: "Detached house", rivitalo: "Terraced house", kerrostalo: "Apartment block", paritalo: "Semi-detached" },
};

const MATERIAL_LABELS: Record<string, Record<string, string>> = {
  fi: { puu: "Puu", tiili: "Tiili", betoni: "Betoni", hirsi: "Hirsi" },
  en: { puu: "Wood", tiili: "Brick", betoni: "Concrete", hirsi: "Log" },
};

const HEATING_LABELS: Record<string, Record<string, string>> = {
  fi: { kaukolampo: "Kaukolampo", sahko: "Sahko", maalampopumppu: "Maalampopumppu", oljy: "Oljy" },
  en: { kaukolampo: "District heating", sahko: "Electric", maalampopumppu: "Ground source heat pump", oljy: "Oil" },
};

function DataSourcesSection({ label, sources }: { label: string; sources: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.05em",
          padding: "4px 0",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{
          display: "inline-block",
          transition: "transform 0.15s ease",
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          fontSize: 9,
        }}>&#9654;</span>
        {label}
      </button>
      {open && (
        <div style={{
          paddingLeft: 16,
          paddingTop: 4,
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}>
          {sources.map((src, i) => (
            <div key={i}>{src}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddressSearch({
  onCreateProject,
  compact = false,
}: {
  onCreateProject: (building: BuildingResult) => Promise<void> | void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [result, setResult] = useState<BuildingResult | null>(null);
  const [searched, setSearched] = useState(false);
  const { t, locale } = useTranslation();
  const { track } = useAnalytics();

  const search = useCallback(async () => {
    if (!query.trim() || query.trim().length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.getBuilding(query.trim());
      setResult(data);
      track("address_search", { query_length: query.trim().length, had_result: true });
    } catch {
      setResult(null);
      track("address_search", { query_length: query.trim().length, had_result: false });
    }
    setLoading(false);
  }, [query, track]);

  const buildingTypeLabels = BUILDING_TYPE_LABELS[locale] || BUILDING_TYPE_LABELS.fi;
  const materialLabels = MATERIAL_LABELS[locale] || MATERIAL_LABELS.fi;
  const heatingLabels = HEATING_LABELS[locale] || HEATING_LABELS.fi;

  if (compact) {
    return (
      <div>
        <div className="address-search-bar" data-tour="address-input" style={{ maxWidth: "none" }}>
          <input
            className="input"
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (searched) { setResult(null); setSearched(false); }
            }}
            onKeyDown={(e) => e.key === "Enter" && search()}
            style={{ flex: 1, padding: "12px 14px", fontSize: 14 }}
          />
          <button
            className={`btn ${query.trim().length >= 3 ? "btn-primary" : "btn-ghost"}`}
            onClick={search}
            disabled={loading || query.trim().length < 3}
            aria-label={t('search.searchButton')}
            style={{ padding: "12px 20px", fontSize: 13 }}
          >
            {loading ? t('search.searching') : t('search.searchButton')}
          </button>
        </div>

        {result && (
          <div className="anim-up" style={{ marginTop: 16 }}>
            <div className="card" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div className="heading-display" style={{ fontSize: 15, marginBottom: 4 }}>
                    {result.address}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="badge badge-amber" style={{ fontSize: 11 }}>
                      {buildingTypeLabels[result.building_info.type] || result.building_info.type}
                    </span>
                    <span className="badge" style={{
                      fontSize: 10,
                      background: result.confidence === "verified" ? "rgba(34,197,94,0.1)" : "var(--amber-glow)",
                      color: result.confidence === "verified" ? "rgb(34,197,94)" : "var(--amber)",
                      border: `1px solid ${result.confidence === "verified" ? "rgba(34,197,94,0.2)" : "var(--amber-border)"}`,
                    }}>
                      {result.confidence === "verified" ? t('search.verified') : t('search.estimated')}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      {result.building_info.year_built} &middot; {result.building_info.area_m2} m&sup2;
                    </span>
                  </div>
                </div>
              </div>
              {createError && (
                <div className="inline-error-banner">
                  {t('search.createError')}
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setCreating(true);
                  setCreateError(false);
                  try {
                    await onCreateProject(result);
                  } catch {
                    setCreateError(true);
                    setCreating(false);
                  }
                }}
                disabled={creating}
                style={{ width: "100%", padding: "11px 14px", fontSize: 13, fontWeight: 600 }}
              >
                {creating ? t('search.creatingProject') : t('search.createFromBuilding')}
              </button>
            </div>
          </div>
        )}

        {searched && !loading && !result && (
          <div className="anim-fade" style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 12 }}>
            {t('search.notFound')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      width: "100%",
      padding: result ? "32px 24px 24px" : "56px 24px 48px",
      borderBottom: "1px solid var(--border)",
      transition: "padding 0.3s ease",
    }}>
      <div style={{ maxWidth: result ? 960 : 640, margin: "0 auto", textAlign: "center", transition: "max-width 0.3s ease" }}>
        {!result && (
          <>
            <h1 className="heading-display" style={{ fontSize: 36, marginBottom: 10, lineHeight: 1.1 }}>
              {t('search.title')}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 16, marginBottom: 32, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              {t('search.subtitle')}
            </p>
          </>
        )}

        <div className="address-search-bar" data-tour="address-input">
          <input
            className="input"
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (searched) { setResult(null); setSearched(false); }
            }}
            onKeyDown={(e) => e.key === "Enter" && search()}
            style={{ flex: 1, padding: "14px 16px", fontSize: 15 }}
          />
          <button
            className={`btn ${query.trim().length >= 3 ? "btn-primary" : "btn-ghost"}`}
            onClick={search}
            disabled={loading || query.trim().length < 3}
            aria-label={t('search.searchButton')}
            style={{ padding: "14px 28px", fontSize: 14 }}
          >
            {loading ? t('search.searching') : t('search.searchButton')}
          </button>
        </div>

        {result && (
          <div className="anim-up building-result-grid" style={{
            marginTop: 28,
            textAlign: "left",
          }}>
            {/* 3D Preview */}
            <div style={{
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              minHeight: 320,
            }}>
              <Viewport3D
                sceneJs={result.scene_js}
                wireframe={false}
                onObjectCount={() => {}}
                onError={() => {}}
              />
            </div>

            {/* Building info + CTA */}
            <div className="card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h3 className="heading-display" style={{ fontSize: 20, marginBottom: 6 }}>
                    {result.address}
                  </h3>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="badge badge-amber">
                      {buildingTypeLabels[result.building_info.type] || result.building_info.type}
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: result.confidence === "verified"
                          ? "var(--forest-dim)"
                          : "var(--amber-glow)",
                        color: result.confidence === "verified"
                          ? "var(--forest)"
                          : "var(--amber)",
                        border: `1px solid ${result.confidence === "verified" ? "rgba(34,197,94,0.2)" : "var(--amber-border)"}`,
                      }}
                    >
                      {result.confidence === "verified" ? t('search.verified') : t('search.estimated')}
                    </span>
                  </div>
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  textAlign: "right",
                }}>
                  {result.coordinates.lat.toFixed(4)}<br/>{result.coordinates.lon.toFixed(4)}
                </div>
              </div>

              <div className="building-info-grid" style={{
                marginBottom: 16,
                flex: 1,
              }}>
                {[
                  { label: t('search.yearBuilt'), value: String(result.building_info.year_built) },
                  { label: t('search.area'), value: `${result.building_info.area_m2} m\u00B2` },
                  { label: t('search.floors'), value: String(result.building_info.floors) },
                  { label: t('search.material'), value: materialLabels[result.building_info.material] || result.building_info.material },
                  { label: t('search.heating'), value: heatingLabels[result.building_info.heating] || result.building_info.heating },
                  { label: t('search.bomRows'), value: `${result.bom_suggestion.length} ${locale === 'fi' ? 'kpl' : 'pcs'}` },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "10px 12px",
                    background: "var(--bg-tertiary)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}>
                    <div className="label-mono" style={{ marginBottom: 4, fontSize: 10 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {result.data_sources && result.data_sources.length > 0 && (
                <DataSourcesSection
                  label={t('search.dataSources')}
                  sources={result.data_sources}
                />
              )}

              {createError && (
                <div className="inline-error-banner">
                  {t('search.createError')}
                </div>
              )}
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setCreating(true);
                  setCreateError(false);
                  try {
                    await onCreateProject(result);
                  } catch {
                    setCreateError(true);
                    setCreating(false);
                  }
                }}
                disabled={creating}
                style={{ width: "100%", padding: "14px 16px", fontSize: 15, fontWeight: 600, opacity: creating ? 0.7 : 1 }}
              >
                {creating ? t('search.creatingProject') : t('search.createFromBuilding')}
              </button>
            </div>
          </div>
        )}

        {searched && !loading && !result && (
          <div className="anim-fade" style={{
            marginTop: 20,
            padding: "16px",
            color: "var(--text-muted)",
            fontSize: 13,
          }}>
            {t('search.notFound')}
          </div>
        )}
      </div>
    </div>
  );
}
