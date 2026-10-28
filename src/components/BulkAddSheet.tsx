import { useMemo, useRef, useState } from 'react';
import { catalog, displayName, searchForms, type NameLocale } from '../catalog';
import type { FormOwnership } from '../data/ownership';
import type { RosterStatus } from '../data/types';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import { OwnIcon } from './ResultRow';
import { Sprite } from './Sprite';

const LONG_PRESS_MS = 450;
const byDex = [...catalog].sort((a, b) => a.dexNumber - b.dexNumber);

/**
 * First-time setup: every Pokémon legal this season in one grid. Tap stages a copy with the
 * chosen status, long-press stages the other one, tapping again unstages it. Nothing is saved
 * until Add, which writes them all in one go (with one Undo).
 */
export function BulkAddSheet({ locale, summaries, slotsFree, onAdd, onOpenSettings, onClose }: {
  locale: NameLocale;
  summaries: Map<string, FormOwnership>;
  slotsFree: number;
  onAdd: (picks: Array<{ formId: string; status: RosterStatus }>) => Promise<void>;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const [tapAs, setTapAs] = useState<RosterStatus>('permanent');
  const [picks, setPicks] = useState<Map<string, RosterStatus>>(new Map());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const shown = useMemo(() => (query.trim() ? searchForms(query, locale, byDex) : byDex), [query, locale]);
  const other: RosterStatus = tapAs === 'permanent' ? 'trial' : 'permanent';

  const stage = (formId: string, status: RosterStatus) => setPicks((prev) => {
    const next = new Map(prev);
    if (next.get(formId) === status) next.delete(formId); else next.set(formId, status);
    return next;
  });

  const count = picks.size;
  const over = count > slotsFree;
  const submit = async () => {
    setSaving(true);
    try { await onAdd([...picks].map(([formId, status]) => ({ formId, status }))); }
    finally { setSaving(false); }
  };

  return (
    <Dialog title={t('bulk.title')} onClose={onClose}>
      <p className="sheet-sub">{t('bulk.hint')}</p>
      <div className="bulk-controls">
        <fieldset className="segmented">
          <legend className="visually-hidden">{t('bulk.tapAs')}</legend>
          {(['permanent', 'trial'] as const).map((status) => (
            <label key={status} className="segment" data-status={status}>
              <input type="radio" name="bulk-tap" checked={tapAs === status} onChange={() => setTapAs(status)} />
              <span>{t(status === 'permanent' ? 'bulk.tapPermanent' : 'bulk.tapTrial')}</span>
            </label>
          ))}
        </fieldset>
        <p className="bulk-long">{t(other === 'trial' ? 'bulk.longTrial' : 'bulk.longPermanent')}</p>
        <label className="field bulk-filter">
          <span className="visually-hidden">{t('bulk.filter')}</span>
          <input type="search" autoComplete="off" spellCheck={false} placeholder={t('bulk.filter')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="bulk-none">{t('search.none', { query: query.trim() })}</p>
      ) : (
        <ul className="bulk-grid">
          {shown.map((form) => (
            <BulkTile
              key={form.id}
              formId={form.id}
              name={displayName(form.id, locale)}
              owned={summaries.get(form.id)?.total ?? 0}
              picked={picks.get(form.id) ?? null}
              onTap={() => stage(form.id, tapAs)}
              onLongPress={() => stage(form.id, other)}
            />
          ))}
        </ul>
      )}

      <div className="bulk-foot" data-over={over}>
        <span className="bulk-tally" aria-live="polite">
          {count === 0
            ? t('bulk.none', { free: slotsFree })
            : over
              ? t('bulk.over', { count, free: slotsFree })
              : t('bulk.tally', { count, free: slotsFree - count })}
        </span>
        {over && <button type="button" className="link-button" onClick={onOpenSettings}>{t('settings.box')}</button>}
        <button type="button" className="button button-primary" disabled={count === 0 || over || saving} onClick={() => void submit()}>
          {t('bulk.submit', { count })}
        </button>
      </div>
    </Dialog>
  );
}

function BulkTile({ formId, name, owned, picked, onTap, onLongPress }: {
  formId: string;
  name: string;
  owned: number;
  picked: RosterStatus | null;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const cancel = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } };
  const state = picked ? t(picked === 'permanent' ? 'bulk.pickedPermanent' : 'bulk.pickedTrial') : '';
  return (
    <li className="bulk-tile" data-picked={picked ?? undefined}>
      <button
        type="button"
        aria-pressed={picked !== null}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          longPressed.current = false;
          cancel();
          timer.current = window.setTimeout(() => {
            timer.current = null;
            longPressed.current = true;
            navigator.vibrate?.(12);
            onLongPress();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          if (longPressed.current) { longPressed.current = false; return; }
          onTap();
        }}
      >
        {picked && <span className="bulk-mark" aria-hidden="true"><OwnIcon state={picked} /></span>}
        {owned > 0 && <span className="bulk-owned" aria-hidden="true">{t('bulk.owned', { count: owned })}</span>}
        <Sprite id={formId} size={56} />
        <span className="bulk-name">{name}</span>
        <span className="visually-hidden">
          {owned > 0 ? `, ${t('roster.copies', { count: owned })}` : ''}{state ? `, ${state}` : ''}
        </span>
      </button>
    </li>
  );
}
