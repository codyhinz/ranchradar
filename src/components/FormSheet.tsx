import type React from 'react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NATURES, type Nature } from '../data/types';
import { natureName } from './NaturePicker';
import type { RosterEntry, RosterPatch } from '../data/types';
import { t, uiLocale } from '../i18n';
import { Dialog } from './Dialog';
import { EntryFields, expiresAfter, newDraft, type EntryDraft } from './EntryFields';
import { Sprite } from './Sprite';
import { variantName } from '../catalog';

interface FormSheetProps {
  formId: string;
  name: string;
  entries: RosterEntry[];
  onSave: (id: string, patch: RosterPatch) => Promise<void>;
  onRemove: (entry: RosterEntry) => Promise<void>;
  /** Expired trial recruited for good in-game (2,500 VP or a Teammate Ticket). */
  onMakePermanent: (entry: RosterEntry) => Promise<void>;
  /** Expired trial sent back to the Ranch in-game, freeing its box slot. */
  onReturn: (entry: RosterEntry) => Promise<void>;
  /** Removes several copies at once (with Undo). */
  onRemoveMany: (entries: RosterEntry[]) => Promise<void>;
  onAddAnother: () => void;
  onClose: () => void;
}

const formatDate = (date: Date) => new Intl.DateTimeFormat(uiLocale(), { month: 'short', day: 'numeric' }).format(date);
type Badge = 'permanent' | 'trial' | 'expired';

function badgeOf(entry: RosterEntry, now = new Date()): Badge {
  if (entry.status === 'permanent') return 'permanent';
  return entry.trial_expires_at && new Date(entry.trial_expires_at) <= now ? 'expired' : 'trial';
}

export function statusLine(entry: RosterEntry, now = new Date()): string {
  if (entry.status === 'permanent') return t('entry.permanent');
  if (!entry.trial_expires_at) return t('status.trial');
  const expires = new Date(entry.trial_expires_at);
  return t(expires <= now ? 'entry.trialExpired' : 'entry.trialExpires', { date: formatDate(expires) });
}

/** Permanent copies first, then trials soonest-expiring first. */
function ordered(entries: RosterEntry[]): RosterEntry[] {
  return [...entries].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'permanent' ? -1 : 1;
    return (a.trial_expires_at ?? a.created_at).localeCompare(b.trial_expires_at ?? b.created_at);
  });
}

/** Every copy of one form as its own card: picture, status and details at a glance; tap to edit. */
export function FormSheet({ formId, name, entries, onSave, onRemove, onMakePermanent, onReturn, onRemoveMany, onAddAnother, onClose }: FormSheetProps) {
  const list = ordered(entries);
  const [editingId, setEditingId] = useState<string | null>(list.length === 1 ? list[0]!.id : null);
  // Select mode: tick copies, then remove them in one go (e.g. clearing out duplicates).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const live = new Set(list.map((e) => e.id));
  const picked = [...selected].filter((id) => live.has(id));
  const allPicked = picked.length === list.length;
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const startSelecting = () => { setEditingId(null); setSelected(new Set()); setSelecting(true); };
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
  const removePicked = async () => {
    const chosen = list.filter((e) => selected.has(e.id));
    stopSelecting();
    await onRemoveMany(chosen);
  };
  return (
    <Dialog title={t('form.entries', { name })} onClose={onClose}>
      <div className="sheet-sub-row">
        <p className="sheet-sub">{selecting ? t('form.selected', { count: picked.length }) : t('form.copies', { count: list.length })}</p>
        {list.length > 1 && (
          <button type="button" className="button button-quiet button-small" aria-pressed={selecting} onClick={selecting ? stopSelecting : startSelecting}>
            {t(selecting ? 'form.selectDone' : 'form.select')}
          </button>
        )}
      </div>
      <ul className="copies" data-selecting={selecting}>
        {list.map((entry, index) => (
          <EntryCard
            index={index}
            key={entry.id}
            entry={entry}
            formId={formId}
            name={name}
            label={list.length > 1 ? t('form.copyLabel', { n: index + 1, total: list.length }) : name}
            editing={editingId === entry.id}
            onToggle={() => setEditingId(editingId === entry.id ? null : entry.id)}
            onSave={async (patch) => { await onSave(entry.id, patch); setEditingId(null); }}
            onRemove={() => onRemove(entry)}
            onMakePermanent={() => onMakePermanent(entry)}
            onReturn={() => onReturn(entry)}
            selecting={selecting}
            selected={selected.has(entry.id)}
            onSelect={() => toggle(entry.id)}
          />
        ))}
      </ul>
      {selecting ? (
        <div className="select-bar">
          <button type="button" className="button button-quiet" onClick={() => setSelected(allPicked ? new Set() : new Set(list.map((e) => e.id)))}>
            {t(allPicked ? 'form.selectNone' : 'form.selectAll')}
          </button>
          <button type="button" className="button button-danger" disabled={picked.length === 0} onClick={() => void removePicked()}>
            {t('form.removeSelected', { count: picked.length })}
          </button>
        </div>
      ) : (
        <div className="sheet-actions">
          <button type="button" className="button button-quiet" onClick={onAddAnother}>{t('form.addAnother')}</button>
        </div>
      )}
    </Dialog>
  );
}

