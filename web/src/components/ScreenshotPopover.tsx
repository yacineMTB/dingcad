"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@/components/LocaleProvider";

interface ScreenshotPopoverProps {
  /** Base64 data URL of the captured screenshot */
  imageDataUrl: string | null;
  /** Project name for download filename */
  projectName?: string;
  /** Called when the popover closes */
  onClose: () => void;
}

export default function ScreenshotPopover({
  imageDataUrl,
  projectName,
  onClose,
}: ScreenshotPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (imageDataUrl) {
      requestAnimationFrame(() => setVisible(true));
      setCopied(false);
    } else {
      setVisible(false);
    }
  }, [imageDataUrl]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!imageDataUrl) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    // Delay adding click listener to avoid closing immediately on the triggering click
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
      clearTimeout(timer);
    };
  }, [imageDataUrl, onClose]);

  const handleDownload = useCallback(() => {
    if (!imageDataUrl) return;
    const safeName = (projectName || "screenshot").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const link = document.createElement("a");
    link.download = `helscoop-${safeName}-${timestamp}.png`;
    link.href = imageDataUrl;
    link.click();
  }, [imageDataUrl, projectName]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!imageDataUrl) return;
    try {
      // Convert data URL to blob
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: try to copy as text (some browsers don't support ClipboardItem)
      try {
        await navigator.clipboard.writeText(imageDataUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silently fail
      }
    }
  }, [imageDataUrl]);

  if (!imageDataUrl) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        top: 48,
        right: 12,
        zIndex: 100,
        background: "var(--surface-float)",
        border: "1px solid var(--surface-border-float)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
        backdropFilter: "blur(16px)",
        overflow: "hidden",
        transform: visible ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.95)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
        maxWidth: 320,
        width: "100%",
      }}
    >
      {/* Preview image */}
      <div
        style={{
          padding: 8,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <img
          src={imageDataUrl}
          alt="Screenshot preview"
          style={{
            width: "100%",
            borderRadius: "var(--radius-md)",
            display: "block",
          }}
        />
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          gap: 8,
        }}
      >
        <button
          onClick={handleDownload}
          className="btn btn-ghost"
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t("screenshot.download")}
        </button>
        <button
          onClick={handleCopyToClipboard}
          className="btn btn-primary"
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {t("screenshot.copied")}
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {t("screenshot.copy")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
