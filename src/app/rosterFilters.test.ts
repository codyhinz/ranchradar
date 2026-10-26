import type { FormOwnership } from '../data/ownership';
import { boxCapacity, DEFAULT_BOX, type BoxSettings } from './box';
import { activeFilterCount, applyRosterView, NO_FILTERS, outOfSeasonCount, ownedTypes } from './rosterFilters';

const own = (form_id: string, extra: Partial<FormOwnership> = {}): FormOwnership => ({
  form_id, total: 1, permanent: 1, trial: 0, expiredTrials: 0, nextTrialExpiresAt: null, variants: [],
  lastAddedAt: '2026-10-01T00:00:00Z', ...extra,
});

const roster = [
  own('torkoal', { lastAddedAt: '2026-10-20T00:00:00Z' }),
  own('garchomp', { total: 3, permanent: 1, trial: 2, expiredTrials: 1, nextTrialExpiresAt: '2026-10-26T00:00:00Z' }),
  own('ninetales-alola', { permanent: 0, trial: 1, nextTrialExpiresAt: '2026-10-25T00:00:00Z' }),
  own('pikachu', { permanent: 0, trial: 1, expiredTrials: 1 }),
];
const ids = (list: FormOwnership[]) => list.map((s) => s.form_id);

describe('roster filters', () => {
  it('filters by status', () => {
    expect(ids(applyRosterView(roster, { ...NO_FILTERS, status: 'permanent' }, 'az', 'en'))).toEqual(['garchomp', 'torkoal']);
    expect(ids(applyRosterView(roster, { ...NO_FILTERS, status: 'trial' }, 'az', 'en'))).toEqual(['ninetales-alola', 'garchomp']); // "Alolan Ninetales" sorts first
    expect(ids(applyRosterView(roster, { ...NO_FILTERS, status: 'expired' }, 'az', 'en'))).toEqual(['garchomp', 'pikachu']);
  });

  it('matches any selected type and only offers owned types', () => {
    expect(ids(applyRosterView(roster, { ...NO_FILTERS, status: 'all', types: ['fire', 'electric'] }, 'az', 'en'))).toEqual(['pikachu', 'torkoal']);
    expect(ownedTypes(roster)).toEqual(['dragon', 'electric', 'fairy', 'fire', 'ground', 'ice']);
    expect(activeFilterCount({ ...NO_FILTERS, status: 'trial', types: ['fire', 'ice'] })).toBe(3);
  });

  it('sorts by dex number, soonest trial, newest and most copies', () => {
    expect(ids(applyRosterView(roster, NO_FILTERS, 'dex', 'en'))).toEqual(['pikachu', 'ninetales-alola', 'torkoal', 'garchomp']);
    expect(ids(applyRosterView(roster, NO_FILTERS, 'expiring', 'en')).slice(0, 2)).toEqual(['ninetales-alola', 'garchomp']);
    expect(ids(applyRosterView(roster, NO_FILTERS, 'recent', 'en'))[0]).toBe('torkoal');
    expect(ids(applyRosterView(roster, NO_FILTERS, 'copies', 'en'))[0]).toBe('garchomp');
  });
});

describe('box space', () => {
  const box = (extra: Partial<BoxSettings> = {}): BoxSettings => ({ ...DEFAULT_BOX, ...extra });
  it('is 50 for a free-to-play player with ranked rewards, 30 before them', () => {
    expect(boxCapacity(box())).toBe(50);
    expect(boxCapacity(box({ rankedRewards: false }))).toBe(30);
  });
  it('ignores purchases while free to play, and adds them otherwise', () => {
    expect(boxCapacity(box({ starterPack: true, membership: true }))).toBe(50);
    expect(boxCapacity(box({ freeToPlay: false, starterPack: true }))).toBe(100);
    expect(boxCapacity(box({ freeToPlay: false, starterPack: true, membership: true }))).toBe(1100);
  });
});

describe('out-of-season filter', () => {
  it('hides Pokémon not in the current regulation and counts as a filter', () => {
    const owned = [own('garchomp'), own('bouffalant')];
    expect(outOfSeasonCount(owned)).toBe(1);
    expect(applyRosterView(owned, { ...NO_FILTERS, hideOutOfSeason: true }, 'az', 'en').map((s) => s.form_id)).toEqual(['garchomp']);
    expect(activeFilterCount({ ...NO_FILTERS, hideOutOfSeason: true })).toBe(1);
  });
});
