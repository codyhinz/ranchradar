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
export function FormSheet({ formId, name, entries, onSave, onRemove, onAddAnother, onClose }: FormSheetProps) {
  const list = ordered(entries);
  const [editingId, setEditingId] = useState<string | null>(list.length === 1 ? list[0]!.id : null);
  return (
    <Dialog title={t('form.entries', { name })} onClose={onClose}>
      <p className="sheet-sub">{t('form.copies', { count: list.length })}</p>
      <ul className="copies">
        {list.map((entry, index) => (
          <EntryCard
            index={index}
            key={entry.id}
            entry={entry}
            formId={formId}
            label={list.length > 1 ? t('form.copyLabel', { n: index + 1, total: list.length }) : name}
            editing={editingId === entry.id}
            onToggle={() => setEditingId(editingId === entry.id ? null : entry.id)}
            onSave={async (patch) => { await onSave(entry.id, patch); setEditingId(null); }}
            onRemove={() => onRemove(entry)}
          />
        ))}
      </ul>
      <div className="sheet-actions">
        <button type="button" className="button button-quiet" onClick={onAddAnother}>{t('form.addAnother')}</button>
      </div>
    </Dialog>
  );
}

function natureLabel(nature: string | null): string {
  return nature && (NATURES as readonly string[]).includes(nature) ? natureName(nature as Nature) : t('nature.none');
}

function EntryCard({ entry, formId, label, editing, index, onToggle, onSave, onRemove }: {
  entry: RosterEntry;
  index: number;
  formId: string;
  label: string;
  editing: boolean;
  onToggle: () => void;
  onSave: (patch: RosterPatch) => Promise<void>;
  onRemove: () => void;
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
    <li className="copy enter" data-badge={badge} style={{ '--i': index } as React.CSSProperties}>
      <div className="copy-head">
        <span className="copy-sprite"><Sprite id={formId} variant={entry.variant} size={66} /></span>
        <div className="copy-info">
          <span className="copy-label">{label}</span>
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
        <button type="button" className="copy-edit" aria-expanded={editing} onClick={onToggle} aria-label={t('entry.editCopy', { label })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
        </button>
      </div>
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
