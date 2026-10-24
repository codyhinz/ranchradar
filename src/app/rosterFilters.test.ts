import type { FormOwnership } from '../data/ownership';
import { boxCapacity } from './box';
import { activeFilterCount, applyRosterView, NO_FILTERS, ownedTypes } from './rosterFilters';

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
    expect(ids(applyRosterView(roster, { status: 'permanent', types: [] }, 'az', 'en'))).toEqual(['garchomp', 'torkoal']);
    expect(ids(applyRosterView(roster, { status: 'trial', types: [] }, 'az', 'en'))).toEqual(['ninetales-alola', 'garchomp']); // "Alolan Ninetales" sorts first
    expect(ids(applyRosterView(roster, { status: 'expired', types: [] }, 'az', 'en'))).toEqual(['garchomp', 'pikachu']);
  });

  it('matches any selected type and only offers owned types', () => {
    expect(ids(applyRosterView(roster, { status: 'all', types: ['fire', 'electric'] }, 'az', 'en'))).toEqual(['pikachu', 'torkoal']);
    expect(ownedTypes(roster)).toEqual(['dragon', 'electric', 'fairy', 'fire', 'ground', 'ice']);
    expect(activeFilterCount({ status: 'trial', types: ['fire', 'ice'] })).toBe(3);
  });

  it('sorts by dex number, soonest trial, newest and most copies', () => {
    expect(ids(applyRosterView(roster, NO_FILTERS, 'dex', 'en'))).toEqual(['pikachu', 'ninetales-alola', 'torkoal', 'garchomp']);
    expect(ids(applyRosterView(roster, NO_FILTERS, 'expiring', 'en')).slice(0, 2)).toEqual(['ninetales-alola', 'garchomp']);
    expect(ids(applyRosterView(roster, NO_FILTERS, 'recent', 'en'))[0]).toBe('torkoal');
    expect(ids(applyRosterView(roster, NO_FILTERS, 'copies', 'en'))[0]).toBe('garchomp');
  });
});

describe('box space', () => {
  it('starts at 30, reaches 50 for a fully free player, and adds paid upgrades', () => {
    expect(boxCapacity([])).toBe(30);
    expect(boxCapacity(['great', 'ultra', 'master'])).toBe(50);
    expect(boxCapacity(['great', 'ultra', 'master', 'starter', 'membership'])).toBe(1100);
  });
});
