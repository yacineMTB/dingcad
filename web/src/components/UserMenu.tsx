"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { setToken } from "@/lib/api";
import { useTranslation } from "@/components/LocaleProvider";
import Link from "next/link";

function UserAvatar({ name, onClick, expanded }: { name: string; onClick?: () => void; expanded: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      aria-label={`User menu for ${name}`}
      aria-haspopup="true"
      aria-expanded={expanded}
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "var(--amber-glow)",
        border: "1px solid var(--amber-border)",
        color: "var(--amber)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
        outline: "none",
      }}
      className="avatar-btn"
    >
      {initials || "?"}
    </button>
  );
}

export default function UserMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeMenu]);

  return (
    <div style={{ position: "relative" }} ref={triggerRef}>
      <UserAvatar name={userName} onClick={() => setOpen(!open)} expanded={open} />
      {open && (
        <>
          {/* Backdrop to close menu */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 100 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card anim-fade"
            role="menu"
            aria-label={`${userName} menu`}
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              minWidth: 180,
              padding: "6px",
              zIndex: 200,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
                borderBottom: "1px solid var(--border)",
                marginBottom: 4,
              }}
            >
              {userName}
            </div>
            <Link
              href="/settings"
              className="menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {t("nav.settings")}
            </Link>
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setToken(null);
                window.location.reload();
              }}
            >
              {t("nav.logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
