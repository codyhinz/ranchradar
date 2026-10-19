import type { RosterEntry } from './types';

export interface FormOwnership {
  form_id: string;
  total: number;
  permanent: number;
  trial: number;
  /** Trials past their expiry: still in the box, but can't be used in battle. */
  expiredTrials: number;
}

/** Groups live entries by form, e.g. Garchomp → 2 owned (1 permanent, 1 trial). */
export function summarizeByForm(entries: RosterEntry[], at: Date = new Date()): Map<string, FormOwnership> {
  const byForm = new Map<string, FormOwnership>();
  for (const entry of entries) {
    if (entry.deleted_at) continue;
    let summary = byForm.get(entry.form_id);
    if (!summary) {
      summary = { form_id: entry.form_id, total: 0, permanent: 0, trial: 0, expiredTrials: 0 };
      byForm.set(entry.form_id, summary);
    }
    summary.total++;
    if (entry.status === 'permanent') {
      summary.permanent++;
    } else {
      summary.trial++;
      if (entry.trial_expires_at && new Date(entry.trial_expires_at) <= at) {
        summary.expiredTrials++;
      }
    }
  }
  return byForm;
}

/** Text for a search result row, e.g. "2 owned (1 perm, 1 trial)". */
export function describeOwnership(summary: FormOwnership | undefined): string {
  if (!summary || summary.total === 0) return 'Not owned';
  const parts: string[] = [];
  if (summary.permanent) parts.push(`${summary.permanent} perm`);
  if (summary.trial) {
    const expired = summary.expiredTrials ? `, ${summary.expiredTrials} expired` : '';
    parts.push(`${summary.trial} trial${expired}`);
  }
  return `${summary.total} owned (${parts.join(', ')})`;
}
