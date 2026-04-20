"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "@/components/LocaleProvider";
import { api } from "@/lib/api";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { interpretScene, extractSceneMaterials } from "@/lib/scene-interpreter";
import type { BomItem, Material, MaterialPriceData, Category, PriceHistoryRow } from "@/types";

/* ── Localization helpers ──────────────────────────────────── */

/** Return the material name appropriate for the current locale */
function getLocalizedMaterialName(
  material: Material,
  locale: string,
): string {
  if (locale === 'fi') return material.name_fi || material.name;
  if (locale === 'en') return material.name_en || material.name;
  return material.name;
}

/** Return the material name for a BOM item using the materials list */
function getLocalizedBomItemName(
  item: BomItem,
  materials: Material[],
  locale: string,
): string {
  const mat = materials.find((m) => m.id === item.material_id);
  if (mat) return getLocalizedMaterialName(mat, locale);
  return item.material_name || item.material_id;
}

/** Map a raw unit string (from DB) to locale-appropriate label */
function localizeUnit(unit: string, t: (key: string) => string): string {
  // Normalize: strip accents and lowercase for lookup
  const normalized = unit.replace(/ä/g, 'a').replace(/ö/g, 'o').toLowerCase();
  const translated = t(`units.${normalized}`);
  // If the translation key resolves to itself, return original
  if (translated === `units.${normalized}`) return unit;
  return translated;
}

/* ── Category color palette ─────────────────────────────────── */
const CATEGORY_COLORS: Record<string, string> = {
  "Sahatavara":  "#8B6F47",
  "Lumber":      "#8B6F47",
  "Katto":       "#4A5568",
  "Roofing":     "#4A5568",
  "Eristys":     "#C49058",
  "Insulation":  "#C49058",
  "Perustus":    "#718096",
  "Foundation":  "#718096",
  "Kalvo":       "#4A8B7F",
  "Membrane":    "#4A8B7F",
  "Kiinnitys":   "#A0AEC0",
  "Fasteners":   "#A0AEC0",
  "Sisä":        "#CBD5E0",
  "Interior":    "#CBD5E0",
};
const FALLBACK_COLORS = [
  "#6B7280", "#9CA3AF", "#78716C", "#7C8A6E", "#8E7B6D", "#7A8B99",
];

