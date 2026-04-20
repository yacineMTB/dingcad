"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

type ThemeChoice = "dark" | "light" | "auto";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolved: "dark" | "light";
  toggle: () => void;
  setTheme: (t: ThemeChoice) => void;
}

const STORAGE_KEY = "helscoop-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolved: "dark",
  toggle: () => {},
  setTheme: () => {},
});

function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean
): "dark" | "light" {
  if (choice === "auto") return prefersDark ? "dark" : "light";
  return choice;
}

const CYCLE: ThemeChoice[] = ["dark", "light", "auto"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("dark");
  const [prefersDark, setPrefersDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    if (stored && CYCLE.includes(stored)) {
      setThemeState(stored);
    }
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolved = resolveTheme(theme, prefersDark);

  useEffect(() => {
    document.documentElement.classList.add("theme-transitioning");
    document.documentElement.setAttribute("data-theme", resolved);
    const id = setTimeout(() => {
      document.documentElement.classList.remove("theme-transitioning");
    }, 350);
    return () => clearTimeout(id);
  }, [resolved]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const idx = CYCLE.indexOf(prev);
      const next = CYCLE[(idx + 1) % CYCLE.length];
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