function natureLabel(nature: string | null): string {
  return nature && (NATURES as readonly string[]).includes(nature) ? natureName(nature as Nature) : t('nature.none');
}

function EntryCard({ entry, formId, name, label, editing, index, onToggle, onSave, onRemove, onMakePermanent, onReturn, selecting, selected, onSelect }: {
  entry: RosterEntry;
  index: number;
  formId: string;
  /** Shown on the card; `label` ("Copy 1 of 2") still tells copies apart for screen readers. */
  name: string;
  label: string;
  editing: boolean;
  onToggle: () => void;
  onSave: (patch: RosterPatch) => Promise<void>;
  onRemove: () => void;
  onMakePermanent: () => void;
  onReturn: () => void;
  selecting: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = badgeOf(entry);
  // React 18's types don't know `inert` yet, so set it directly: collapsed fields can't be tabbed into.
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { drawerRef.current?.toggleAttribute('inert', !editing); }, [editing]);
  const initial: EntryDraft = newDraft(entry.status, { nature: entry.nature, variant: entry.variant, notes: entry.notes, trialExpiresAt: entry.trial_expires_at });
  const [draft, setDraft] = useState(initial);
  // Opening the editor starts from the trial's current time left.
  useEffect(() => { if (editing) setDraft(initial); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = draft.status !== initial.status || draft.nature !== initial.nature || draft.variant !== initial.variant || draft.notes !== initial.notes
    || (draft.status === 'trial' && draft.trialTouched);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const patch: RosterPatch = { status: draft.status, nature: draft.nature, variant: draft.variant, notes: draft.notes.trim() || null };
    if (draft.status === 'trial' && draft.trialTouched) patch.trial_expires_at = expiresAfter(draft.trialDays, draft.trialHours);
    await onSave(patch);
  };
  return (
    <li className="copy enter" data-badge={badge} data-selected={selecting && selected} style={{ '--i': index } as React.CSSProperties}>
      <div className="copy-head" onClick={selecting ? onSelect : undefined}>
        {selecting && (
          <input
            type="checkbox"
            className="copy-check"
            checked={selected}
            onChange={onSelect}
            onClick={(event) => event.stopPropagation()}
            aria-label={t('form.selectCopy', { label })}
          />
        )}
        <span className="copy-sprite"><Sprite id={formId} variant={entry.variant} size={66} /></span>
        <div className="copy-info">
          <span className="copy-label">{name}</span>
          <div className="copy-details">
          <span className="status-badge" data-badge={badge}>
            {badge === 'permanent' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" /></svg>
            )}
            {statusLine(entry)}
          </span>
          <span className="copy-meta">
            {entry.variant && <span className="copy-variant">{variantName(entry.variant, uiLocale())} · </span>}
            {t('nature.label')}: {natureLabel(entry.nature)}
            {entry.notes && <span className="copy-notes">{entry.notes}</span>}
          </span>
          </div>
        </div>
        {!selecting && (
          <span className="copy-buttons">
            <button type="button" className="copy-edit copy-remove" onClick={onRemove} aria-label={t('entry.removeCopy', { label })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
            <button type="button" className="copy-edit" aria-expanded={editing} onClick={onToggle} aria-label={t('entry.editCopy', { label })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
            </button>
          </span>
        )}
      </div>
      {/* An expired trial can't battle: the two things a player does with one in-game */}
      {badge === 'expired' && !selecting && !editing && (
        <div className="expired-actions">
          <button type="button" className="button button-primary button-small" onClick={onMakePermanent} aria-label={t('expired.makePermanentCopy', { label })}>
            {t('expired.makePermanent')}
          </button>
          <button type="button" className="button button-quiet button-small" onClick={onReturn} aria-label={t('expired.returnCopy', { label })}>
            {t('expired.return')}
          </button>
        </div>
      )}
      {/* Always rendered so it can grow open smoothly; inert while collapsed. */}
      <div className="copy-drawer" data-open={editing} ref={drawerRef}>
        <div className="copy-drawer-inner">
          <form onSubmit={submit} className="copy-form">
            <EntryFields formId={formId} draft={draft} onChange={setDraft} idPrefix={entry.id} />
            <div className="sheet-actions">
              <button type="button" className="button button-danger" onClick={onRemove}>{t('entry.delete')}</button>
              <button type="submit" className="button button-primary" disabled={!dirty}>{t('entry.save')}</button>
            </div>
          </form>
        </div>
      </div>
    </li>
  );
}
