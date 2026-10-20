import type React from 'react';
import { useState, type FormEvent } from 'react';
import { NATURES } from '../data/types';
import type { RosterEntry, RosterPatch } from '../data/types';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import { EntryFields, type EntryDraft } from './EntryFields';
import { Sprite } from './Sprite';

interface FormSheetProps {
  formId: string;
  name: string;
  entries: RosterEntry[];
  onSave: (id: string, patch: RosterPatch) => Promise<void>;
  onRemove: (entry: RosterEntry) => Promise<void>;
  onAddAnother: () => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
type Badge = 'permanent' | 'trial' | 'expired';

function badgeOf(entry: RosterEntry, now = new Date()): Badge {
  if (entry.status === 'permanent') return 'permanent';
  return entry.trial_expires_at && new Date(entry.trial_expires_at) <= now ? 'expired' : 'trial';
}

export function statusLine(entry: RosterEntry, now = new Date()): string {
  if (entry.status === 'permanent') return t('entry.permanent');
  if (!entry.trial_expires_at) return t('status.trial');
  const expires = new Date(entry.trial_expires_at);
  return t(expires <= now ? 'entry.trialExpired' : 'entry.trialExpires', { date: dateFormat.format(expires) });
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
  return nature && (NATURES as readonly string[]).includes(nature) ? nature[0]!.toUpperCase() + nature.slice(1) : t('nature.none');
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
  const initial: EntryDraft = { status: entry.status, nature: entry.nature, notes: entry.notes ?? '' };
  const [draft, setDraft] = useState(initial);
  const dirty = draft.status !== initial.status || draft.nature !== initial.nature || draft.notes !== initial.notes;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave({ status: draft.status, nature: draft.nature, notes: draft.notes.trim() || null });
  };
  return (
    <li className="copy enter" data-badge={badge} style={{ '--i': index } as React.CSSProperties}>
      <div className="copy-head">
        <span className="copy-sprite"><Sprite id={formId} size={56} /></span>
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
            {t('nature.label')}: {natureLabel(entry.nature)}
            {entry.notes && <span className="copy-notes">{entry.notes}</span>}
          </span>
        </div>
        <button type="button" className="copy-edit" aria-expanded={editing} onClick={onToggle} aria-label={t('entry.editCopy', { label })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
        </button>
      </div>
      {editing && (
        <form onSubmit={submit} className="copy-form">
          <EntryFields draft={draft} onChange={setDraft} idPrefix={entry.id} />
          <div className="sheet-actions">
            <button type="button" className="button button-danger" onClick={onRemove}>{t('entry.delete')}</button>
            <button type="submit" className="button button-primary" disabled={!dirty}>{t('entry.save')}</button>
          </div>
        </form>
      )}
    </li>
  );
}
