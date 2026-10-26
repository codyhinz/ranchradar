import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import typeNames from '../../data/generated/type-names.json';
import { ROSTER_SORTS, useRosterSort, type RosterView } from '../app/preferences';
import { activeFilterCount, applyRosterView, NO_FILTERS, outOfSeasonCount, ownedTypes, STATUS_FILTERS, type RosterFilters } from '../app/rosterFilters';
import { currentRegulation, displayName, isInSeason, typesOf, variantName, type NameLocale } from '../catalog';
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
  /** Removes every copy of these Pokémon (with Undo). */
  onRemoveForms: (formIds: string[]) => void;
  /** Returns every expired trial to the Ranch (with Undo). */
  onClearExpired: () => void;
}

/** Everything you own, as a dense sprite grid (see it all at once) or a detailed list. */
const typeLabel = (type: string, locale: NameLocale) => {
  const names = (typeNames as Record<string, Partial<Record<NameLocale, string>>>)[type];
  return names?.[locale] ?? names?.en ?? type;
};

export function RosterList({ summaries, now, locale, view, onViewChange, onOpen, onRemoveForms, onClearExpired, boxUsed, boxCapacity }: RosterListProps) {
  const [sort, setSort] = useRosterSort();
  const [filters, setFilters] = useState<RosterFilters>(NO_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  // Select mode: tap Pokémon to pick them, then remove them from the box in one go.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelected = (formId: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(formId)) next.delete(formId); else next.add(formId);
    return next;
  });
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
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
  const expiredCount = summaries.reduce((sum, s) => sum + s.expiredTrials, 0);
  const outCount = outOfSeasonCount(summaries);
  const seasonTag = t('season.out', { id: currentRegulation.id });
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
  const pickedSummaries = sorted.filter((s) => selected.has(s.form_id));
  const pickedCopies = pickedSummaries.reduce((sum, s) => sum + s.total, 0);
  const allShownPicked = sorted.length > 0 && pickedSummaries.length === sorted.length;
  const tap = (formId: string) => (selecting ? toggleSelected(formId) : onOpen(formId));
  const removePicked = () => {
    const ids = pickedSummaries.map((s) => s.form_id);
    stopSelecting();
    onRemoveForms(ids);
  };
  const boxState = boxUsed >= boxCapacity ? 'full' : boxUsed >= boxCapacity * 0.9 ? 'near' : 'ok';
  return (
    <section aria-labelledby="roster-heading">
      <div className="section-head">
        <h2 id="roster-heading">{t('roster.heading')}</h2>
        <span className="count box-count" data-state={boxState}>{t('roster.box', { used: boxUsed, capacity: boxCapacity })}</span>
        {/* Filter, select and layout stay together as one row of icons */}
        <div className="roster-tools">
        <div className="filter-wrap" ref={filterRef}>
          <button
            ref={filterButtonRef}
            type="button"
            className="tool-button filter-button"
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
            aria-controls="roster-filters"
            title={t('filter.button')}
            onClick={() => (panelOpen ? closePanel() : setPanelOpen(true))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            <span className="visually-hidden">{t('filter.button')}</span>
            {filterCount > 0 && <span key={filterCount} className="filter-badge">{filterCount}</span>}
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
              {(outCount > 0 || filters.hideOutOfSeason) && (
                <label className="check season-check">
                  <input type="checkbox" checked={filters.hideOutOfSeason} onChange={(event) => setFilters({ ...filters, hideOutOfSeason: event.target.checked })} />
                  <span>{t('filter.hideOutOfSeason', { id: currentRegulation.id, count: outCount })}</span>
                </label>
              )}
              {expiredCount > 0 && (
                <button type="button" className="button button-quiet button-small clear-expired" onClick={onClearExpired}>
                  {t('expired.clear', { count: expiredCount })}
                </button>
              )}
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
        <button type="button" className="tool-button select-button" aria-pressed={selecting} title={t(selecting ? 'form.selectDone' : 'form.select')} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
          {selecting ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
          )}
          <span className="visually-hidden">{t(selecting ? 'form.selectDone' : 'form.select')}</span>
        </button>
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
      </div>

      {/* Looking at expired trials: offer to send them all back in one go */}
      {filters.status === 'expired' && expiredCount > 0 && (
        <div className="expired-bar">
          <span>{t('expired.summary', { count: expiredCount })}</span>
          <button type="button" className="button button-quiet button-small" onClick={onClearExpired}>{t('expired.clearShort')}</button>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="no-results">{t('filter.none')}</p>
      ) : view === 'grid' ? (
        <ul className="tiles" key="grid">
          {sorted.map((summary, index) => {
            const name = displayName(summary.form_id, locale);
            return (
              <li key={summary.form_id} className="tile enter" data-own={ownershipState(summary)} data-season={isInSeason(summary.form_id) ? undefined : 'out'} data-selected={selecting && selected.has(summary.form_id)} style={{ '--i': Math.min(index, 18) } as React.CSSProperties}>
                <button type="button" onClick={() => tap(summary.form_id)} aria-pressed={selecting ? selected.has(summary.form_id) : undefined} title={`${name}: ${ownershipText(summary)}`}>
                  {selecting && <SelectMark />}
                  <Sprite id={summary.form_id} variant={summary.variants.length === 1 ? summary.variants[0] : null} size={64} />
                  <span className="tile-name">{name}</span>
                  {!isInSeason(summary.form_id) && <span className="season-tag">{seasonTag}</span>}
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
            return (
              <li key={summary.form_id} className="row enter" data-own={ownershipState(summary)} data-season={isInSeason(summary.form_id) ? undefined : 'out'} data-selected={selecting && selected.has(summary.form_id)} style={{ '--i': Math.min(index, 12) } as React.CSSProperties}>
                <button type="button" className="row-main" onClick={() => tap(summary.form_id)} aria-pressed={selecting ? selected.has(summary.form_id) : undefined}>
                  {selecting && <SelectMark />}
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
                      {!isInSeason(summary.form_id) && <span className="season-tag">{seasonTag}</span>}
                      <TypeTags types={typesOf(summary.form_id)} />
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
      {selecting && (
        <div className="roster-select-bar" role="region" aria-label={t('form.select')}>
          <span className="count">{t('roster.selectedCount', { count: pickedSummaries.length, copies: pickedCopies })}</span>
          <button type="button" className="button button-quiet" onClick={() => setSelected(allShownPicked ? new Set() : new Set(sorted.map((s) => s.form_id)))}>
            {t(allShownPicked ? 'form.selectNone' : 'form.selectAll')}
          </button>
          <button type="button" className="button button-danger" disabled={pickedSummaries.length === 0} onClick={removePicked}>
            {t('form.removeSelected', { count: pickedCopies })}
          </button>
        </div>
      )}
    </section>
  );
}

function SelectMark() {
  return (
    <span className="select-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  );
}

function TimerIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>;
}
