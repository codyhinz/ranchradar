import { useId, useState } from 'react';
import { baseStatsOf } from '../catalog';
import {
  EMPTY_SPREAD, MAX_STAT_POINTS, STATS, TOTAL_STAT_POINTS,
  battleStats, natureMultiplier, roomFor, spreadTotal,
  type StatKey, type StatSpread,
} from '../data/spread';
import type { Nature } from '../data/types';
import { t, type MessageKey } from '../i18n';
import { usePressAndHold } from './usePressAndHold';

export const statLabel = (stat: StatKey) => t(`stat.${stat}` as MessageKey);

/** "2 HP / 32 Atk / 32 Spe": the stats with points, in stat order. Empty when none are set. */
export function spreadSummary(spread: StatSpread | null): string {
  if (!spread) return '';
  return STATS.filter((stat) => spread[stat] > 0)
    .map((stat) => t('spread.part', { points: spread[stat], stat: statLabel(stat) }))
    .join(' / ');
}

/**
 * Stat points for one copy, as the game's Training screen sets them: up to 32 per stat and 66 in
 * all. Folds away behind a one-line summary; open, each stat has −/+ (hold to empty or fill) and
 * a box to type the number, with the Level 50 stat it makes under this copy's nature beside it.
 */
export function StatPoints({ formId, nature, value, onChange }: {
  formId: string;
  nature: Nature | null;
  value: StatSpread | null;
  onChange: (spread: StatSpread | null) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const spread = value ?? EMPTY_SPREAD;
  const used = spreadTotal(value);
  const base = baseStatsOf(formId);
  const final = base ? battleStats(base, value, nature) : null;

  /** Sets one stat, held to what it and the 66 can take. */
  const set = (stat: StatKey, points: number) => {
    const ceiling = spread[stat] + roomFor(spread, stat);
    const next = Number.isFinite(points) ? Math.max(0, Math.min(ceiling, Math.floor(points))) : 0;
    if (next !== spread[stat]) onChange({ ...spread, [stat]: next });
  };
  const press = usePressAndHold((key) => {
    const [stat, dir] = key.split(':') as [StatKey, 'up' | 'down'];
    set(stat, dir === 'up' ? MAX_STAT_POINTS : 0);
  });

  const summary = spreadSummary(value) || t('spread.none');
  return (
    <div className="picker stat-points">
      <span className="picker-label" id={`${id}-label`}>{t('spread.label')}</span>
      <button
        type="button"
        className="picker-button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-labelledby={`${id}-label ${id}-value ${id}-used`}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${id}-value`} className="spread-summary">{summary}</span>
        <span id={`${id}-used`} className="spread-used" data-full={used === TOTAL_STAT_POINTS} aria-label={t('spread.usedLabel', { used, total: TOTAL_STAT_POINTS })}>
          {used}/{TOTAL_STAT_POINTS}
        </span>
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="picker-panel spread-panel" id={`${id}-panel`}>
          {final && <p className="spread-head" aria-hidden="true">{t('spread.atLevel')}</p>}
          <ul className="spread-rows">
            {STATS.map((stat) => {
              const label = statLabel(stat);
              const effect = natureMultiplier(nature, stat);
              const room = roomFor(spread, stat);
              return (
                <li key={stat} className="spread-row" data-nature={effect > 1 ? 'up' : effect < 1 ? 'down' : undefined}>
                  <label className="spread-stat" htmlFor={`${id}-${stat}`}>
                    {label}
                    {effect !== 1 && <span className="spread-mark" aria-hidden="true">{effect > 1 ? '▲' : '▼'}</span>}
                  </label>
                  <span className="spread-stepper">
                    <button
                      type="button"
                      className="spread-step"
                      disabled={spread[stat] === 0}
                      aria-label={t('spread.less', { stat: label })}
                      {...press.bind(`${stat}:down`)}
                      onClick={() => { if (!press.wasHeld()) set(stat, spread[stat] - 1); }}
                    >−</button>
                    <input
                      id={`${id}-${stat}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_STAT_POINTS}
                      value={spread[stat]}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => set(stat, event.currentTarget.valueAsNumber)}
                    />
                    <button
                      type="button"
                      className="spread-step"
                      disabled={room === 0}
                      aria-label={t('spread.more', { stat: label })}
                      {...press.bind(`${stat}:up`)}
                      onClick={() => { if (!press.wasHeld()) set(stat, spread[stat] + 1); }}
                    >+</button>
                  </span>
                  <span className="spread-meter" aria-hidden="true">
                    <span style={{ width: `${(spread[stat] / MAX_STAT_POINTS) * 100}%` }} />
                  </span>
                  {final && (
                    <output className="spread-final" htmlFor={`${id}-${stat}`} aria-label={t('spread.final', { stat: label, value: final[stat] })}>
                      {final[stat]}
                    </output>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="spread-foot">
            <span aria-live="polite">{t('spread.left', { count: TOTAL_STAT_POINTS - used })}</span>
            <button type="button" className="button button-quiet button-small" disabled={used === 0} onClick={() => onChange(null)}>
              {t('spread.clear')}
            </button>
          </div>
          <p className="field-hint spread-hint">{t('spread.hint')}</p>
        </div>
      )}
    </div>
  );
}
