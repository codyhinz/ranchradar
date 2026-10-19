import { useEffect, useState } from 'react';
import { guessLocale, NAME_LOCALES, type NameLocale } from '../catalog';

/** A small localStorage-backed preference; falls back to memory if storage is blocked. */
function usePreference<T extends string>(key: string, allowed: readonly T[], fallback: () => T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch { /* storage unavailable */ }
    return fallback();
  });
  return [
    value,
    (next) => {
      setValue(next);
      try { localStorage.setItem(key, next); } catch { /* keep for this session only */ }
    },
  ];
}

export function useNameLocale() {
  return usePreference<NameLocale>('ranchradar:name-locale', NAME_LOCALES, () =>
    guessLocale(navigator.languages ?? [navigator.language]),
  );
}

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** "system" follows the device; light/dark pin it via data-theme on <html>. */
export function useTheme() {
  const [theme, setTheme] = usePreference<Theme>('ranchradar:theme', THEMES, () => 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
  return [theme, setTheme] as const;
}

export const ROSTER_VIEWS = ['grid', 'list'] as const;
export type RosterView = (typeof ROSTER_VIEWS)[number];

export function useRosterView() {
  return usePreference<RosterView>('ranchradar:roster-view', ROSTER_VIEWS, () => 'grid');
}
