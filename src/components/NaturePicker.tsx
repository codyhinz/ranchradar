import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { NATURES, type Nature } from '../data/types';
import { t } from '../i18n';

/** Raised and lowered stat for each nature; neutral natures have none. */
const EFFECTS: Partial<Record<Nature, [string, string]>> = {
  lonely: ['Atk', 'Def'], brave: ['Atk', 'Spe'], adamant: ['Atk', 'SpA'], naughty: ['Atk', 'SpD'],
  bold: ['Def', 'Atk'], relaxed: ['Def', 'Spe'], impish: ['Def', 'SpA'], lax: ['Def', 'SpD'],
  timid: ['Spe', 'Atk'], hasty: ['Spe', 'Def'], jolly: ['Spe', 'SpA'], naive: ['Spe', 'SpD'],
  modest: ['SpA', 'Atk'], mild: ['SpA', 'Def'], quiet: ['SpA', 'Spe'], rash: ['SpA', 'SpD'],
  calm: ['SpD', 'Atk'], gentle: ['SpD', 'Def'], sassy: ['SpD', 'Spe'], careful: ['SpD', 'SpA'],
};

const label = (nature: Nature) => nature[0]!.toUpperCase() + nature.slice(1);
const options: (Nature | null)[] = [null, ...NATURES];

/**
 * A nature picker whose list always opens downward, in the flow of the sheet, and scrolls
 * into view. Native selects open upward near the bottom of the screen, which is where sheets live.
 */
export function NaturePicker({ value, onChange }: { value: Nature | null; onChange: (nature: Nature | null) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.indexOf(value)));
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    list?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    list?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
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
    else if (/^[a-z]$/i.test(event.key)) {
      const next = options.findIndex((n, i) => i > 0 && n!.startsWith(event.key.toLowerCase()));
      if (next >= 0) setActive(next);
    }
  };

  const effect = value ? EFFECTS[value] : undefined;
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
        <span id={`${id}-value`}>{value ? label(value) : t('nature.none')}</span>
        {effect && <span className="nature-effect"><b>+{effect[0]}</b> −{effect[1]}</span>}
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul ref={listRef} id={`${id}-list`} role="listbox" className="picker-list" aria-labelledby={`${id}-label`}>
          {options.map((nature, index) => {
            const fx = nature ? EFFECTS[nature] : undefined;
            return (
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
                <span>{nature ? label(nature) : t('nature.none')}</span>
                {nature && <span className="nature-effect">{fx ? <><b>+{fx[0]}</b> −{fx[1]}</> : t('nature.neutral')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
