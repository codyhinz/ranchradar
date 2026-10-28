import { Fragment, useState, type FormEvent } from 'react';
import { authErrorKey } from '../app/authErrors';
import type { AuthState } from '../app/useAuth';
import { supabase } from '../data/cloud/supabase';
import { t, type MessageKey } from '../i18n';
import { Dialog } from './Dialog';

type Mode = 'signIn' | 'signUp';
type Provider = 'google' | 'discord';
const MIN_PASSWORD = 8;
const PROVIDER_LABEL = { google: 'auth.google', discord: 'auth.discord' } as const;
const SIGNED_IN_WITH = { email: 'auth.with.email', google: 'auth.with.google', discord: 'auth.with.discord' } as const;

/**
 * Its own sheet, opened from the account button in the masthead. Google and Discord are one tap;
 * email and password sit underneath for anyone who'd rather not link either.
 * Signing out never deletes the roster on this device.
 */
export function AccountSheet({ auth, recovering, onRecovered, initialError, say, onClose }: {
  auth: AuthState;
  /** Arrived from a password-reset link: ask for the new password first. */
  recovering: boolean;
  onRecovered: () => void;
  /** A Google or Discord sign-in that came back without a session. */
  initialError: MessageKey | null;
  say: (text: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [resetting, setResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<Provider | 'email' | null>(null);
  const [error, setError] = useState<MessageKey | null>(initialError);
  // Shown after sign-up or a reset request: the next step happens in their inbox.
  const [sent, setSent] = useState<string | null>(null);

  if (!supabase || auth.status === 'unavailable') return null;
  const client = supabase;
  // Links in emails and provider sign-ins come back to this page; the client reads the tokens.
  const redirectTo = window.location.origin;

  const run = async (which: Provider | 'email', action: () => Promise<void>) => {
    setBusy(which); setError(null);
    try { await action(); setBusy(null); }
    catch (err) { setError(authErrorKey(err)); setBusy(null); }
  };

  const withProvider = (provider: Provider) => void run(provider, async () => {
    // Leaves the page for Google or Discord, so `busy` stays on until the browser navigates.
    const { error: err } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (err) throw err;
    await new Promise(() => {});
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run('email', async () => {
      if (resetting) {
        const { error: err } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (err) throw err;
        setSent(t('auth.resetSent', { email }));
      } else if (mode === 'signIn') {
        const { error: err } = await client.auth.signInWithPassword({ email, password });
        if (err) throw err;
        setPassword('');
        say(t('auth.signedIn'));
        onClose();
      } else {
        const { data, error: err } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (err) throw err;
        setPassword('');
        // With email confirmation on (the default) there's no session until they click the link.
        // An address that already has an account gets the same answer, so accounts can't be probed.
        if (data.session) { say(t('auth.signedIn')); onClose(); }
        else setSent(t('auth.checkEmail', { email }));
      }
    });
  };

  const setNewPassword = (event: FormEvent) => {
    event.preventDefault();
    void run('email', async () => {
      const { error: err } = await client.auth.updateUser({ password });
      if (err) throw err;
      setPassword('');
      onRecovered();
      say(t('auth.passwordUpdated'));
      onClose();
    });
  };

  const signOut = () => void run('email', async () => {
    // This device only; other signed-in devices stay signed in.
    const { error: err } = await client.auth.signOut({ scope: 'local' });
    if (err) throw err;
    say(t('auth.signedOut'));
    onClose();
  });

  const pickMode = (next: Mode) => { setMode(next); setError(null); };
  const backToSignIn = () => { setResetting(false); setSent(null); setError(null); setMode('signIn'); };
  const errorLine = error && <p className="auth-error" role="alert">{t(error)}</p>;

  const passwordField = (label: MessageKey, autoComplete: string, rule: boolean) => (
    <label className="field">
      <span className="visually-hidden">{t(label)}</span>
      <span className="input-with-icon password-input">
        <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" />
        </svg>
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={rule ? MIN_PASSWORD : undefined}
          placeholder={t(label)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" className="reveal-password" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
          {t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
        </button>
      </span>
      {rule && <small className="field-hint">{t('auth.passwordRule', { min: MIN_PASSWORD })}</small>}
    </label>
  );

  let body;
  if (auth.status === 'loading') {
    body = <small className="hint">{t('loading')}</small>;
  } else if (auth.status === 'signedIn' && recovering) {
    body = (
      <form className="auth-form" onSubmit={setNewPassword}>
        <p className="auth-lede">{t('auth.newPasswordHint')}</p>
        {passwordField('auth.newPassword', 'new-password', true)}
        {errorLine}
        <button type="submit" className="button button-primary" disabled={busy !== null}>{t('auth.savePassword')}</button>
      </form>
    );
  } else if (auth.status === 'signedIn') {
    body = (
      <div className="account-signed-in">
        <div className="account-card">
          <span className="account-badge" aria-hidden="true">{initialOf(auth.email)}</span>
          <div className="account-who">
            <p className="account-email">{auth.email}</p>
            <small className="hint">{t(SIGNED_IN_WITH[auth.provider])}</small>
          </div>
        </div>
        <p className="hint">{t('auth.localForNow')}</p>
        {errorLine}
        <button type="button" className="button button-quiet" disabled={busy !== null} onClick={signOut}>{t('auth.signOut')}</button>
      </div>
    );
  } else if (sent) {
    body = (
      <div className="auth-sent" role="status">
        <p>{sent}</p>
        <button type="button" className="link-button" onClick={backToSignIn}>{t('auth.backToSignIn')}</button>
      </div>
    );
  } else if (resetting) {
    body = (
      <form className="auth-form" onSubmit={submit}>
        <p className="auth-lede">{t('auth.resetHint')}</p>
        <EmailField value={email} onChange={setEmail} />
        {errorLine}
        <button type="submit" className="button button-primary auth-submit" disabled={busy !== null}>{t('auth.sendReset')}</button>
        <button type="button" className="link-button auth-back" onClick={backToSignIn}>{t('auth.backToSignIn')}</button>
      </form>
    );
  } else {
    const signingUp = mode === 'signUp';
    body = (
      <div className="auth-start">
        <p className="auth-lede">{t('auth.why')}</p>
        <form className="auth-form" onSubmit={submit}>
          <EmailField value={email} onChange={setEmail} />
          {passwordField('auth.password', signingUp ? 'new-password' : 'current-password', signingUp)}
          {!signingUp && (
            <button type="button" className="link-button auth-forgot" onClick={() => { setResetting(true); setError(null); }}>{t('auth.forgot')}</button>
          )}
          {errorLine}
          <button type="submit" className="button button-primary auth-submit" disabled={busy !== null}>
            {t(signingUp ? 'auth.createAccount' : 'auth.signIn')}
          </button>
          <p className="auth-switch">
            {t(signingUp ? 'auth.haveAccount' : 'auth.noAccount')}{' '}
            <button type="button" className="link-button" onClick={() => pickMode(signingUp ? 'signIn' : 'signUp')}>
              {t(signingUp ? 'auth.signIn' : 'auth.createAccount')}
            </button>
          </p>
        </form>
        <p className="auth-divider"><span>{t('auth.or')}</span></p>
        <div className="provider-buttons">
          {(['google', 'discord'] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              className="button provider-button"
              disabled={busy !== null}
              aria-busy={busy === provider}
              onClick={() => withProvider(provider)}
            >
              <BrandMark provider={provider} />
              <span>{t(PROVIDER_LABEL[provider])}</span>
            </button>
          ))}
        </div>
        <p className="auth-legal"><AgreeLine /></p>
      </div>
    );
  }

  const title: MessageKey = auth.status === 'signedIn' && !recovering ? 'settings.account'
    : recovering ? 'auth.newPassword'
    : resetting ? 'auth.resetTitle'
    : mode === 'signUp' ? 'auth.createAccount' : 'auth.signIn';
  return <Dialog title={t(title)} onClose={onClose}>{body}</Dialog>;
}

function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span className="visually-hidden">{t('auth.email')}</span>
      <span className="input-with-icon">
        <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" />
        </svg>
        <input type="email" autoComplete="email" inputMode="email" required placeholder={t('auth.email')} value={value} onChange={(e) => onChange(e.target.value.trim())} />
      </span>
    </label>
  );
}

/**
 * Google's and Discord's own sign-in marks, kept unmodified as their brand rules ask. Drop the
 * official SVGs into public/icons/brands/ (see the README); until then the button shows text only.
 */
function BrandMark({ provider }: { provider: Provider }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img className="brand-mark" src={`/icons/brands/${provider}.svg`} alt="" width={20} height={20} onError={() => setMissing(true)} />;
}

/** First letter of the address, for the little badge on the account button and sheet. */
export function initialOf(email: string): string {
  return (email.trim()[0] ?? '?').toLocaleUpperCase();
}

/** "By continuing, you agree to the Terms and Privacy Policy…" with both names as links, in any word order. */
function AgreeLine() {
  const links = {
    terms: <a href="/terms" target="_blank" rel="noopener">{t('auth.agree.terms')}</a>,
    privacy: <a href="/privacy" target="_blank" rel="noopener">{t('auth.agree.privacy')}</a>,
  };
  const parts = t('auth.agree', { terms: '\u0000terms\u0000', privacy: '\u0000privacy\u0000' }).split('\u0000');
  return <>{parts.map((part, i) => (part === 'terms' || part === 'privacy' ? <Fragment key={i}>{links[part]}</Fragment> : part))}</>;
}