function getCategoryColor(name: string, idx: number): string {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

/* ── Scene material name normalization ─────────────────────── */
const MATERIAL_ALIASES: Record<string, string[]> = {
  sahatavara: ["lumber", "wood", "puu", "sahatavara", "timber"],
  perustus: ["foundation", "concrete", "betoni", "perustus"],
  eristys: ["insulation", "eriste", "eristys", "insulate"],
  katto: ["roofing", "katto", "roof", "shingle"],
  kalvo: ["membrane", "kalvo", "vapor", "barrier"],
  kiinnitys: ["fasteners", "kiinnitys", "screw", "nail", "bolt"],
  sisä: ["interior", "sisä", "finish", "drywall", "gypsum"],
};

/**
 * Match a scene material name against the materials catalog using
 * fuzzy name + category matching. Returns the best matching Material or null.
 */
function matchSceneMaterial(
  sceneName: string,
  materials: Material[],
): Material | null {
  const lower = sceneName.toLowerCase().trim();

  // 1. Exact match on material name/id
  const exact = materials.find(
    (m) =>
      m.id.toLowerCase() === lower ||
      m.name.toLowerCase() === lower ||
      m.name_fi?.toLowerCase() === lower ||
      m.name_en?.toLowerCase() === lower
  );
  if (exact) return exact;

  // 2. Match via known aliases -> category
  for (const [category, aliases] of Object.entries(MATERIAL_ALIASES)) {
    if (aliases.some((a) => lower.includes(a) || a.includes(lower))) {
      // Find first material in that category
      const catMatch = materials.find((m) =>
        m.category_name?.toLowerCase().includes(category) ||
        (m.category_name_fi?.toLowerCase() || "").includes(category)
      );
      if (catMatch) return catMatch;
    }
  }

  // 3. Substring match on material name
  const partial = materials.find(
    (m) =>
      m.name.toLowerCase().includes(lower) ||
      (m.name_fi?.toLowerCase() || "").includes(lower) ||
      (m.name_en?.toLowerCase() || "").includes(lower) ||
      lower.includes(m.name.toLowerCase())
  );
  if (partial) return partial;

  return null;
}

/* ── Donut chart sub-component ──────────────────────────────── */
interface CategorySlice {
  name: string;
  total: number;
  pct: number;
  color: string;
}

function CostBreakdownChart({
  bom,
  materials,
  total,
}: {
  bom: BomItem[];
  materials: Material[];
  total: number;
}) {
  const { t } = useTranslation();

  const slices = useMemo<CategorySlice[]>(() => {
    if (total <= 0) return [];

    const matCategoryMap = new Map<string, string>();
    for (const m of materials) {
      matCategoryMap.set(m.id, m.category_name);
    }

    const groups = new Map<string, number>();
    for (const item of bom) {
      const cat = item.category_name || matCategoryMap.get(item.material_id) || "Other";
      groups.set(cat, (groups.get(cat) || 0) + Number(item.total || 0));
    }

    const sorted = Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, catTotal], idx) => ({
      name,
      total: catTotal,
      pct: (catTotal / total) * 100,
      color: getCategoryColor(name, idx),
    }));
  }, [bom, materials, total]);

  if (slices.length === 0) return null;

  let cumDeg = 0;
  const stops: string[] = [];
  for (const s of slices) {
    const deg = (s.pct / 100) * 360;
    stops.push(`${s.color} ${cumDeg}deg ${cumDeg + deg}deg`);
    cumDeg += deg;
  }
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "14px 16px",
        background: "var(--bg-tertiary)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="label-mono"
        style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 12 }}
      >
        {t("editor.costBreakdown")}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignItems: "center",
        }}
      >
        {/* Donut */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: gradient,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 18,
              borderRadius: "50%",
              background: "var(--bg-tertiary)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="heading-display"
              style={{ fontSize: 14, lineHeight: 1.1, color: "var(--text-primary)" }}
            >
              {total.toLocaleString("fi-FI", { maximumFractionDigits: 0 })}
            </span>
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>&euro;</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
          {slices.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {s.name}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                  fontSize: 10,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.pct.toFixed(0)}% &middot; {s.total.toLocaleString("fi-FI", { maximumFractionDigits: 0 })}&euro;
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── SVG Sparkline component ───────────────────────────────── */
function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "var(--text-muted)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 2;
  const usableH = height - padY * 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padY + usableH - ((v - min) / range) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Trend badge helper ────────────────────────────────────── */
function computeTrend(
  history: PriceHistoryRow[],
  supplierId: string,
  days: number
): { pctChange: number; direction: "up" | "down" | "stable" } {
  const cutoff = Date.now() - days * 86400000;
  const rows = history
    .filter((h) => h.supplier_id === supplierId && new Date(h.scraped_at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime());

  if (rows.length < 2) return { pctChange: 0, direction: "stable" };

  const oldest = parseFloat(rows[0].unit_price);
  const newest = parseFloat(rows[rows.length - 1].unit_price);
  if (oldest === 0) return { pctChange: 0, direction: "stable" };

  const pct = ((newest - oldest) / oldest) * 100;
  const direction = Math.abs(pct) < 1 ? "stable" : pct > 0 ? "up" : "down";
  return { pctChange: Math.round(pct), direction };
}

/* ── Expanded price history chart ─────────────────────────── */
type TimeRange = "30d" | "90d" | "180d" | "1y";
const TIME_RANGE_DAYS: Record<TimeRange, number> = { "30d": 30, "90d": 90, "180d": 180, "1y": 365 };

function PriceHistoryChart({
  history,
  supplierColors,
}: {
  history: PriceHistoryRow[];
  supplierColors: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>("90d");
  const days = TIME_RANGE_DAYS[range];
  const cutoff = Date.now() - days * 86400000;

  const filtered = useMemo(
    () =>
      history
        .filter((h) => new Date(h.scraped_at).getTime() >= cutoff)
        .sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime()),
    [history, cutoff]
  );

  // Group by supplier
  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; points: { t: number; p: number }[] }>();
    for (const row of filtered) {
      if (!map.has(row.supplier_id)) {
        map.set(row.supplier_id, { name: row.supplier_name, points: [] });
      }
      map.get(row.supplier_id)!.points.push({
        t: new Date(row.scraped_at).getTime(),
        p: parseFloat(row.unit_price),
      });
    }
    return map;
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
        {t("pricing.limitedHistory")}
      </div>
    );
  }

  // Compute chart bounds
  const allPrices = filtered.map((r) => parseFloat(r.unit_price));
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const priceRange = maxP - minP || 1;

  const allTimes = filtered.map((r) => new Date(r.scraped_at).getTime());
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);
  const timeRange = maxT - minT || 1;

  const chartW = 380;
  const chartH = 120;
  const padX = 4;
  const padY = 6;
  const usableW = chartW - padX * 2;
  const usableH = chartH - padY * 2;

  function toSVG(t: number, p: number) {
    const x = padX + ((t - minT) / timeRange) * usableW;
    const y = padY + usableH - ((p - minP) / priceRange) * usableH;
    return { x, y };
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Time range selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {(["30d", "90d", "180d", "1y"] as TimeRange[]).map((r) => (
          <button
            key={r}
            className="category-chip"
            data-active={range === r}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <svg
        width={chartW}
        height={chartH}
        style={{
          width: "100%",
          height: "auto",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
        }}
        viewBox={`0 0 ${chartW} ${chartH}`}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padY + usableH - frac * usableH;
          return (
            <line
              key={frac}
              x1={padX}
              y1={y}
              x2={padX + usableW}
              y2={y}
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
          );
        })}

        {/* Lines per supplier */}
        {Array.from(bySupplier.entries()).map(([suppId, { points }]) => {
          if (points.length < 2) return null;
          const color = supplierColors.get(suppId) || "var(--text-muted)";
          const d = points
            .map((pt, i) => {
              const { x, y } = toSVG(pt.t, pt.p);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <path
              key={suppId}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
        {Array.from(bySupplier.entries()).map(([suppId, { name }]) => (
          <div key={suppId} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
            <span style={{ width: 8, height: 3, borderRadius: 1, background: supplierColors.get(suppId) || "var(--text-muted)", flexShrink: 0 }} />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Supplier chart colors ─────────────────────────────────── */
const SUPPLIER_COLORS = ["#c4915c", "#6a9fb5", "#8b6f47", "#7c8a6e", "#a0665c", "#8e7b9a"];

function PriceComparisonPopup({
  materialId,
  materialName,
  onClose,
}: {
  materialId: string;
  materialName: string;
  onClose: () => void;
}) {
  const [priceData, setPriceData] = useState<MaterialPriceData | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getMaterialPrices(materialId),
      api.getPriceHistory(materialId).catch(() => [] as PriceHistoryRow[]),
    ])
      .then(([data, history]: [MaterialPriceData, PriceHistoryRow[]]) => {
        setPriceData(data);
        setPriceHistory(history);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [materialId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Build supplier color map
  const supplierColors = useMemo(() => {
    const map = new Map<string, string>();
    if (priceData) {
      priceData.prices.forEach((p, i) => {
        map.set(p.supplier_id, SUPPLIER_COLORS[i % SUPPLIER_COLORS.length]);
      });
    }
    return map;
  }, [priceData]);

  // Build sparkline data per supplier (90-day window, chronological)
  const sparklineData = useMemo(() => {
    const map = new Map<string, number[]>();
    const cutoff = Date.now() - 90 * 86400000;
    const sorted = [...priceHistory]
      .filter((h) => new Date(h.scraped_at).getTime() >= cutoff)
      .sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime());
    for (const row of sorted) {
      if (!map.has(row.supplier_id)) map.set(row.supplier_id, []);
      map.get(row.supplier_id)!.push(parseFloat(row.unit_price));
    }
    return map;
  }, [priceHistory]);

  const hasHistory = priceHistory.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={materialName}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        ref={popupRef}
        className="animate-in"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          width: 480,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('pricing.compareTitle')}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{materialName}</div>
          </div>
          <button
            onClick={onClose}
            className="popup-close-btn"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px 8px", lineHeight: 1, borderRadius: "var(--radius-sm)", transition: "color 0.15s ease, background 0.15s ease", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "none"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
              {t('pricing.loading')}
            </div>
          ) : !priceData || priceData.prices.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
              {t('pricing.noSuppliers')}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {priceData.prices.map((price, idx) => {
                const isCheapest = idx === 0;
                const unitPrice = parseFloat(price.unit_price);
                const spark = sparklineData.get(price.supplier_id);
                const trend = computeTrend(priceHistory, price.supplier_id, 30);
                const sparkColor = supplierColors.get(price.supplier_id) || "var(--text-muted)";
                return (
                  <div
                    key={price.id}
                    style={{
                      padding: "14px 16px",
                      background: isCheapest ? "rgba(74, 124, 89, 0.08)" : "var(--bg-tertiary)",
                      border: isCheapest ? "1px solid rgba(74, 124, 89, 0.25)" : "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{price.supplier_name}</span>
                        {isCheapest && (
                          <span
                            className="badge badge-forest"
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            {t('pricing.cheapest')}
                          </span>
                        )}
                        {price.is_primary && (
                          <span
                            className="badge badge-amber"
                            style={{ fontSize: 10, padding: "2px 8px" }}
                          >
                            {t('pricing.primary')}
                          </span>
                        )}
                        {/* Trend badge */}
                        {trend.direction !== "stable" && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              background: trend.direction === "down" ? "rgba(74, 124, 89, 0.12)" : "rgba(239, 68, 68, 0.08)",
                              color: trend.direction === "down" ? "var(--success)" : "var(--danger)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            {trend.direction === "down" ? "\u2193" : "\u2191"}
                            {Math.abs(trend.pctChange)}%
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Sparkline */}
                        {spark && spark.length >= 2 && (
                          <div
                            style={{ cursor: "pointer", opacity: 0.8 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowChart(true);
                            }}
                            title={t("pricing.showTrend")}
                          >
                            <Sparkline data={spark} width={60} height={20} color={sparkColor} />
                          </div>
                        )}
                        <span style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 14,
                          fontWeight: 600,
                          color: isCheapest ? "var(--success)" : "var(--text-primary)",
                        }}>
                          {unitPrice.toFixed(2)} &euro;
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                        <span>{localizeUnit(price.unit, t)} {t('pricing.perUnit')}</span>
                        {price.sku && <span>SKU: {price.sku}</span>}
                        {price.last_scraped_at && (
                          <span>{t('pricing.lastChecked')}: {new Date(price.last_scraped_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {price.link && (
                        <a
                          href={price.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--amber)",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {t('pricing.viewProduct')}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Expanded chart area */}
              {hasHistory && showChart && (
                <PriceHistoryChart history={priceHistory} supplierColors={supplierColors} />
              )}

              {/* Toggle chart button */}
              {hasHistory && (
                <button
                  onClick={() => setShowChart(!showChart)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "all 0.12s ease",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  {showChart ? t("pricing.hideHistory") : t("pricing.showHistory")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer with savings summary */}
        {priceData && priceData.savings_per_unit > 0 && (
          <div style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}>
            <span style={{ color: "var(--text-muted)" }}>
              {t('pricing.savingsLabel')}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--success)" }}>
              -{priceData.savings_per_unit.toFixed(2)} &euro; {t('pricing.perUnit')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── BOM item card with debounced quantity input ──────────── */
function BomItemCard({
  item,
  materials,
  locale,
  index,
  isFocused,
  onRemove,
  onUpdateQty,
  onCompare,
  onNavigate,
  onFocusIndex,
}: {
  item: BomItem;
  materials: Material[];
  locale: string;
  index: number;
  isFocused: boolean;
  onRemove: (materialId: string) => void;
  onUpdateQty: (materialId: string, qty: number) => void;
  onCompare: (id: string, name: string) => void;
  onNavigate: (direction: "up" | "down" | "next") => void;
  onFocusIndex: (index: number) => void;
}) {
  const { t } = useTranslation();
  const [localQty, setLocalQty] = useState(String(item.quantity));
  const [prevQty, setPrevQty] = useState(String(item.quantity));
  const [isEditing, setIsEditing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from props when quantity changes externally
  useEffect(() => {
    setLocalQty(String(item.quantity));
    setPrevQty(String(item.quantity));
  }, [item.quantity]);

  // Focus the card when it becomes the focused index
  useEffect(() => {
    if (isFocused && cardRef.current) {
      // Only focus the card if the input is not already focused
      if (document.activeElement !== inputRef.current) {
        cardRef.current.focus();
      }
    }
  }, [isFocused]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleQtyChange = (val: string) => {
    setLocalQty(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateQty(item.material_id, parseFloat(val) || 0);
    }, 300);
  };

  const handleQtyBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onUpdateQty(item.material_id, parseFloat(localQty) || 0);
    setIsEditing(false);
    setPrevQty(localQty);
  };

  const commitEdit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onUpdateQty(item.material_id, parseFloat(localQty) || 0);
    setIsEditing(false);
    setPrevQty(localQty);
  };

  const cancelEdit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLocalQty(prevQty);
    onUpdateQty(item.material_id, parseFloat(prevQty) || 0);
    setIsEditing(false);
    // Return focus to the card row
    cardRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      onNavigate("next");
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "ArrowUp" && !isEditing) {
      e.preventDefault();
      onNavigate("up");
    } else if (e.key === "ArrowDown" && !isEditing) {
      e.preventDefault();
      onNavigate("down");
    }
    // Stop propagation so card handler doesn't also fire
    e.stopPropagation();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const materialName = getLocalizedBomItemName(item, materials, locale);
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        onNavigate("up");
        break;
      case "ArrowDown":
        e.preventDefault();
        onNavigate("down");
        break;
      case "Tab":
        // Let Tab naturally move to the input, but track focus
        break;
      case "Enter":
        e.preventDefault();
        // Focus the quantity input for editing
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
          setIsEditing(true);
          setPrevQty(localQty);
        }
        break;
      case "Delete":
      case "Backspace":
        // Only trigger remove if focus is on the card, not the input
        if (document.activeElement === cardRef.current) {
          e.preventDefault();
          const confirmed = window.confirm(
            t('editor.confirmRemoveItem', { name: materialName })
          );
          if (confirmed) {
            onRemove(item.material_id);
          }
        }
        break;
      case " ":
        e.preventDefault();
        onCompare(item.material_id, materialName);
        break;
      default:
        break;
    }
  };

  const materialName = getLocalizedBomItemName(item, materials, locale);

  return (
    <div
      ref={cardRef}
      className={`bom-item-card${isFocused ? ' bom-item-focused' : ''}`}
      tabIndex={0}
      role="row"
      aria-label={t('editor.bomItemRow', { name: materialName, qty: localQty, total: Number(item.total || 0).toFixed(2) })}
      data-bom-index={index}
      onClick={() => onCompare(item.material_id, materialName)}
      onFocus={() => onFocusIndex(index)}
      onKeyDown={handleCardKeyDown}
    >
      <div className="bom-item-header">
        <div className="bom-item-info">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={materialName}
              className="bom-item-thumb"
            />
          ) : (
            <div className="bom-item-thumb-placeholder" />
          )}
          <strong className="bom-item-name">{materialName}</strong>
        </div>
        <button
          className="bom-remove-btn"
          tabIndex={-1}
          aria-label={t('editor.removeMaterial', { name: materialName })}
          onClick={(e) => { e.stopPropagation(); onRemove(item.material_id); }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="bom-item-qty-row">
        <input
          ref={inputRef}
          type="number"
          min={0.01}
          step={0.1}
          value={localQty}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => { setIsEditing(true); setPrevQty(localQty); }}
          onChange={(e) => handleQtyChange(e.target.value)}
          onBlur={handleQtyBlur}
          onKeyDown={handleInputKeyDown}
          className="bom-item-qty-input"
          tabIndex={isFocused ? 0 : -1}
          aria-label={t('editor.quantityFor', { name: materialName })}
        />
        <span className="bom-item-unit">
          {localizeUnit(item.unit, t)} x {Number(item.unit_price || 0).toFixed(2)}
        </span>
        <span className="bom-item-total">
          {Number(item.total || 0).toFixed(2)}
        </span>
      </div>
      {item.supplier && (
        <div className="bom-item-supplier">
          {item.supplier}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default function BomPanel({
  bom,
  materials,
  onAdd,
  onRemove,
  onUpdateQty,
  style,
  sceneJs,
}: {
  bom: BomItem[];
  materials: Material[];
  onAdd: (materialId: string, qty: number) => void;
  onRemove: (materialId: string) => void;
  onUpdateQty: (materialId: string, qty: number) => void;
  style?: React.CSSProperties;
  /** Scene script for extracting material declarations */
  sceneJs?: string;
}) {
  const [compareMaterial, setCompareMaterial] = useState<{ id: string; name: string } | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [totalSavings, setTotalSavings] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const [quickAddQty, setQuickAddQty] = useState(1);
  const [focusedBomIndex, setFocusedBomIndex] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const { t, locale } = useTranslation();

  // Navigate between BOM item rows
  const handleBomNavigate = useCallback((fromIndex: number, direction: "up" | "down" | "next") => {
    let targetIndex: number;
    if (direction === "up") {
      targetIndex = Math.max(0, fromIndex - 1);
    } else {
      // "down" or "next" both go forward
      targetIndex = Math.min(bom.length - 1, fromIndex + 1);
    }
    setFocusedBomIndex(targetIndex);
    // Focus the target card's quantity input for "next" (Enter key flow)
    if (direction === "next") {
      requestAnimationFrame(() => {
        const card = document.querySelector<HTMLDivElement>(`[data-bom-index="${targetIndex}"]`);
        const input = card?.querySelector<HTMLInputElement>('.bom-item-qty-input');
        if (input) {
          input.focus();
          input.select();
        }
      });
    }
  }, [bom.length]);

  const total = bom.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const animatedTotal = useAnimatedNumber(total);

  // Extract scene material names that are not yet in the BOM
  const unmatchedSceneMaterials = useMemo(() => {
    if (!sceneJs) return [];
    try {
      const result = interpretScene(sceneJs);
      if (result.error) return [];
      const sceneMatNames = extractSceneMaterials(result.objects);
      const bomMaterialIds = new Set(bom.map((b) => b.material_id));
      const unmatched: { sceneName: string; matched: Material | null }[] = [];
      for (const name of sceneMatNames) {
        const matched = matchSceneMaterial(name, materials);
        if (matched && bomMaterialIds.has(matched.id)) continue; // already in BOM
        unmatched.push({ sceneName: name, matched });
      }
      return unmatched;
    } catch {
      return [];
    }
  }, [sceneJs, bom, materials]);

  const handleSyncFromScene = useCallback(() => {
    for (const { matched } of unmatchedSceneMaterials) {
      if (matched) {
        onAdd(matched.id, 1);
      }
    }
  }, [unmatchedSceneMaterials, onAdd]);

  // Fetch categories on mount
  useEffect(() => {
    api.getCategories()
      .then((data: Category[]) => setCategories(data))
      .catch(() => { /* ignore */ });
  }, []);

  // Price cache: only fetch prices for materials we haven't seen before.
  // Keyed by material_id -> savings_per_unit.
  const priceCacheRef = useRef<Map<string, number>>(new Map());
  const savingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate potential savings across all BOM items.
  // Debounced: waits 1.5s after the last bom change before firing.
  // Cached: only fetches prices for newly-added materials; quantity changes
  // recalculate from cached savings_per_unit without any API calls.
  useEffect(() => {
    if (bom.length === 0) {
      setTotalSavings(0);
      return;
    }

    // Clear any pending debounce timer
    if (savingsTimerRef.current) {
      clearTimeout(savingsTimerRef.current);
    }

    let cancelled = false;

    savingsTimerRef.current = setTimeout(async () => {
      const cache = priceCacheRef.current;
      const newMaterialIds = bom
        .map((item) => item.material_id)
        .filter((id) => !cache.has(id));

      // Fetch prices only for materials not yet in cache
      if (newMaterialIds.length > 0) {
        const fetches = newMaterialIds.map(async (id) => {
          try {
            const data: MaterialPriceData = await api.getMaterialPrices(id);
            cache.set(id, data.savings_per_unit);
          } catch {
            cache.set(id, 0);
          }
        });
        await Promise.all(fetches);
      }

      if (cancelled) return;

      // Recalculate total savings from cache + current quantities
      let savings = 0;
      for (const item of bom) {
        const perUnit = cache.get(item.material_id) ?? 0;
        if (perUnit > 0) {
          savings += perUnit * item.quantity;
        }
      }
      setTotalSavings(savings);
    }, 1500);

    return () => {
      cancelled = true;
      if (savingsTimerRef.current) {
        clearTimeout(savingsTimerRef.current);
      }
    };
  }, [bom]);

  // Filter materials: exclude already-in-BOM, match search query, match category
  const availableMaterials = useMemo(() => {
    return materials
      .filter((m) => !bom.some((b) => b.material_id === m.id))
      .filter((m) => {
        if (!materialSearch.trim()) return true;
        const q = materialSearch.toLowerCase();
        const displayName = getLocalizedMaterialName(m, locale);
        return displayName.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.category_name.toLowerCase().includes(q);
      })
      .filter((m) => {
        if (!activeCategory) return true;
        return m.category_name === activeCategory;
      });
  }, [materials, bom, materialSearch, activeCategory]);

  // Get the display name for a category (locale-aware)
  const getCategoryDisplayName = useCallback((cat: Category) => {
    if (locale === 'fi' && cat.display_name_fi) return cat.display_name_fi;
    return cat.display_name;
  }, [locale]);

  // Get primary pricing info for a material
  const getPrimaryPrice = useCallback((m: Material) => {
    if (!m.pricing || m.pricing.length === 0) return null;
    const primary = m.pricing.find((p) => p.is_primary) || m.pricing[0];
    return primary;
  }, []);

  // Quick-add handler
  const handleQuickAdd = useCallback((materialId: string) => {
    if (quickAddId === materialId) {
      onAdd(materialId, quickAddQty);
      setQuickAddId(null);
      setQuickAddQty(1);
    } else {
      setQuickAddId(materialId);
      setQuickAddQty(1);
    }
  }, [quickAddId, quickAddQty, onAdd]);

  return (
    <div
      className="editor-bom-panel"
      data-tour="bom-panel"
      style={style}
    >
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(180deg, rgba(229,160,75,0.02) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t('editor.materialList')}</h3>
          <span className="label-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {t('editor.bomRowCount', { count: bom.length, suffix: bom.length === 1 ? '' : (locale === 'fi' ? 'a' : 's') })}
          </span>
        </div>
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
        }}>
          <div className="label-mono" style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
            {t('editor.estimatedTotal')}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {animatedTotal > 0 ? Math.round(animatedTotal).toLocaleString('fi-FI', { maximumFractionDigits: 0 }) : '0'}
            </span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>&euro;</span>
            {total > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {t('editor.inclVat')}
              </span>
            )}
          </div>
        </div>
        {totalSavings > 0 && (
          <div
            title={t('pricing.savingsTooltip')}
            style={{
              marginTop: 8,
              padding: "6px 10px",
              background: "rgba(74, 124, 89, 0.08)",
              border: "1px solid rgba(74, 124, 89, 0.2)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>
              {t('pricing.savingsLabel')}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--success)",
            }}>
              -{totalSavings.toFixed(2)} &euro;
            </span>
          </div>
        )}
        {bom.length > 0 && total > 0 && (
          <CostBreakdownChart bom={bom} materials={materials} total={total} />
        )}
      </div>

      {/* Scene material sync banner */}
      {unmatchedSceneMaterials.length > 0 && unmatchedSceneMaterials.some((u) => u.matched) && (
        <div
          style={{
            margin: "0 12px 4px",
            padding: "8px 10px",
            background: "var(--amber-glow)",
            border: "1px solid var(--amber-border)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            animation: "fadeIn 0.2s ease both",
          }}
        >
          <span style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {t('editor.sceneMaterialsDetected', {
              count: unmatchedSceneMaterials.filter((u) => u.matched).length,
            }) || `${unmatchedSceneMaterials.filter((u) => u.matched).length} scene materials not in BOM`}
          </span>
          <button
            onClick={handleSyncFromScene}
            style={{
              background: "none",
              border: "1px solid var(--amber-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--amber)",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 8px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-body)",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--amber-glow)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
          >
            {t('editor.syncFromScene') || 'Add them'}
          </button>
        </div>
      )}

      <div className="bom-list" role="grid" aria-label={t('editor.materialList')}>
        {bom.length === 0 ? (
          <div className="bom-empty anim-up">
            <div className="bom-empty-icon">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="8" width="20" height="20" rx="2" />
                <path d="M6 14h20" />
                <rect x="10" y="18" width="5" height="4" rx="0.5" />
                <rect x="17" y="18" width="5" height="4" rx="0.5" />
                <rect x="10" y="24" width="5" height="2" rx="0.5" />
                <path d="M13 8V5M19 8V5" />
              </svg>
            </div>
            <div className="bom-empty-title">
              {t('editor.noMaterials')}
            </div>
            <div className="bom-empty-hint">
              {t('editor.noMaterialsHint')}
            </div>
            <button
              className="bom-empty-cta"
              onClick={() => {
                const searchInput = document.querySelector<HTMLInputElement>('[placeholder="' + t('pricing.searchMaterials') + '"]');
                if (searchInput) searchInput.focus();
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {t('editor.noMaterialsCta')}
            </button>
          </div>
        ) : (
          bom.map((item, idx) => (
            <BomItemCard
              key={item.material_id}
              item={item}
              materials={materials}
              locale={locale}
              index={idx}
              isFocused={focusedBomIndex === idx}
              onRemove={onRemove}
              onUpdateQty={onUpdateQty}
              onCompare={(id, name) => setCompareMaterial({ id, name })}
              onNavigate={(dir) => handleBomNavigate(idx, dir)}
              onFocusIndex={setFocusedBomIndex}
            />
          ))
        )}
      </div>

      {/* Material browser section */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "10px 12px 0" }}>
          <div
            className="label-mono"
            style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}
          >
            {t('pricing.browseMaterials')}
          </div>

          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('pricing.searchMaterials')}
              style={{
                width: "100%",
                padding: "7px 8px 7px 28px",
                background: "var(--bg-tertiary)",
                border: searchFocused ? "1px solid var(--amber)" : "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: "var(--text-primary)",
                outline: searchFocused ? "1px solid var(--amber)" : "none",
                outlineOffset: "-1px",
              }}
            />
          </div>

          {/* Category filter tabs */}
          {categories.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <button
                className="category-chip"
                data-active={!activeCategory}
                onClick={() => setActiveCategory("")}
              >
                {t('pricing.allCategories')}
              </button>
              {categories.map((cat) => {
                const catName = getCategoryDisplayName(cat);
                const isActive = activeCategory === cat.display_name;
                return (
                  <button
                    key={cat.id}
                    className="category-chip"
                    data-active={isActive}
                    onClick={() => setActiveCategory(isActive ? "" : cat.display_name)}
                  >
                    {catName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Material cards list */}
        <div
          style={{
            maxHeight: 220,
            overflowY: "auto",
            padding: "0 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {availableMaterials.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 8px", color: "var(--text-muted)", fontSize: 12 }}>
              {t('pricing.noResults')}
            </div>
          ) : (
            availableMaterials.map((m) => {
              const price = getPrimaryPrice(m);
              const isSelected = quickAddId === m.id;
              return (
                <div
                  key={m.id}
                  className="material-browse-card"
                  data-selected={isSelected}
                  onClick={() => handleQuickAdd(m.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.image_url ? (
                      <img
                        src={m.image_url}
                        alt={getLocalizedMaterialName(m, locale)}
                        style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "var(--radius-sm)",
                          background: getCategoryColor(m.category_name, 0),
                          opacity: 0.3,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {getLocalizedMaterialName(m, locale)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                        <span style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {locale === 'fi' && m.category_name_fi ? m.category_name_fi : m.category_name}
                        </span>
                        {price && (
                          <>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>&middot;</span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {price.supplier_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {price ? (
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--success)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {Number(price.unit_price).toFixed(2)} &euro;
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                        --
                      </span>
                    )}
                  </div>

                  {/* Quick-add row: shown when this card is selected */}
                  {isSelected && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: "1px solid var(--border)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                        {t('pricing.setQuantity')}
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={quickAddQty}
                        onChange={(e) => setQuickAddQty(parseInt(e.target.value) || 1)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onAdd(m.id, quickAddQty);
                            setQuickAddId(null);
                            setQuickAddQty(1);
                          }
                        }}
                        style={{
                          width: 52,
                          padding: "3px 6px",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 12,
                          color: "var(--text-primary)",
                          outline: "none",
                          fontFamily: "var(--font-mono)",
                        }}
                      />
                      {price && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {localizeUnit(price.unit, t)}
                        </span>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          onAdd(m.id, quickAddQty);
                          setQuickAddId(null);
                          setQuickAddQty(1);
                        }}
                        style={{
                          marginLeft: "auto",
                          padding: "3px 10px",
                          fontSize: 11,
                        }}
                      >
                        {t('editor.add')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Price comparison popup */}
      {compareMaterial && (
        <PriceComparisonPopup
          materialId={compareMaterial.id}
          materialName={compareMaterial.name}
          onClose={() => setCompareMaterial(null)}
        />
      )}
    </div>
  );
}
