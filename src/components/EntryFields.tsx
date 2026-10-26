import { MAX_NOTES_LENGTH, TRIAL_DAYS, type Nature, type RosterStatus } from '../data/types';
import { NaturePicker } from './NaturePicker';
import { VariantPicker } from './VariantPicker';
import { variantsOf } from '../catalog';
import { t } from '../i18n';

const HOUR_MS = 3_600_000;

export interface EntryDraft {
  status: RosterStatus;
  nature: Nature | null;
  variant: string | null;
  notes: string;
  /** Time left on a trial, as the game shows it. Only saved when `trialTouched`. */
  trialDays: number;
  trialHours: number;
  trialTouched: boolean;
}

/** Days and hours left until `expiresAt`, rounded up to the hour like the game's timer. */
export function splitTimeLeft(expiresAt: string | null, now = new Date()): { days: number; hours: number } {
  if (!expiresAt) return { days: TRIAL_DAYS, hours: 0 };
  const hours = Math.max(0, Math.ceil((Date.parse(expiresAt) - now.getTime()) / HOUR_MS));
  return { days: Math.floor(hours / 24), hours: hours % 24 };
}

/** The expiry time for a trial with this much left. */
export function expiresAfter(days: number, hours: number, now = new Date()): string {
  return new Date(now.getTime() + (days * 24 + hours) * HOUR_MS).toISOString();
}

/** A fresh draft; pass the entry's expiry to start from its current time left. */
export function newDraft(status: RosterStatus, extra: { nature?: Nature | null; variant?: string | null; notes?: string | null; trialExpiresAt?: string | null } = {}): EntryDraft {
  const left = splitTimeLeft(status === 'trial' ? extra.trialExpiresAt ?? null : null);
  return { status, nature: extra.nature ?? null, variant: extra.variant ?? null, notes: extra.notes ?? '', trialDays: left.days, trialHours: left.hours, trialTouched: false };
}

const clamp = (value: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0);

/** Status, time left, variant, nature and notes: shared by the add sheet and the entry editor. */
export function EntryFields({ formId, draft, onChange, idPrefix }: {
  formId: string;
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  idPrefix: string;
}) {
  const setTime = (days: number, hours: number) => {
    const d = clamp(days, TRIAL_DAYS);
    onChange({ ...draft, trialDays: d, trialHours: d === TRIAL_DAYS ? 0 : clamp(hours, 23), trialTouched: true });
  };
  const nearLimit = draft.notes.length >= MAX_NOTES_LENGTH * 0.8;
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
      {draft.status === 'trial' && (
        <fieldset className="time-left">
          <legend>{t('trial.timeLeft')}</legend>
          <div className="time-left-inputs">
            <label className="time-unit">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={TRIAL_DAYS}
                value={draft.trialDays}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setTime(event.currentTarget.valueAsNumber, draft.trialHours)}
              />
              <span>{t('trial.daysUnit')}</span>
            </label>
            <label className="time-unit">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                value={draft.trialHours}
                disabled={draft.trialDays === TRIAL_DAYS}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setTime(draft.trialDays, event.currentTarget.valueAsNumber)}
              />
              <span>{t('trial.hoursUnit')}</span>
            </label>
          </div>
          <p className="field-hint">{t('trial.timeHint')}</p>
        </fieldset>
      )}
      {variantsOf(formId).length > 0 && (
        <VariantPicker formId={formId} value={draft.variant} onChange={(variant) => onChange({ ...draft, variant })} />
      )}
      <NaturePicker value={draft.nature} onChange={(nature) => onChange({ ...draft, nature })} />
      <label className="field">
        <span>{t('notes.label')}</span>
        <textarea
          rows={3}
          maxLength={MAX_NOTES_LENGTH}
          value={draft.notes}
          placeholder={t('notes.placeholder')}
          aria-describedby={nearLimit ? `${idPrefix}-notes-count` : undefined}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />
        {/* Appears near the limit, so the field never just silently stops taking text */}
        {nearLimit && (
          <small id={`${idPrefix}-notes-count`} className="notes-count" data-full={draft.notes.length >= MAX_NOTES_LENGTH} aria-live="polite">
            {t('notes.count', { count: draft.notes.length, max: MAX_NOTES_LENGTH })}
          </small>
        )}
      </label>
    </div>
  );
}
