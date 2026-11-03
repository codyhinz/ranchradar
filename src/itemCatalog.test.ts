import { currentRegulation } from './catalog';
import { isItemInSeason, itemById, itemName, itemsToShow, matchesItem, sortItems } from './itemCatalog';

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
});
