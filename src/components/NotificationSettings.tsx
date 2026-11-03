import { useState } from 'react';
import { PushError } from '../app/push';
import { TRIAL_LEADS, type Notifications, type TrialLead } from '../app/useNotifications';
import { t, type MessageKey } from '../i18n';

const LEAD_LABEL: Record<string, MessageKey> = {
  60: 'remind.lead.60', 360: 'remind.lead.360', 1440: 'remind.lead.1440', 2880: 'remind.lead.2880', off: 'remind.lead.off',
};

export function formatReminderTime(at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(at);
}

/**
 * Settings → Reminders. Signed out, it explains that reminders come with an account. Signed in,
 * it turns notifications on for this device, sets the ranch refresh reminder (22 hours, or the
 * time left after a Quick Coupon) and picks how early trial reminders come.
 */
export function NotificationSettings({ notify, signedIn, locale, onSignIn, say }: {
  notify: Notifications;
  signedIn: boolean;
  locale: string;
  onSignIn: () => void;
  say: (text: string, onUndo?: () => void) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [hours, setHours] = useState(21);
  const [minutes, setMinutes] = useState(0);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); }
    catch (error) {
      const code = error instanceof PushError ? error.code : null;
      say(t(code === 'denied' ? 'remind.denied' : code === 'no-worker' ? 'remind.noWorker' : code === 'unsupported' ? 'remind.unsupported'
        : navigator.onLine === false ? 'auth.error.offline' : 'auth.error.generic'));
    } finally { setBusy(false); }
  };

  const setRanch = (minutesFromNow?: number) => run(async () => {
    const previous = notify.ranchAt;
    const at = await notify.setRanch(minutesFromNow);
    setCustom(false);
    say(t('remind.ranchSet', { time: formatReminderTime(at, locale) }), () => void notify.restoreRanch(previous));
  });

  return (
    <section className="backup reminders" id="reminders" aria-labelledby="reminders-heading">
      <h3 id="reminders-heading" className="section-label">{t('remind.title')}</h3>
      <small className="hint">{t('remind.hint')}</small>

      {!signedIn ? (
        <div className="backup-actions">
          <button type="button" className="button button-quiet" onClick={onSignIn}>{t('remind.signIn')}</button>
        </div>
      ) : (<>
        <div className="reminder-device">
          {notify.support === 'needs-install' && <p className="field-hint">{t('remind.needsInstall')}</p>}
          {notify.support === 'unsupported' && <p className="field-hint">{t('remind.unsupported')}</p>}
          {notify.support === 'blocked' && <p className="field-hint">{t('remind.blocked')}</p>}
          {notify.support === 'ready' && (
            <div className="reminder-row">
              <span aria-live="polite">{t(notify.thisDevice ? 'remind.device.on' : 'remind.device.off')}</span>
              {notify.thisDevice ? (
                <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => void run(async () => { await notify.turnOff(); say(t('remind.off')); })}>{t('remind.turnOff')}</button>
              ) : (
                <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void run(async () => { await notify.turnOn(); say(t('remind.on')); })}>{t('remind.turnOn')}</button>
              )}
            </div>
          )}
          {notify.loaded && !notify.anyDevice && notify.support !== 'ready' && <p className="field-hint">{t('remind.noDevices')}</p>}
        </div>

        <fieldset className="reminder-group">
          <legend>{t('remind.ranch')}</legend>
          <p className="field-hint" aria-live="polite">
            {notify.ranchAt ? t('remind.ranchNext', { time: formatReminderTime(notify.ranchAt, locale) }) : t('remind.ranchNone')}
          </p>
          <div className="backup-actions">
            <button type="button" className="button button-quiet" disabled={busy} onClick={() => void setRanch()}>
              <RecruitedIcon />{t('remind.recruited')}
            </button>
            <button type="button" className="button button-quiet" aria-expanded={custom} disabled={busy} onClick={() => setCustom(!custom)}>{t('remind.timeLeft')}</button>
            {notify.ranchAt && (
              <button type="button" className="button button-quiet" disabled={busy} onClick={() => void run(async () => { await notify.clearRanch(); say(t('remind.ranchCleared')); })}>{t('remind.cancel')}</button>
            )}
          </div>
          {custom && (
            <div className="reminder-custom">
              <small className="hint">{t('remind.timeLeftHint')}</small>
              <div className="reminder-time">
                <label className="field">
                  <span>{t('remind.hours')}</span>
                  <input type="number" inputMode="numeric" min={0} max={21} value={hours} onChange={(e) => setHours(clamp(e.target.valueAsNumber, 0, 21))} />
                </label>
                <label className="field">
                  <span>{t('remind.minutes')}</span>
                  <input type="number" inputMode="numeric" min={0} max={59} value={minutes} onChange={(e) => setMinutes(clamp(e.target.valueAsNumber, 0, 59))} />
                </label>
                <button type="button" className="button button-primary" disabled={busy || hours * 60 + minutes < 1} onClick={() => void setRanch(hours * 60 + minutes)}>{t('remind.setTime')}</button>
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="chips reminder-chips">
          <legend>{t('remind.trial')}</legend>
          {TRIAL_LEADS.map((lead) => (
            <label key={String(lead)} className="chip">
              <input type="radio" name="trial-lead" checked={notify.trialLead === lead} disabled={busy}
                onChange={() => void run(async () => { await notify.setTrialLead(lead as TrialLead); })} />
              <span>{t(LEAD_LABEL[lead ?? 'off']!)}</span>
            </label>
          ))}
        </fieldset>
      </>)}
    </section>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}

/** An hourglass with a bell's clapper: "time until the ranch is back". */
export function RecruitedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5M16 3.5c0 4-4 5-4 8.5M8 20.5c0-4 4-5 4-8.5M16 20.5c0-4-4-5-4-8.5" />
      <path d="M10 17.5h4" />
    </svg>
  );
}
