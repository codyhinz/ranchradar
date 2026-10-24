import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { variantName, variantsOf } from '../catalog';
import { revealWithin } from './reveal';
import { t, uiLocale } from '../i18n';
import { Sprite } from './Sprite';

/**
 * Picks a cosmetic version (flavor, color, trim, plumage). Same downward-opening list as the
 * nature picker, with a small picture of each version so the right one is easy to spot.
 */
export function VariantPicker({ formId, value, onChange }: {
  formId: string;
  value: string | null;
  onChange: (variant: string | null) => void;
}) {
  const options: (string | null)[] = [null, ...variantsOf(formId).map((v) => v.id)];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const label = (variant: string | null) => (variant ? variantName(variant, uiLocale()) : t('variant.none'));

  useEffect(() => { if (open) setActive(Math.max(0, options.indexOf(value))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
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

  return (
    <div className="picker">
      <span className="picker-label" id={`${id}-label`}>{t('variant.label')}</span>
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
        <span id={`${id}-value`} className="variant-value">
          {value && <Sprite id={formId} variant={value} size={28} />}
          {label(value)}
        </span>
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="picker-panel">
          <ul ref={listRef} id={`${id}-list`} role="listbox" className="picker-list" aria-labelledby={`${id}-label`}>
            {options.map((variant, index) => (
              <li
                key={variant ?? 'none'}
                id={`${id}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={variant === value}
                className={index === active ? 'is-active' : undefined}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span className="variant-option">
                  {variant && <Sprite id={formId} variant={variant} size={32} />}
                  {label(variant)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
