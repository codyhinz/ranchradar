import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import natureNames from '../../data/generated/nature-names.json';
import { useNatureSort } from '../app/preferences';
import type { NameLocale } from '../catalog';
import { NATURES, type Nature } from '../data/types';
import { revealWithin } from './reveal';
import { t, uiLocale, type MessageKey } from '../i18n';

type Stat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
const STATS: Stat[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** Raised and lowered stat for each nature; neutral natures have none. */
const EFFECTS: Partial<Record<Nature, [Stat, Stat]>> = {
  lonely: ['atk', 'def'], brave: ['atk', 'spe'], adamant: ['atk', 'spa'], naughty: ['atk', 'spd'],
  bold: ['def', 'atk'], relaxed: ['def', 'spe'], impish: ['def', 'spa'], lax: ['def', 'spd'],
  timid: ['spe', 'atk'], hasty: ['spe', 'def'], jolly: ['spe', 'spa'], naive: ['spe', 'spd'],
  modest: ['spa', 'atk'], mild: ['spa', 'def'], quiet: ['spa', 'spe'], rash: ['spa', 'spd'],
  calm: ['spd', 'atk'], gentle: ['spd', 'def'], sassy: ['spd', 'spe'], careful: ['spd', 'spa'],
};

const names = natureNames as Record<string, Partial<Record<NameLocale, string>>>;
const statLabel = (stat: Stat) => t(`stat.${stat}` as MessageKey);

/** A nature's name in the current language. */
export function natureName(nature: Nature): string {
  return names[nature]?.[uiLocale()] ?? names[nature]?.en ?? nature;
}

interface Group { heading: string | null; natures: Nature[] }

/** A–Z by the localized name, or grouped by the stat each nature raises (neutral last). */
function buildGroups(sort: 'az' | 'stat'): Group[] {
  const collator = new Intl.Collator(uiLocale());
  const byName = (a: Nature, b: Nature) => collator.compare(natureName(a), natureName(b));
  if (sort === 'az') return [{ heading: null, natures: [...NATURES].sort(byName) }];
  const groups: Group[] = STATS.map((stat) => ({
    heading: t('nature.raises', { stat: statLabel(stat) }),
    natures: NATURES.filter((n) => EFFECTS[n]?.[0] === stat)
      .sort((a, b) => STATS.indexOf(EFFECTS[a]![1]) - STATS.indexOf(EFFECTS[b]![1])),
  }));
  groups.push({ heading: t('nature.neutral'), natures: NATURES.filter((n) => !EFFECTS[n]).sort(byName) });
  return groups;
}

function Effect({ nature }: { nature: Nature }) {
  const fx = EFFECTS[nature];
  return <span className="nature-effect">{fx ? <><b>+{statLabel(fx[0])}</b> −{statLabel(fx[1])}</> : t('nature.neutral')}</span>;
}

/**
 * Nature picker whose list always opens downward, in the flow of the sheet, and scrolls into
 * view (native selects open upward near the bottom of the screen, where sheets live).
 * Sorts A–Z or by stat, and remembers which.
 */
export function NaturePicker({ value, onChange }: { value: Nature | null; onChange: (nature: Nature | null) => void }) {
  const [sort, setSort] = useNatureSort();
  const groups = useMemo(() => buildGroups(sort), [sort, uiLocale()]);
  const options = useMemo<(Nature | null)[]>(() => [null, ...groups.flatMap((g) => g.natures)], [groups]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => { if (open) setActive(Math.max(0, options.indexOf(value))); }, [open, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    revealWithin(list?.closest<HTMLElement>('.sheet') ?? null, list?.parentElement ?? null, true);
    revealWithin(list, list?.querySelector<HTMLElement>(`[data-index="${active}"]`) ?? null);
  }, [open, active]);

  const choose = (index: number) => {
    onChange(options[index] ?? null);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); setOpen(true); return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
  };

  const optionRow = (nature: Nature | null, index: number) => (
    <li
      key={nature ?? 'none'}
      id={`${id}-opt-${index}`}
      data-index={index}
      role="option"
      aria-selected={nature === value}
      className={index === active ? 'is-active' : undefined}
      onMouseEnter={() => setActive(index)}
      onClick={() => choose(index)}
    >
      <span>{nature ? natureName(nature) : t('nature.none')}</span>
      {nature && <Effect nature={nature} />}
    </li>
  );

  let index = 1; // 0 is "Not set"
  return (
    <div className="picker">
      <span className="picker-label" id={`${id}-label`}>{t('nature.label')}</span>
      <button
        ref={buttonRef}
        type="button"
        className="picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span id={`${id}-value`}>{value ? natureName(value) : t('nature.none')}</span>
        {value && <Effect nature={value} />}
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="picker-panel">
          <div className="picker-sort" role="group" aria-label={t('nature.sort')}>
            {(['stat', 'az'] as const).map((option) => (
              <button key={option} type="button" aria-pressed={sort === option} onClick={() => setSort(option)}>
                {t(option === 'az' ? 'nature.sort.az' : 'nature.sort.stat')}
              </button>
            ))}
          </div>
          <ul ref={listRef} id={`${id}-list`} role="listbox" className="picker-list" aria-labelledby={`${id}-label`}>
            {optionRow(null, 0)}
            {groups.map((group, g) => (
              <Fragment key={g}>
                {group.heading && <li role="presentation" className="picker-group">{group.heading}</li>}
                {group.natures.map((nature) => optionRow(nature, index++))}
              </Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
