"use client";

import { useState, useEffect, useRef } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: string; // SVG path d attribute
  onClick: () => void;
  /** If true, show as active/toggled */
  active?: boolean;
}

interface ViewportContextMenuProps {
  items: ContextMenuItem[];
  /** Position to open at (clientX, clientY) */
  position: { x: number; y: number } | null;
  onClose: () => void;
}

/** Radius of the radial menu ring in pixels */
const RING_RADIUS = 72;
/** Size of each action button */
const BUTTON_SIZE = 44;

export default function ViewportContextMenu({ items, position, onClose }: ViewportContextMenuProps) {
  const [visible, setVisible] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (position) {
      requestAnimationFrame(() => setVisible(true));
      setFocusedIndex(0);
    } else {
      setVisible(false);
    }
  }, [position]);

  useEffect(() => {
    if (visible && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]!.focus();
    }
  }, [visible, focusedIndex]);

  useEffect(() => {
    if (!position) return;
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % items.length);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          items[focusedIndex]?.onClick();
          onClose();
          break;
      }
    }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [position, onClose, items, focusedIndex]);

  if (!position) return null;

  // Calculate adjusted position to keep menu in viewport
  const menuSize = RING_RADIUS * 2 + BUTTON_SIZE + 20;
  const halfMenu = menuSize / 2;
  const adjustedX = Math.max(halfMenu, Math.min(window.innerWidth - halfMenu, position.x));
  const adjustedY = Math.max(halfMenu, Math.min(window.innerHeight - halfMenu, position.y));

  // Distribute items evenly in a circle
  const angleStep = (2 * Math.PI) / items.length;
  // Start from top (-PI/2) and go clockwise
  const startAngle = -Math.PI / 2;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Viewport actions"
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        zIndex: 200,
        pointerEvents: "auto",
        transform: "translate(-50%, -50%)",
        outline: "none",
      }}
    >
      {/* Center dot */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--amber)",
          transform: "translate(-50%, -50%)",
          opacity: visible ? 0.6 : 0,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Radial items */}
      {items.map((item, i) => {
        const angle = startAngle + i * angleStep;
        const x = Math.cos(angle) * RING_RADIUS;
        const y = Math.sin(angle) * RING_RADIUS;
        const isFocused = focusedIndex === i;
        const isHovered = hoveredId === item.id || isFocused;

        return (
          <div
            key={item.id}
            style={{
              position: "absolute",
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: visible
                ? `translate(-50%, -50%) scale(1)`
                : `translate(-50%, -50%) scale(0.3)`,
              opacity: visible ? 1 : 0,
              transition: `transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) ${i * 30}ms, opacity 0.2s ease ${i * 30}ms`,
            }}
          >
            <button
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              tabIndex={isFocused ? 0 : -1}
              aria-label={item.label}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              onMouseEnter={() => { setHoveredId(item.id); setFocusedIndex(i); }}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setFocusedIndex(i)}
              style={{
                width: BUTTON_SIZE,
                height: BUTTON_SIZE,
                borderRadius: "50%",
                border: `1px solid ${item.active ? "var(--amber-border)" : "var(--surface-border-float)"}`,
                background: item.active
                  ? "var(--amber-glow)"
                  : isHovered
                  ? "var(--bg-hover)"
                  : "var(--surface-float)",
                color: item.active ? "var(--amber)" : isHovered ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                boxShadow: isHovered
                  ? "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px var(--amber-border)"
                  : "var(--shadow-md)",
                backdropFilter: "blur(16px)",
                transition: "all 0.15s ease",
                transform: isHovered ? "scale(1.15)" : "scale(1)",
                outline: "none",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
            </button>
            {/* Label tooltip — position based on quadrant */}
            {isHovered && (() => {
              const isTop = y < -BUTTON_SIZE / 4;
              const isBottom = y > BUTTON_SIZE / 4;
              const isLeft = x < -BUTTON_SIZE / 4;
              const isRight = x > BUTTON_SIZE / 4;
              const tooltipStyle: React.CSSProperties = {
                position: "absolute",
                whiteSpace: "nowrap",
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: 11,
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                color: "var(--text-primary)",
                background: "var(--surface-float)",
                border: "1px solid var(--surface-border-float)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 8px",
                boxShadow: "var(--shadow-md)",
                pointerEvents: "none",
                animation: "fadeIn 0.1s ease",
              };
              if (isLeft && !isTop && !isBottom) {
                Object.assign(tooltipStyle, { right: BUTTON_SIZE + 8, top: "50%", transform: "translateY(-50%)" });
              } else if (isRight && !isTop && !isBottom) {
                Object.assign(tooltipStyle, { left: BUTTON_SIZE + 8, top: "50%", transform: "translateY(-50%)" });
              } else if (isTop) {
                Object.assign(tooltipStyle, { left: "50%", bottom: BUTTON_SIZE + 8, transform: "translateX(-50%)" });
              } else {
                Object.assign(tooltipStyle, { left: "50%", top: BUTTON_SIZE + 8, transform: "translateX(-50%)" });
              }
              return <div style={tooltipStyle}>{item.label}</div>;
            })()}
          </div>
        );
      })}
    </div>
  );
}
