import { useState, type FormEvent } from 'react';
import type { RosterEntry, RosterPatch } from '../data/types';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import { EntryFields, type EntryDraft } from './EntryFields';

interface FormSheetProps {
  name: string;
  entries: RosterEntry[];
  onSave: (id: string, patch: RosterPatch) => Promise<void>;
  onRemove: (entry: RosterEntry) => Promise<void>;
  onAddAnother: () => void;
  onClose: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function statusLine(entry: RosterEntry, now = new Date()): string {
  if (entry.status === 'permanent') return t('entry.permanent');
  if (!entry.trial_expires_at) return t('status.trial');
  const expires = new Date(entry.trial_expires_at);
  return t(expires <= now ? 'entry.trialExpired' : 'entry.trialExpires', { date: dateFormat.format(expires) });
}

/** Every copy of one form you own, each editable in place. */
export function FormSheet({ name, entries, onSave, onRemove, onAddAnother, onClose }: FormSheetProps) {
  return (
    <Dialog title={t('form.entries', { name })} onClose={onClose}>
      <ul className="entries fence">
        {entries.map((entry) => (
          <EntryEditor key={entry.id} entry={entry} onSave={onSave} onRemove={onRemove} />
        ))}
      </ul>
      <div className="sheet-actions">
        <button type="button" className="button button-quiet" onClick={onAddAnother}>{t('form.addAnother')}</button>
      </div>
    </Dialog>
  );
}

function EntryEditor({ entry, onSave, onRemove }: {
  entry: RosterEntry;
  onSave: FormSheetProps['onSave'];
  onRemove: FormSheetProps['onRemove'];
}) {
  const initial: EntryDraft = { status: entry.status, nature: entry.nature, notes: entry.notes ?? '' };
  const [draft, setDraft] = useState(initial);
  const dirty = draft.status !== initial.status || draft.nature !== initial.nature || draft.notes !== initial.notes;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(entry.id, { status: draft.status, nature: draft.nature, notes: draft.notes.trim() || null });
  };
  return (
    <li className="entry" data-status={entry.status}>
      <form onSubmit={submit}>
        {entry.status === 'trial' && <p className="entry-status">{statusLine(entry)}</p>}
        <EntryFields draft={draft} onChange={setDraft} idPrefix={entry.id} />
        <div className="sheet-actions">
          <button type="button" className="button button-danger" onClick={() => onRemove(entry)}>{t('entry.delete')}</button>
          <button type="submit" className="button button-primary" disabled={!dirty}>{t('entry.save')}</button>
        </div>
      </form>
    </li>
  );
}
