import type React from 'react';
import type { CatalogForm, NameLocale } from '../catalog';
import { currentRegulation, displayName, isInSeason, variantName } from '../catalog';
import type { FormOwnership } from '../data/ownership';
import type { RosterStatus } from '../data/types';
import { ownershipText, t } from '../i18n';
import { Sprite } from './Sprite';
import { StopSign } from './StopSign';
import { TypeTags } from './TypeTags';

interface ResultRowProps {
  form: CatalogForm;
  ownership: FormOwnership | undefined;
  locale: NameLocale;
  onQuickAdd: (status: RosterStatus) => void;
  onAddWithDetails: () => void;
  onOpen: () => void;
}

export function ownershipState(o: FormOwnership | undefined): 'none' | 'trial' | 'permanent' {
  if (!o || o.total === 0) return 'none';
  return o.permanent > 0 ? 'permanent' : 'trial';
}

/** A search result: who it is, whether you own it, whether it's legal this season, and the three add buttons. */
export function ResultRow({ form, ownership, locale, index = 0, onQuickAdd, onAddWithDetails, onOpen }: ResultRowProps & { index?: number }) {
  const name = displayName(form.id, locale);
  const state = ownershipState(ownership);
  const inSeason = isInSeason(form.id);
  return (
    <li className="row enter" data-own={state} data-season={inSeason ? undefined : 'out'} style={{ '--i': Math.min(index, 12) } as React.CSSProperties}>
      <button type="button" className="row-main" onClick={onOpen} disabled={state === 'none'}>
        <Sprite id={form.id} />
        <span className="row-text">
          <span className="row-name">{name}</span>
          <span className="row-meta">
            <span className="own-label" data-own={state} key={ownershipText(ownership)}>
              {state !== 'none' && <OwnIcon state={state} />}
              {state === 'none' ? t('own.none') : ownershipText(ownership)}
            </span>
            {!inSeason && <span className="season-tag"><StopSign />{t('season.out', { id: currentRegulation.id })}</span>}
            <TypeTags types={form.types} />
            {ownership && ownership.variants.length > 0 && (
              <span className="row-variants">{ownership.variants.map((v) => variantName(v, locale)).join(', ')}</span>
            )}
          </span>
        </span>
      </button>
      <span className="row-actions">
        <button type="button" className="add add-permanent" onClick={() => onQuickAdd('permanent')} aria-label={t('add.permanent', { name })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span className="add-label">{t('status.permanent')}</span>
        </button>
        <button type="button" className="add add-trial" onClick={() => onQuickAdd('trial')} aria-label={t('add.trial', { name })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" /></svg>
          <span className="add-label">{t('status.trial')}</span>
        </button>
        <button type="button" className="add add-more" onClick={onAddWithDetails} aria-label={t('add.details', { name })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
        </button>
      </span>
    </li>
  );
}

/** Check for owned permanently, hourglass for trial-only. */
export function OwnIcon({ state }: { state: 'trial' | 'permanent' }) {
  return state === 'permanent' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" /></svg>
  );
}
