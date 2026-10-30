import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** "Ninetales-Alola" → "ninetales-alola", "Mr. Mime" → "mr-mime", "Garchompite Z" → "garchompite-z". */
export function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // é → e
    .toLowerCase()
    .replace(/[♀]/g, '-f')
    .replace(/[♂]/g, '-m')
    .replace(/['’.:%]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');

/** Locales the app ships names for (BCP 47). */
export const LOCALES = ['en', 'ja', 'ko', 'zh-Hant', 'zh-Hans', 'fr', 'de', 'es', 'it'] as const;
export type Locale = (typeof LOCALES)[number];

export interface RegulationFile {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  /** "draft" while the list is still being filled in; "final" once it matches the announcement. */
  status: 'draft' | 'final';
  /** Published total of legal Pokémon, checked once status is "final". */
  expected_forms: number;
  forms: string[];
  items: string[];
  /** Mega Stone item ids whose Mega Evolution is allowed. Each must also be in `items`. */
  megas: string[];
}

export interface FormRecord {
  id: string;
  species_id: string;
  dex_number: number;
  types: string[];
  sprite_key: string;
}

export interface ItemRecord {
  id: string;
  category: 'held' | 'berry' | 'mega_stone';
  mega_target: string | null;
  mega_base_form: string | null;
  sprite_key: string;
}

export type NameMap = Record<string, Partial<Record<Locale, string>>>;

export interface IdRegistry {
  forms: string[];
  items: string[];
  /** Cosmetic variant ids; absent in registries written before variants existed. */
  variants?: string[];
}

/** data/variants.json: cosmetic versions of a form, hand-maintained. */
export interface VariantFile {
  variants: Record<string, { id: string; pokeapi_form: string; en: string }[]>;
}

/** data/generated/variants.json: per form, its variants in order with names in every locale. */
export type VariantRecords = Record<string, { id: string; names: Partial<Record<Locale, string>> }[]>;

export function readVariantFile(dataDir = DATA_DIR): VariantFile {
  const path = join(dataDir, 'variants.json');
  return existsSync(path) ? readJson<VariantFile>(path) : { variants: {} };
}

/** data/pool.json: ids to leave out of the always-addable pool, hand-maintained. */
export interface PoolFile {
  exclude: string[];
}

export function readPoolFile(dataDir = DATA_DIR): PoolFile {
  const path = join(dataDir, 'pool.json');
  return existsSync(path) ? readJson<PoolFile>(path) : { exclude: [] };
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readRegulations(dataDir = DATA_DIR): RegulationFile[] {
  const dir = join(dataDir, 'regulations');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => readJson<RegulationFile>(join(dir, file)));
}

export function readGenerated(dataDir = DATA_DIR) {
  const dir = join(dataDir, 'generated');
  const load = <T>(file: string, fallback: T): T =>
    existsSync(join(dir, file)) ? readJson<T>(join(dir, file)) : fallback;
  return {
    forms: load<FormRecord[]>('forms.json', []),
    items: load<ItemRecord[]>('items.json', []),
    formNames: load<NameMap>('form-names.json', {}),
    itemNames: load<NameMap>('item-names.json', {}),
    variants: load<VariantRecords>('variants.json', {}),
    available: load<string[]>('available.json', []),
  };
}

export function readRegistry(dataDir = DATA_DIR): IdRegistry {
  const path = join(dataDir, 'id-registry.json');
  return existsSync(path) ? readJson<IdRegistry>(path) : { forms: [], items: [] };
}
