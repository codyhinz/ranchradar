import forms from '../data/generated/forms.json';
import formNames from '../data/generated/form-names.json';
import mc from '../data/regulations/M-C.json';

export const NAME_LOCALES = ['en', 'ja', 'ko', 'zh-Hant', 'zh-Hans', 'fr', 'de', 'es', 'it'] as const;
export type NameLocale = (typeof NAME_LOCALES)[number];

export const LOCALE_LABELS: Record<NameLocale, string> = {
  en: 'English', ja: '日本語', ko: '한국어', 'zh-Hant': '繁體中文', 'zh-Hans': '简体中文',
  fr: 'Français', de: 'Deutsch', es: 'Español', it: 'Italiano',
};

export interface CatalogForm {
  id: string;
  dexNumber: number;
  types: string[];
  names: Partial<Record<NameLocale, string>>;
  /** Every name, normalized, for matching. */
  searchKeys: string[];
}

const names = formNames as Record<string, Partial<Record<NameLocale, string>>>;

/** The regulation in effect: the one whose dates contain today, else the latest. */
const regulations = [mc];
export const currentRegulation =
  regulations.find((r) => Date.now() >= Date.parse(r.starts_at) && Date.now() < Date.parse(r.ends_at)) ??
  regulations[regulations.length - 1]!;

const legal = new Set(currentRegulation.forms);

export const catalog: CatalogForm[] = forms
  .filter((f) => legal.has(f.id))
  .map((f) => ({
    id: f.id,
    dexNumber: f.dex_number,
    types: f.types,
    names: names[f.id] ?? {},
    searchKeys: [f.id.replace(/-/g, ' '), ...Object.values(names[f.id] ?? {})].map(normalize),
  }));

export const catalogById = new Map(catalog.map((f) => [f.id, f]));

export function displayName(formId: string, locale: NameLocale): string {
  const form = catalogById.get(formId);
  const fallback = names[formId];
  return form?.names[locale] ?? form?.names.en ?? fallback?.en ?? formId;
}

/**
 * Lowercases, strips accents, folds full-width characters and turns hiragana into
 * katakana, so "flabebe" finds Flabébé and "がぶりあす" finds ガブリアス.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFKC')
    .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .toLowerCase()
    .replace(/[\s\-_.'’()]+/g, ' ')
    .trim();
}

/** Prefix matches first, then matches anywhere; dex order within each group. */
export function searchForms(query: string, pool: CatalogForm[] = catalog): CatalogForm[] {
  const q = normalize(query);
  if (!q) return [];
  const prefix: CatalogForm[] = [];
  const anywhere: CatalogForm[] = [];
  for (const form of pool) {
    if (form.searchKeys.some((k) => k.startsWith(q) || k.split(' ').some((w) => w.startsWith(q)))) prefix.push(form);
    else if (form.searchKeys.some((k) => k.includes(q))) anywhere.push(form);
  }
  return [...prefix, ...anywhere];
}

export function guessLocale(languages: readonly string[]): NameLocale {
  for (const tag of languages) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) return /hant|tw|hk|mo/.test(lower) ? 'zh-Hant' : 'zh-Hans';
    const base = lower.split('-')[0] as NameLocale;
    if ((NAME_LOCALES as readonly string[]).includes(base)) return base;
  }
  return 'en';
}
