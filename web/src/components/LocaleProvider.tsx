"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type Locale, getTranslation, detectLocale, persistLocale } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fi");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const detected = detectLocale();
    setLocaleState(detected);
    document.documentElement.lang = detected;
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    persistLocale(newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return getTranslation(locale)(key, params);
    },
    [locale]
  );

  // Avoid hydration mismatch by not rendering until client-side locale is detected
  if (!mounted) {
    return null;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within a LocaleProvider");
  }
  return ctx;
}
