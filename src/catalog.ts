import forms from '../data/generated/forms.json';
import formNames from '../data/generated/form-names.json';
import mc from '../data/regulations/M-C.json';
import variantData from '../data/generated/variants.json';

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
  }));

export const catalogById = new Map(catalog.map((f) => [f.id, f]));

/** Every form ever shipped, including ones not in this season, for sorting and filtering a roster. */
const allFormsById = new Map(forms.map((f) => [f.id, f]));
export function dexNumberOf(formId: string): number {
  return allFormsById.get(formId)?.dex_number ?? Number.MAX_SAFE_INTEGER;
}
export function typesOf(formId: string): string[] {
  return allFormsById.get(formId)?.types ?? [];
}

export interface CatalogVariant {
  id: string;
  names: Partial<Record<NameLocale, string>>;
}

const variantsByForm = variantData as Record<string, CatalogVariant[]>;
const variantById = new Map(Object.values(variantsByForm).flat().map((v) => [v.id, v]));

/** Cosmetic versions of a form, in game order; empty for forms without any. */
export function variantsOf(formId: string): CatalogVariant[] {
  return variantsByForm[formId] ?? [];
}

export function variantName(variantId: string, locale: NameLocale): string {
  const variant = variantById.get(variantId);
  return variant?.names[locale] ?? variant?.names.en ?? variantId;
}

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

const NON_LATIN = new Set<NameLocale>(['ja', 'ko', 'zh-Hant', 'zh-Hans']);

/** Normalized display names per locale, built once per locale on first search. */
const keyCache = new Map<NameLocale, Map<string, string>>();
function searchKey(form: CatalogForm, locale: NameLocale): string {
  let keys = keyCache.get(locale);
  if (!keys) { keys = new Map(); keyCache.set(locale, keys); }
  let key = keys.get(form.id);
  if (key === undefined) {
    key = normalize(displayName(form.id, locale));
    // In Japanese, Korean and Chinese, Latin-letter tags ("Aqua", "Hisuian Form") are only there to tell
    // forms apart on screen; leave them out of matching so typing "b" never finds a Latin word.
    if (NON_LATIN.has(locale)) key = key.replace(/[a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    keys.set(form.id, key);
  }
  return key;
}

/**
 * Searches the name shown in the chosen language only, like a normal search box:
 * names starting with the query first ("z" → Zoroark), then names with a word starting
 * with it ("nine" → Alolan Ninetales). Matches inside a word only kick in from 3 letters.
 */
export function searchForms(query: string, locale: NameLocale, pool: CatalogForm[] = catalog): CatalogForm[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: CatalogForm[] = [];
  const wordStarts: CatalogForm[] = [];
  const inside: CatalogForm[] = [];
  for (const form of pool) {
    const key = searchKey(form, locale);
    if (key.startsWith(q)) starts.push(form);
    else if (key.split(' ').some((word) => word.startsWith(q))) wordStarts.push(form);
    else if (q.length >= 3 && key.includes(q)) inside.push(form);
  }
  const byName = (a: CatalogForm, b: CatalogForm) => searchKey(a, locale).localeCompare(searchKey(b, locale), locale);
  return [...starts.sort(byName), ...wordStarts.sort(byName), ...inside.sort(byName)];
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
