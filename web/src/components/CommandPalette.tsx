"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "@/components/LocaleProvider";

/** Command category for grouping in the palette */
export type CommandCategory = "scene" | "project" | "preferences";

export interface Command {
  /** Unique identifier */
  id: string;
  /** i18n key for the command label */
  labelKey: string;
  /** i18n key for the secondary (English) label shown below */
  labelSecondaryKey?: string;
  /** Keyboard shortcut display string, e.g. "Cmd+B" */
  shortcut?: string;
  /** SVG icon as JSX */
  icon?: React.ReactNode;
  /** Action to run when the command is selected */
  action: () => void;
  /** Category for grouped display */
  category?: CommandCategory;
}

const RECENT_COMMANDS_KEY = "helscoop_recent_commands";
const MAX_RECENT = 3;

/** Category display order */
const CATEGORY_ORDER: CommandCategory[] = ["scene", "project", "preferences"];

/** Infer category from command id if not explicitly set */
function inferCategory(id: string): CommandCategory {
  if (
    id === "toggle-wireframe" ||
    id === "reset-camera" ||
    id === "toggle-code-editor" ||
    id === "show-docs"
  ) return "scene";
  if (
    id === "save" ||
    id === "share-project" ||
    id === "export-pdf" ||
    id === "export-project" ||
    id === "toggle-bom"
  ) return "project";
  return "preferences";
}

/** Category label i18n keys */
const CATEGORY_LABEL_KEYS: Record<CommandCategory, string> = {
  scene: "commandPalette.categoryScene",
  project: "commandPalette.categoryProject",
  preferences: "commandPalette.categoryPreferences",
};

/** Fallback category labels */
const CATEGORY_LABELS_FALLBACK: Record<CommandCategory, string> = {
  scene: "Scene",
  project: "Project",
  preferences: "Preferences",
};

/**
 * Detect whether the user is on macOS to show the correct modifier symbol.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

function formatShortcutDisplay(shortcut: string): string {
  const isMac = isMacPlatform();
  if (isMac) {
    return shortcut
      .replace("Cmd+Shift+", "\u2318\u21E7")
      .replace("Cmd+", "\u2318")
      .replace("Ctrl+", "\u2303")
      .replace("Enter", "\u23CE");
  }
  return shortcut.replace("Cmd+", "Ctrl+");
}

/**
 * Simple fuzzy match: all characters of the query must appear in order
 * in the target string. Returns a score (lower = better) or -1 for no match.
 */
function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastMatch = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for consecutive matches
      score += ti - lastMatch === 1 ? 0 : ti - lastMatch;
      lastMatch = ti;
      qi++;
    }
  }

  return qi === q.length ? score : -1;
}

function getRecentCommandIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentCommandId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentCommandIds().filter((x) => x !== id);
    const updated = [id, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Recent command ids from localStorage
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Load recent commands when palette opens
  useEffect(() => {
    if (open) {
      setRecentIds(getRecentCommandIds());
    }
  }, [open]);

  // Build the display list: when no query, show Recent + grouped categories
  // When searching, show flat filtered results
  const { displayItems, flatCommands } = useMemo(() => {
    if (query.trim()) {
      // Fuzzy search mode: flat list, no groups
      const results: { command: Command; score: number }[] = [];
      for (const cmd of commands) {
        const primary = t(cmd.labelKey);
        const secondary = cmd.labelSecondaryKey ? t(cmd.labelSecondaryKey) : "";
        const scorePrimary = fuzzyMatch(query, primary);
        const scoreSecondary = secondary ? fuzzyMatch(query, secondary) : -1;
        const scoreId = fuzzyMatch(query, cmd.id);

        const bestScore = Math.min(
          ...[scorePrimary, scoreSecondary, scoreId].filter((s) => s >= 0),
          Infinity
        );

        if (bestScore < Infinity) {
          results.push({ command: cmd, score: bestScore });
        }
      }
      results.sort((a, b) => a.score - b.score);
      const flat = results.map((r) => r.command);
      return {
        displayItems: flat.map((cmd) => ({ type: "command" as const, command: cmd })),
        flatCommands: flat,
      };
    }

    // No query: show Recent section + categorized groups
    const items: Array<
      | { type: "header"; label: string }
      | { type: "command"; command: Command }
    > = [];
    const flat: Command[] = [];

    // Recent section
    const recentCommands = recentIds
      .map((id) => commands.find((c) => c.id === id))
      .filter((c): c is Command => !!c);

    if (recentCommands.length > 0) {
      items.push({ type: "header", label: t("commandPalette.categoryRecent") || "Recent" });
      for (const cmd of recentCommands) {
        items.push({ type: "command", command: cmd });
        flat.push(cmd);
      }
    }

    // Group commands by category
    const grouped = new Map<CommandCategory, Command[]>();
    for (const cat of CATEGORY_ORDER) {
      grouped.set(cat, []);
    }
    for (const cmd of commands) {
      const cat = cmd.category || inferCategory(cmd.id);
      const list = grouped.get(cat);
      if (list) {
        // Skip if already shown in recents
        if (!recentIds.includes(cmd.id)) {
          list.push(cmd);
        }
      }
    }

    for (const cat of CATEGORY_ORDER) {
      const cmds = grouped.get(cat) || [];
      if (cmds.length === 0) continue;
      const label = t(CATEGORY_LABEL_KEYS[cat]) || CATEGORY_LABELS_FALLBACK[cat];
      items.push({ type: "header", label });
      for (const cmd of cmds) {
        items.push({ type: "command", command: cmd });
        flat.push(cmd);
      }
    }

    return { displayItems: items, flatCommands: flat };
  }, [query, commands, t, recentIds]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatCommands.length, query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-cmd-item]");
    const item = items[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: Command) => {
      saveRecentCommandId(cmd.id);
      onClose();
      requestAnimationFrame(() => {
        cmd.action();
      });
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % Math.max(flatCommands.length, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) =>
            i <= 0 ? Math.max(flatCommands.length - 1, 0) : i - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            executeCommand(flatCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatCommands, selectedIndex, executeCommand, onClose]
  );

  if (!open) return null;

  // Map flatCommands index to display items
  let commandIndex = 0;

  return (
    <div
      className="cmd-palette-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === backdropRef.current) {
          onClose();
        }
      }}
    >
      <div className="cmd-palette-backdrop" ref={backdropRef} />
      <div
        className="cmd-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPalette.title")}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="cmd-palette-input-wrap">
          <svg
            className="cmd-palette-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.placeholder")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="cmd-palette-esc">Esc</kbd>
        </div>

        {/* Command list */}
        <div className="cmd-palette-list" ref={listRef}>
          {flatCommands.length === 0 && (
            <div className="cmd-palette-empty">
              {t("commandPalette.noResults")}
            </div>
          )}
          {displayItems.map((item, displayIdx) => {
            if (item.type === "header") {
              return (
                <div
                  key={`header-${displayIdx}`}
                  className="cmd-palette-group-header"
                >
                  {item.label}
                </div>
              );
            }

            const cmd = item.command;
            const idx = commandIndex++;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={cmd.id + "-" + idx}
                data-cmd-item
                className={`cmd-palette-item${isSelected ? " cmd-palette-item-selected" : ""}`}
                data-selected={isSelected}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => executeCommand(cmd)}
              >
                <div className="cmd-palette-item-left">
                  {cmd.icon && (
                    <span className="cmd-palette-item-icon">{cmd.icon}</span>
                  )}
                  <div className="cmd-palette-item-labels">
                    <span className="cmd-palette-item-label">
                      {t(cmd.labelKey)}
                    </span>
                    {cmd.labelSecondaryKey &&
                      t(cmd.labelSecondaryKey) !== t(cmd.labelKey) && (
                      <span className="cmd-palette-item-label-secondary">
                        {t(cmd.labelSecondaryKey)}
                      </span>
                    )}
                  </div>
                </div>
                {cmd.shortcut && (
                  <kbd className="cmd-palette-kbd">
                    {formatShortcutDisplay(cmd.shortcut)}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="cmd-palette-footer">
          <span>
            <kbd className="cmd-palette-footer-kbd">&uarr;&darr;</kbd>{" "}
            {t("commandPalette.navigate")}
          </span>
          <span>
            <kbd className="cmd-palette-footer-kbd">&crarr;</kbd>{" "}
            {t("commandPalette.execute")}
          </span>
          <span>
            <kbd className="cmd-palette-footer-kbd">Esc</kbd>{" "}
            {t("commandPalette.close")}
          </span>
        </div>
      </div>
    </div>
  );
}
