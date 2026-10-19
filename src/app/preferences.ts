import { useState } from 'react';
import { guessLocale, NAME_LOCALES, type NameLocale } from '../catalog';

const KEY = 'ranchradar:name-locale';

function read(): NameLocale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (NAME_LOCALES as readonly string[]).includes(saved)) return saved as NameLocale;
  } catch { /* storage unavailable: fall through */ }
  return guessLocale(navigator.languages ?? [navigator.language]);
}

export function useNameLocale(): [NameLocale, (locale: NameLocale) => void] {
  const [locale, setLocale] = useState<NameLocale>(read);
  return [
    locale,
    (next) => {
      setLocale(next);
      try { localStorage.setItem(KEY, next); } catch { /* keep it for this session only */ }
    },
  ];
}
