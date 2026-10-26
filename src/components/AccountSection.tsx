import { useState, type FormEvent } from 'react';
import { authErrorKey } from '../app/authErrors';
import type { AuthState } from '../app/useAuth';
import { supabase } from '../data/cloud/supabase';
import { t, type MessageKey } from '../i18n';

type Mode = 'signIn' | 'signUp' | 'reset';
const MIN_PASSWORD = 8;

/**
 * Email + password accounts. Signing in doesn't touch the roster yet: it stays on this device
 * until sync ships, and signing out never deletes it.
 */
export function AccountSection({ auth, recovering, onRecovered, say }: {
  auth: AuthState;
  /** Arrived from a password-reset link: ask for the new password first. */
  recovering: boolean;
  onRecovered: () => void;
  say: (text: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  // Shown after sign-up or a reset request: the next step happens in their inbox.
  const [sent, setSent] = useState<string | null>(null);

  if (!supabase || auth.status === 'unavailable') return null;
  const client = supabase;
  // Links in emails come back to this page; the client picks the tokens up from the URL.
  const redirectTo = window.location.origin;

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); }
    catch (err) { setError(authErrorKey(err)); }
    finally { setBusy(false); }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === 'signIn') {
        const { error: err } = await client.auth.signInWithPassword({ email, password });
        if (err) throw err;
        setPassword('');
        say(t('auth.signedIn'));
      } else if (mode === 'signUp') {
        const { data, error: err } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (err) throw err;
        setPassword('');
        // With email confirmation on (the default) there's no session until they click the link.
        // An address that already has an account gets the same answer, so accounts can't be probed.
        if (data.session) say(t('auth.signedIn'));
        else setSent(t('auth.checkEmail', { email }));
      } else {
        const { error: err } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (err) throw err;
        setSent(t('auth.resetSent', { email }));
      }
    });
  };

  const setNewPassword = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { error: err } = await client.auth.updateUser({ password });
      if (err) throw err;
      setPassword('');
      onRecovered();
      say(t('auth.passwordUpdated'));
    });
  };

  const switchTo = (next: Mode) => { setMode(next); setError(null); setSent(null); };
  const errorLine = error && <p className="auth-error" role="alert">{t(error)}</p>;

  return (
    <fieldset className="account">
      <legend>{t('settings.account')}</legend>

      {auth.status === 'loading' && <small className="hint">{t('loading')}</small>}

      {auth.status === 'signedIn' && recovering && (
        <form className="auth-form" onSubmit={setNewPassword}>
          <small className="hint">{t('auth.newPasswordHint')}</small>
          <label className="field">
            <span>{t('auth.newPassword')}</span>
            <input type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {errorLine}
          <div className="auth-actions">
            <button type="submit" className="button button-primary" disabled={busy}>{t('auth.savePassword')}</button>
          </div>
        </form>
      )}

      {auth.status === 'signedIn' && !recovering && (
        <div className="account-signed-in">
          <p className="account-email">{t('auth.signedInAs', { email: auth.email })}</p>
          <small className="hint">{t('auth.localForNow')}</small>
          {errorLine}
          <div className="auth-actions">
            <button
              type="button"
              className="button button-quiet"
              disabled={busy}
              onClick={() => void run(async () => {
                // This device only; other signed-in devices stay signed in.
                const { error: err } = await client.auth.signOut({ scope: 'local' });
                if (err) throw err;
                say(t('auth.signedOut'));
              })}
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      )}

      {auth.status === 'signedOut' && (sent ? (
        <div className="auth-sent" role="status">
          <p>{sent}</p>
          <button type="button" className="link-button" onClick={() => switchTo('signIn')}>{t('auth.backToSignIn')}</button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <small className="hint">{t(mode === 'reset' ? 'auth.resetHint' : 'auth.why')}</small>
          <label className="field">
            <span>{t('auth.email')}</span>
            <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value.trim())} />
          </label>
          {mode !== 'reset' && (
            <label className="field">
              <span>{t('auth.password')}</span>
              <input
                type="password"
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signUp' ? MIN_PASSWORD : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'signUp' && <small className="field-hint">{t('auth.passwordRule', { min: MIN_PASSWORD })}</small>}
            </label>
          )}
          {errorLine}
          <div className="auth-actions">
            <button type="submit" className="button button-primary" disabled={busy}>
              {t(mode === 'signIn' ? 'auth.signIn' : mode === 'signUp' ? 'auth.createAccount' : 'auth.sendReset')}
            </button>
          </div>
          <div className="auth-switch">
            {mode === 'signIn' ? (
              <>
                <button type="button" className="link-button" onClick={() => switchTo('signUp')}>{t('auth.toSignUp')}</button>
                <button type="button" className="link-button" onClick={() => switchTo('reset')}>{t('auth.forgot')}</button>
              </>
            ) : (
              <button type="button" className="link-button" onClick={() => switchTo('signIn')}>{t('auth.backToSignIn')}</button>
            )}
          </div>
        </form>
      ))}
    </fieldset>
  );
}
