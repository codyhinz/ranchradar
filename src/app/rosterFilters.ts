import { dexNumberOf, displayName, typesOf, type NameLocale } from '../catalog';
import type { FormOwnership } from '../data/ownership';
import type { RosterSort } from './preferences';

export const STATUS_FILTERS = ['all', 'permanent', 'trial', 'expired'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface RosterFilters {
  status: StatusFilter;
  /** Matches a Pokémon with any of these types; empty means every type. */
  types: string[];
}

export const NO_FILTERS: RosterFilters = { status: 'all', types: [] };

export function activeFilterCount(filters: RosterFilters): number {
  return (filters.status === 'all' ? 0 : 1) + filters.types.length;
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
    .filter((s) => filters.types.length === 0 || typesOf(s.form_id).some((type) => filters.types.includes(type)))
    .sort(compare[sort]);
}

/** Types present in the roster, so the type filter only offers ones that can match. */
export function ownedTypes(summaries: FormOwnership[]): string[] {
  return [...new Set(summaries.flatMap((s) => typesOf(s.form_id)))].sort();
}
