import { NATURES, type Nature, type RosterStatus } from '../data/types';
import { t } from '../i18n';

export interface EntryDraft {
  status: RosterStatus;
  nature: Nature | null;
  notes: string;
}

/** Status, nature and notes: shared by the add sheet and the entry editor. */
export function EntryFields({ draft, onChange, idPrefix }: {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  idPrefix: string;
}) {
  return (
    <div className="fields">
      <fieldset className="segmented">
        <legend>{t('status.label')}</legend>
        {(['permanent', 'trial'] as const).map((status) => (
          <label key={status} className="segment" data-status={status}>
            <input
              type="radio"
              name={`${idPrefix}-status`}
              checked={draft.status === status}
              onChange={() => onChange({ ...draft, status })}
            />
            <span>{t(status === 'permanent' ? 'status.permanent' : 'status.trial')}</span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>{t('nature.label')}</span>
        <select
          value={draft.nature ?? ''}
          onChange={(event) => onChange({ ...draft, nature: (event.target.value || null) as Nature | null })}
        >
          <option value="">{t('nature.none')}</option>
          {NATURES.map((nature) => (
            <option key={nature} value={nature}>{nature[0]!.toUpperCase() + nature.slice(1)}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('notes.label')}</span>
        <textarea
          rows={3}
          maxLength={500}
          value={draft.notes}
          placeholder={t('notes.placeholder')}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />
      </label>
    </div>
  );
}
