"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { hi } from "./hi";

/**
 * The portal's language (GLB-04).
 *
 * Strings are keyed by their English text, so a screen opts in by passing what
 * it already says through `t()`, and a string with no translation shows in
 * English rather than as a key. The shell — navigation, page headers, panel
 * headings — goes through `t()`, so a translated language changes every page's
 * frame at once. Numbers and dates are en-IN everywhere already.
 */

export type Locale = "en" | "hi";

export const LOCALES: { code: Locale; label: string; english: string }[] = [
  { code: "en", label: "English", english: "English" },
  { code: "hi", label: "हिन्दी", english: "Hindi" },
];

const DICTIONARIES: Record<Locale, Record<string, string>> = { en: {}, hi };
const STORAGE_KEY = "askmira_locale";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
}

const LocaleContext = createContext<LocaleState>({
  locale: "en",
  setLocale: () => {},
  t: (text) => text,
});

function stored(): Locale {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(stored());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "hi" ? "hi" : "en";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A browser that refuses storage still switches for this visit.
    }
  }, []);

  const value = useMemo<LocaleState>(() => {
    const dictionary = DICTIONARIES[locale];
    return { locale, setLocale, t: (text: string) => dictionary[text] ?? text };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** `t(english)` in the person's language, or the English when not translated. */
export function useT(): (text: string) => string {
  return useContext(LocaleContext).t;
}

export function useLocale(): LocaleState {
  return useContext(LocaleContext);
}
