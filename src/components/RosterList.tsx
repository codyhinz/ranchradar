import type React from 'react';
import type { RosterView } from '../app/preferences';
import { catalogById, displayName, type NameLocale } from '../catalog';
import type { FormOwnership } from '../data/ownership';
import { ownershipText, t, trialTimeLeft, uiLocale } from '../i18n';
import { OwnIcon, ownershipState } from './ResultRow';
import { Sprite } from './Sprite';
import { TypeTags } from './TypeTags';

interface RosterListProps {
  summaries: FormOwnership[];
  now: Date;
  locale: NameLocale;
  view: RosterView;
  onViewChange: (view: RosterView) => void;
  onOpen: (formId: string) => void;
}

/** Everything you own, as a dense sprite grid (see it all at once) or a detailed list. */
export function RosterList({ summaries, now, locale, view, onViewChange, onOpen }: RosterListProps) {
  if (summaries.length === 0) {
    return (
      <div className="empty">
        <Sprite id="torkoal" size={96} className="empty-sprite" />
        <h2>{t('roster.empty.title')}</h2>
        <p>{t('roster.empty.body')}</p>
      </div>
    );
  }
  // Alphabetical by the name shown in the current language (50音順 in Japanese, and so on).
  const collator = new Intl.Collator(uiLocale());
  const sorted = [...summaries].sort((a, b) => collator.compare(displayName(a.form_id, locale), displayName(b.form_id, locale)));
  const timer = (summary: FormOwnership) => {
    const left = trialTimeLeft(summary.nextTrialExpiresAt, now);
    if (!left) return null;
    const urgent = Date.parse(summary.nextTrialExpiresAt!) - now.getTime() < 24 * 3_600_000;
    return { left, urgent, label: t('trial.leftLong', { time: left }) };
  };
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
                <button type="button" onClick={() => onOpen(summary.form_id)} title={`${name}: ${ownershipText(summary)}`}>
                  <Sprite id={summary.form_id} size={64} />
                  <span className="tile-name">{name}</span>
                  {timer(summary) && (
                    <span className="trial-timer" data-urgent={timer(summary)!.urgent} title={timer(summary)!.label}>
                      <TimerIcon />{timer(summary)!.left}
                    </span>
                  )}
                  {summary.total > 1 && <span key={summary.total} className="tile-count" aria-label={t('roster.copies', { count: summary.total })}>×{summary.total}</span>}
                  <span className="visually-hidden">{ownershipText(summary)}</span>
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
                      <span className="own-label" data-own={ownershipState(summary)}>
                        <OwnIcon state={ownershipState(summary) === 'permanent' ? 'permanent' : 'trial'} />
                        {ownershipText(summary)}
                      </span>
                      {timer(summary) && (
                        <span className="trial-timer" data-urgent={timer(summary)!.urgent} title={timer(summary)!.label}>
                          <TimerIcon />{timer(summary)!.left}
                        </span>
                      )}
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

function TimerIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>;
}
