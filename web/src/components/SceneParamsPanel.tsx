"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { SceneParam } from "@/lib/scene-interpreter";
import { useTranslation } from "@/components/LocaleProvider";

interface SceneParamsPanelProps {
  params: SceneParam[];
  onParamChange: (name: string, value: number) => void;
}

export default function SceneParamsPanel({
  params,
  onParamChange,
}: SceneParamsPanelProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sections = useMemo(() => {
    const map = new Map<string, SceneParam[]>();
    for (const p of params) {
      const list = map.get(p.section) || [];
      list.push(p);
      map.set(p.section, list);
    }
    return map;
  }, [params]);

  const handleChange = useCallback(
    (name: string, value: number) => {
      if (debounceRefs.current[name]) clearTimeout(debounceRefs.current[name]);
      debounceRefs.current[name] = setTimeout(() => {
        onParamChange(name, value);
      }, 16);
    },
    [onParamChange],
  );

  if (params.length === 0) return null;

  return (
    <div className="scene-params-panel">
      <div className="scene-params-header">
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
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        <span>{t("editor.parameters")}</span>
        <span className="scene-params-count">{params.length}</span>
      </div>
      <div className="scene-params-body">
        {Array.from(sections.entries()).map(([section, sectionParams]) => (
          <div key={section} className="scene-params-section">
            <button
              className="scene-params-section-toggle"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [section]: !prev[section],
                }))
              }
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: collapsed[section]
                    ? "rotate(-90deg)"
                    : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>{section}</span>
              <span className="scene-params-section-count">
                {sectionParams.length}
              </span>
            </button>
            <div
              className="scene-params-section-body"
              data-open={!collapsed[section]}
            >
              <div className="scene-params-section-body-inner">
                <div className="scene-params-items">
                  {sectionParams.map((p) => (
                    <ParamSlider
                      key={p.name}
                      param={p}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParamSlider({
  param,
  onChange,
}: {
  param: SceneParam;
  onChange: (name: string, value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(param.value);
  const [dragging, setDragging] = useState(false);

  const handleInput = (val: number) => {
    const clamped = Math.min(param.max, Math.max(param.min, val));
    setLocalValue(clamped);
    onChange(param.name, clamped);
  };

  const pct =
    param.max === param.min
      ? 100
      : ((localValue - param.min) / (param.max - param.min)) * 100;

  const displayValue =
    param.step >= 1
      ? String(Math.round(localValue))
      : localValue.toFixed(Math.max(0, -Math.floor(Math.log10(param.step))));

  return (
    <div className="scene-param-item">
      <div className="scene-param-label-row">
        <label className="scene-param-label">{param.label}</label>
        <input
          type="number"
          className="scene-param-value"
          value={localValue}
          min={param.min}
          max={param.max}
          step={param.step}
          aria-label={param.label}
          onChange={(e) => handleInput(parseFloat(e.target.value) || param.min)}
        />
      </div>
      <div className="scene-param-slider-wrap">
        <span
          className="scene-param-slider-tooltip"
          data-visible={dragging}
          style={{ left: `${pct}%` }}
        >
          {displayValue}
        </span>
        <input
          type="range"
          className="scene-param-slider"
          min={param.min}
          max={param.max}
          step={param.step}
          value={localValue}
          disabled={param.max === param.min}
          aria-label={param.label}
          aria-valuemin={param.min}
          aria-valuemax={param.max}
          aria-valuenow={localValue}
          onChange={(e) => handleInput(parseFloat(e.target.value))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          style={
            {
              "--pct": `${pct}%`,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
