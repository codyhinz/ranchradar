import { useState, type FormEvent } from 'react';
import { t } from '../i18n';
import { Dialog } from './Dialog';
import { EntryFields, type EntryDraft } from './EntryFields';
import { Sprite } from './Sprite';

interface AddSheetProps {
  formId: string;
  name: string;
  onAdd: (draft: EntryDraft) => Promise<void>;
  onClose: () => void;
}

export function AddSheet({ formId, name, onAdd, onClose }: AddSheetProps) {
  const [draft, setDraft] = useState<EntryDraft>({ status: 'permanent', nature: null, notes: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try { await onAdd(draft); } finally { setSaving(false); }
  };
  return (
    <Dialog title={t('add.title', { name })} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="sheet-hero"><Sprite id={formId} size={88} /></div>
        <EntryFields draft={draft} onChange={setDraft} idPrefix="add" />
        <div className="sheet-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="button button-primary" disabled={saving}>{t('add.submit')}</button>
        </div>
      </form>
    </Dialog>
  );
}
