"use client";

import { useState } from "react";
import { setToken } from "@/lib/api";
import { useTranslation } from "@/components/LocaleProvider";
import Link from "next/link";

function UserAvatar({ name, onClick }: { name: string; onClick?: () => void }) {
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

  return (
    <div style={{ position: "relative" }}>
      <UserAvatar name={userName} onClick={() => setOpen(!open)} />
      {open && (
        <>
          {/* Backdrop to close menu */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 100 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card anim-fade"
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
              onClick={() => setOpen(false)}
            >
              {t("nav.settings")}
            </Link>
            <button
              className="menu-item"
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
