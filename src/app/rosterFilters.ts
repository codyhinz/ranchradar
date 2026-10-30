import { dexNumberOf, displayName, isInSeason, typesOf, type NameLocale } from '../catalog';
import type { FormOwnership } from '../data/ownership';
import type { RosterSort } from './preferences';

export const STATUS_FILTERS = ['all', 'permanent', 'trial', 'expired'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SEASON_FILTERS = ['all', 'in', 'out'] as const;
export type SeasonFilter = (typeof SEASON_FILTERS)[number];

export interface RosterFilters {
  status: StatusFilter;
  /** Matches a Pokémon with any of these types; empty means every type. */
  types: string[];
  /** Only Pokémon legal in the current regulation, only ones that aren't (they stay in the box), or both. */
  season: SeasonFilter;
}

export const NO_FILTERS: RosterFilters = { status: 'all', types: [], season: 'all' };

export function activeFilterCount(filters: RosterFilters): number {
  return (filters.status === 'all' ? 0 : 1) + filters.types.length + (filters.season === 'all' ? 0 : 1);
}

function matchesSeason(formId: string, season: SeasonFilter): boolean {
  return season === 'all' || isInSeason(formId) === (season === 'in');
}

function matchesStatus(summary: FormOwnership, status: StatusFilter): boolean {
  switch (status) {
    case 'all': return true;
    case 'permanent': return summary.permanent > 0;
    case 'trial': return summary.trial - summary.expiredTrials > 0;
    case 'expired': return summary.expiredTrials > 0;
  }
}

/** Filters, then sorts, the roster; ties fall back to name order in the current language. */
export function applyRosterView(
  summaries: FormOwnership[],
  filters: RosterFilters,
  sort: RosterSort,
  locale: NameLocale,
): FormOwnership[] {
  const collator = new Intl.Collator(locale);
  const name = (s: FormOwnership) => displayName(s.form_id, locale);
  const byName = (a: FormOwnership, b: FormOwnership) => collator.compare(name(a), name(b));
  const compare: Record<RosterSort, (a: FormOwnership, b: FormOwnership) => number> = {
    az: byName,
    dex: (a, b) => dexNumberOf(a.form_id) - dexNumberOf(b.form_id) || byName(a, b),
    // Active trials soonest first; everything without one after, by name.
    expiring: (a, b) =>
      (a.nextTrialExpiresAt ?? '\uffff').localeCompare(b.nextTrialExpiresAt ?? '\uffff') || byName(a, b),
    recent: (a, b) => b.lastAddedAt.localeCompare(a.lastAddedAt) || byName(a, b),
    copies: (a, b) => b.total - a.total || byName(a, b),
  };
  return summaries
    .filter((s) => matchesStatus(s, filters.status))
    .filter((s) => matchesSeason(s.form_id, filters.season))
    .filter((s) => filters.types.length === 0 || typesOf(s.form_id).some((type) => filters.types.includes(type)))
    .sort(compare[sort]);
}

/** Types present in the roster, so the type filter only offers ones that can match. */
export function ownedTypes(summaries: FormOwnership[]): string[] {
  return [...new Set(summaries.flatMap((s) => typesOf(s.form_id)))].sort();
}

/** How many owned Pokémon aren't legal this regulation, so the filter only shows when it can matter. */
export function outOfSeasonCount(summaries: FormOwnership[]): number {
  return summaries.filter((s) => !isInSeason(s.form_id)).length;
}
