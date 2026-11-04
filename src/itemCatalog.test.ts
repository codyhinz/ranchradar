import { currentRegulation } from './catalog';
import { filterItems, isItemInSeason, itemById, itemName, itemsToShow, matchesItem, sortItems, sortItemsByRecent } from './itemCatalog';

describe('item catalog', () => {
  it('lists this season’s items, plus bought ones that left it', () => {
    const shown = itemsToShow(new Set()).map((i) => i.id);
    expect(shown.sort()).toEqual([...currentRegulation.items].sort());
    expect(shown.every(isItemInSeason)).toBe(true);
  });

  it('finds a Mega Stone by its Pokémon’s name', () => {
    const stone = itemById('garchompite')!;
    expect(stone.megaBaseForm).toBe('garchomp');
    expect(matchesItem(stone, 'garch', 'en')).toBe(true);
    expect(matchesItem(itemById('focus-sash')!, 'sash', 'en')).toBe(true);
    expect(matchesItem(itemById('focus-sash')!, 'as', 'en')).toBe(false);
  });

  it('names and sorts items in the chosen language', () => {
    expect(itemName('focus-sash', 'ja')).not.toBe(itemName('focus-sash', 'en'));
    const sorted = sortItems([itemById('leftovers')!, itemById('focus-sash')!], 'en').map((i) => i.id);
    expect(sorted).toEqual(['focus-sash', 'leftovers']);
  });

  it('puts the most recently bought first, then the rest by name', () => {
    const list = ['leftovers', 'focus-sash', 'life-orb', 'sitrus-berry'].map((id) => itemById(id)!);
    const ownedAt = new Map([['leftovers', '2026-11-01T00:00:00Z'], ['sitrus-berry', '2026-11-02T00:00:00Z']]);
    expect(sortItemsByRecent(list, ownedAt, 'en').map((i) => i.id)).toEqual(['sitrus-berry', 'leftovers', 'focus-sash', 'life-orb']);
  });

  it('filters by bought state, category and search together', () => {
    const list = ['leftovers', 'focus-sash', 'sitrus-berry', 'garchompite'].map((id) => itemById(id)!);
    const owned = new Set(['leftovers', 'sitrus-berry']);
    const ids = (status: 'all' | 'missing' | 'owned', categories: string[], query = '') =>
      filterItems(list, { status, categories: new Set(categories as never[]), query }, owned, 'en').map((i) => i.id);
    expect(ids('all', [])).toEqual(['leftovers', 'focus-sash', 'sitrus-berry', 'garchompite']);
    expect(ids('all', ['berry', 'mega_stone'])).toEqual(['sitrus-berry', 'garchompite']);
    expect(ids('missing', ['held'])).toEqual(['focus-sash']);
    expect(ids('owned', ['held'], 'left')).toEqual(['leftovers']);
  });
});
