import type React from 'react';
import type { RosterView } from '../app/preferences';
import { catalogById, displayName, type NameLocale } from '../catalog';
import { describeOwnership, type FormOwnership } from '../data/ownership';
import { t } from '../i18n';
import { ownershipState } from './ResultRow';
import { Sprite } from './Sprite';
import { TypeTags } from './TypeTags';

interface RosterListProps {
  summaries: FormOwnership[];
  locale: NameLocale;
  view: RosterView;
  onViewChange: (view: RosterView) => void;
  onOpen: (formId: string) => void;
}

/** Everything you own, as a dense sprite grid (see it all at once) or a detailed list. */
export function RosterList({ summaries, locale, view, onViewChange, onOpen }: RosterListProps) {
  if (summaries.length === 0) {
    return (
      <div className="empty">
        <Sprite id="torkoal" size={96} className="empty-sprite" />
        <h2>{t('roster.empty.title')}</h2>
        <p>{t('roster.empty.body')}</p>
      </div>
    );
  }
  const sorted = [...summaries].sort(
    (a, b) => (catalogById.get(a.form_id)?.dexNumber ?? 9999) - (catalogById.get(b.form_id)?.dexNumber ?? 9999),
  );
  const total = summaries.reduce((sum, s) => sum + s.total, 0);
  return (
    <section aria-labelledby="roster-heading">
      <div className="section-head">
        <h2 id="roster-heading">{t('roster.heading')}</h2>
        <span className="count">{t('roster.count', { count: total })}</span>
        <div className="view-toggle" role="group" aria-label={t('roster.view')}>
          {(['grid', 'list'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => onViewChange(option)}
              aria-label={t(option === 'grid' ? 'roster.view.grid' : 'roster.view.list')}
            >
              {option === 'grid' ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === 'grid' ? (
        <ul className="tiles" key="grid">
          {sorted.map((summary, index) => {
            const name = displayName(summary.form_id, locale);
            return (
              <li key={summary.form_id} className="tile enter" data-own={ownershipState(summary)} style={{ '--i': Math.min(index, 18) } as React.CSSProperties}>
                <button type="button" onClick={() => onOpen(summary.form_id)} title={`${name}: ${describeOwnership(summary)}`}>
                  <Sprite id={summary.form_id} size={64} />
                  <span className="tile-name">{name}</span>
                  {summary.total > 1 && <span key={summary.total} className="tile-count" aria-label={t('roster.copies', { count: summary.total })}>×{summary.total}</span>}
                  <span className="visually-hidden">{describeOwnership(summary)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="rows fence" key="list">
          {sorted.map((summary, index) => {
            const form = catalogById.get(summary.form_id);
            return (
              <li key={summary.form_id} className="row enter" data-own={ownershipState(summary)} style={{ '--i': Math.min(index, 12) } as React.CSSProperties}>
                <button type="button" className="row-main" onClick={() => onOpen(summary.form_id)}>
                  <Sprite id={summary.form_id} />
                  <span className="row-text">
                    <span className="row-name">{displayName(summary.form_id, locale)}</span>
                    <span className="row-meta">
                      <span className="own-label">{describeOwnership(summary)}</span>
                      {form && <TypeTags types={form.types} />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
