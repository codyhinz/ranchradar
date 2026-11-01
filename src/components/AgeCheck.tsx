import { useState } from 'react';
import { authErrorKey } from '../app/authErrors';
import { t, type MessageKey } from '../i18n';
import { Dialog } from './Dialog';

/**
 * Asked once per account, right after its first sign-in. Both answers are plain buttons of the
 * same weight, so the question doesn't steer anyone toward one of them. Under 13 deletes the
 * account straight away; closing without answering signs out.
 */
export function AgeCheck({ onYes, onNo, onClose }: {
  onYes: () => Promise<void>;
  onNo: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true); setError(null);
    try { await action(); }
    catch (err) { setError(authErrorKey(err)); setBusy(false); }
  };

  return (
    <Dialog title={t('age.title')} onClose={() => { if (!busy) onClose(); }}>
      <div className="age-check">
        <p>{t('age.body')}</p>
        <div className="age-check-actions">
          <button type="button" className="button" disabled={busy} onClick={run(onYes)}>{t('age.yes')}</button>
          <button type="button" className="button" disabled={busy} onClick={run(onNo)}>{t('age.no')}</button>
        </div>
        {error && <p className="auth-error" role="alert">{t(error)}</p>}
        <small className="hint">{t('age.closeHint')}</small>
      </div>
    </Dialog>
  );
}

/** Shown after an under-13 answer removed the account. */
export function AgeRemoved({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title={t('age.removed.title')} onClose={onClose}>
      <div className="age-check">
        <p>{t('age.removed.body')}</p>
        <button type="button" className="button button-primary" onClick={onClose}>{t('age.ok')}</button>
      </div>
    </Dialog>
  );
}
