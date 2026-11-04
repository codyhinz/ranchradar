/**
 * Held items, berries and Mega Stones, for the Items tab. Kept out of catalog.ts so the item data
 * only loads with that tab, not with the roster everyone opens first.
 */
import items from '../data/generated/items.json';
import itemNames from '../data/generated/item-names.json';
import { currentRegulation, displayName, normalize, type NameLocale } from './catalog';

export type ItemCategory = 'held' | 'berry' | 'mega_stone';
export const ITEM_CATEGORIES: readonly ItemCategory[] = ['held', 'berry', 'mega_stone'];

export interface CatalogItem {
  id: string;
  category: ItemCategory;
  /** For a Mega Stone: the Pokémon that holds it to Mega Evolve. */
  megaBaseForm: string | null;
}

const names = itemNames as Record<string, Partial<Record<NameLocale, string>>>;

export const itemCatalog: CatalogItem[] = items.map((item) => ({
  id: item.id,
  category: item.category as ItemCategory,
  megaBaseForm: item.mega_base_form ?? null,
}));
const byId = new Map(itemCatalog.map((item) => [item.id, item]));

const legalItems = new Set(currentRegulation.items);

/** True when this item can be held in the current regulation. */
export function isItemInSeason(itemId: string): boolean {
  return legalItems.has(itemId);
}

export function itemById(itemId: string): CatalogItem | undefined {
  return byId.get(itemId);
}

export function itemName(itemId: string, locale: NameLocale): string {
  return names[itemId]?.[locale] ?? names[itemId]?.en ?? itemId;
}

/**
 * What the Items tab lists: everything legal this season, plus anything already bought that
 * has since left it (bought items stay bought). Unknown ids from a newer app are left out.
 */
export function itemsToShow(owned: ReadonlySet<string>): CatalogItem[] {
  return itemCatalog.filter((item) => legalItems.has(item.id) || owned.has(item.id));
}

export type ItemStatusFilter = 'all' | 'missing' | 'owned';

export interface ItemFilters {
  status: ItemStatusFilter;
  /** Categories to show; empty shows every category. */
  categories: ReadonlySet<ItemCategory>;
  query: string;
}

/** What the Items tab shows: bought / missing, any picked categories, and the search text, all at once. */
export function filterItems(items: readonly CatalogItem[], filters: ItemFilters, owned: { has(id: string): boolean }, locale: NameLocale): CatalogItem[] {
  return items.filter((item) =>
    (filters.status === 'all' || (filters.status === 'owned') === owned.has(item.id))
    && (filters.categories.size === 0 || filters.categories.has(item.category))
    && matchesItem(item, filters.query, locale));
}

/**
 * Matches like Pokémon search: the name starting with the query, or a word in it starting with
 * it, and from 3 letters anywhere inside. A Mega Stone also matches its Pokémon's name, so
 * "garchomp" finds Garchompite.
 */
export function matchesItem(item: CatalogItem, query: string, locale: NameLocale): boolean {
  const q = normalize(query);
  if (!q) return true;
  const keys = [normalize(itemName(item.id, locale))];
  if (item.megaBaseForm) keys.push(normalize(displayName(item.megaBaseForm, locale)));
  return keys.some((key) => key.startsWith(q) || key.split(' ').some((word) => word.startsWith(q)) || (q.length >= 3 && key.includes(q)));
}

/** In-season items by name in the chosen language, then any bought ones that left the season. */
export function sortItems(list: CatalogItem[], locale: NameLocale): CatalogItem[] {
  const key = (item: CatalogItem) => normalize(itemName(item.id, locale));
  const byName = (a: CatalogItem, b: CatalogItem) => key(a).localeCompare(key(b), locale);
  return [...list.filter((i) => legalItems.has(i.id)).sort(byName), ...list.filter((i) => !legalItems.has(i.id)).sort(byName)];
}

/**
 * Most recently bought first (by when each was marked bought), then everything not bought in
 * the usual name order.
 */
export function sortItemsByRecent(list: CatalogItem[], ownedAt: ReadonlyMap<string, string>, locale: NameLocale): CatalogItem[] {
  const bought = list.filter((item) => ownedAt.has(item.id))
    .sort((a, b) => Date.parse(ownedAt.get(b.id)!) - Date.parse(ownedAt.get(a.id)!) || itemName(a.id, locale).localeCompare(itemName(b.id, locale), locale));
  return [...bought, ...sortItems(list.filter((item) => !ownedAt.has(item.id)), locale)];
}
