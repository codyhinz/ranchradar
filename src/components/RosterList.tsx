import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import typeNames from '../../data/generated/type-names.json';
import { ROSTER_SORTS, useRosterSort, type RosterView } from '../app/preferences';
import { activeFilterCount, applyRosterView, NO_FILTERS, ownedTypes, STATUS_FILTERS, type RosterFilters } from '../app/rosterFilters';
import { catalogById, displayName, variantName, type NameLocale } from '../catalog';
import type { FormOwnership } from '../data/ownership';
import { ownershipText, t, trialTimeLeft, type MessageKey } from '../i18n';
import { OwnIcon, ownershipState } from './ResultRow';
import { Sprite } from './Sprite';
import { TypeTags } from './TypeTags';

interface RosterListProps {
  summaries: FormOwnership[];
  now: Date;
  locale: NameLocale;
  view: RosterView;
  onViewChange: (view: RosterView) => void;
  /** Box slots used (every copy, expired trials included) and available. */
  boxUsed: number;
  boxCapacity: number;
  onOpen: (formId: string) => void;
}

/** Everything you own, as a dense sprite grid (see it all at once) or a detailed list. */
const typeLabel = (type: string, locale: NameLocale) => {
  const names = (typeNames as Record<string, Partial<Record<NameLocale, string>>>)[type];
  return names?.[locale] ?? names?.en ?? type;
};

export function RosterList({ summaries, now, locale, view, onViewChange, onOpen, boxUsed, boxCapacity }: RosterListProps) {
  const [sort, setSort] = useRosterSort();
  const [filters, setFilters] = useState<RosterFilters>(NO_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const closePanel = useCallback((refocus = false) => {
    if (refocus) filterButtonRef.current?.focus();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setPanelOpen(false); return; }
    setPanelClosing(true);
    window.setTimeout(() => { setPanelOpen(false); setPanelClosing(false); }, 140); // matches dropdown-out
  }, []);
  // Tapping outside or pressing Esc closes the dropdown.
  useEffect(() => {
    if (!panelOpen || panelClosing) return;
    const onPointer = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) closePanel();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closePanel(true); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [panelOpen, panelClosing, closePanel]);
  if (summaries.length === 0) {
    return (
      <div className="empty">
        <Sprite id="torkoal" size={84} className="empty-sprite" />
        <h2>{t('roster.empty.title')}</h2>
        <p>{t('roster.empty.body')}</p>
      </div>
    );
  }
  const sorted = applyRosterView(summaries, filters, sort, locale);
  const filterCount = activeFilterCount(filters);
  const types = ownedTypes(summaries);
  const toggleType = (type: string) => setFilters({
    ...filters,
    types: filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type],
  });
  const timer = (summary: FormOwnership) => {
    const left = trialTimeLeft(summary.nextTrialExpiresAt, now);
    if (!left) return null;
    const urgent = Date.parse(summary.nextTrialExpiresAt!) - now.getTime() < 24 * 3_600_000;
    return { left, urgent, label: t('trial.leftLong', { time: left }) };
  };
  const boxState = boxUsed >= boxCapacity ? 'full' : boxUsed >= boxCapacity * 0.9 ? 'near' : 'ok';
  return (
    <section aria-labelledby="roster-heading">
      <div className="section-head">
        <h2 id="roster-heading">{t('roster.heading')}</h2>
        <span className="count box-count" data-state={boxState}>{t('roster.box', { used: boxUsed, capacity: boxCapacity })}</span>
        <div className="filter-wrap" ref={filterRef}>
          <button
            ref={filterButtonRef}
            type="button"
            className="filter-button"
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
            aria-controls="roster-filters"
            onClick={() => (panelOpen ? closePanel() : setPanelOpen(true))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            <span className="filter-button-label">{t('filter.button')}</span>
            {filterCount > 0 && <span key={filterCount} className="filter-badge">{filterCount}</span>}
            <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {panelOpen && (
            <div className="filter-panel" id="roster-filters" role="dialog" aria-label={t('filter.button')} data-closing={panelClosing}>
              <fieldset className="chips">
                <legend>{t('filter.status')}</legend>
                {STATUS_FILTERS.map((status) => (
                  <label key={status} className="chip">
                    <input type="radio" name="roster-status" checked={filters.status === status} onChange={() => setFilters({ ...filters, status })} />
                    <span>{t(`filter.status.${status}` as MessageKey)}</span>
                  </label>
                ))}
              </fieldset>
              {types.length > 1 && (
                <fieldset className="chips">
                  <legend>{t('filter.type')}</legend>
                  {types.map((type) => (
                    <label key={type} className="chip chip-type">
                      <input type="checkbox" checked={filters.types.includes(type)} onChange={() => toggleType(type)} />
                      <span className="type" data-type={type}>{typeLabel(type, locale)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset className="chips">
                <legend>{t('filter.sort')}</legend>
                {ROSTER_SORTS.map((option) => (
                  <label key={option} className="chip">
                    <input type="radio" name="roster-sort" checked={sort === option} onChange={() => setSort(option)} />
                    <span>{t(`sort.${option}` as MessageKey)}</span>
                  </label>
                ))}
              </fieldset>
              {filterCount > 0 && (
                <div className="filter-foot">
                  <span className="count">{t('filter.shown', { shown: sorted.length, total: summaries.length })}</span>
                  <button type="button" className="button button-quiet" onClick={() => setFilters(NO_FILTERS)}>{t('filter.clear')}</button>
                </div>
              )}
            </div>
          )}
        </div>
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

      {sorted.length === 0 ? (
        <p className="no-results">{t('filter.none')}</p>
      ) : view === 'grid' ? (
        <ul className="tiles" key="grid">
          {sorted.map((summary, index) => {
            const name = displayName(summary.form_id, locale);
            return (
              <li key={summary.form_id} className="tile enter" data-own={ownershipState(summary)} style={{ '--i': Math.min(index, 18) } as React.CSSProperties}>
                <button type="button" onClick={() => onOpen(summary.form_id)} title={`${name}: ${ownershipText(summary)}`}>
                  <Sprite id={summary.form_id} variant={summary.variants.length === 1 ? summary.variants[0] : null} size={64} />
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
                  <Sprite id={summary.form_id} variant={summary.variants.length === 1 ? summary.variants[0] : null} />
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
                      {summary.variants.length > 0 && (
                        <span className="row-variants">{summary.variants.map((v) => variantName(v, locale)).join(', ')}</span>
                      )}
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
