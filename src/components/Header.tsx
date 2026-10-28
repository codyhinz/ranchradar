import type { AuthState } from '../app/useAuth';
import { t } from '../i18n';
import { initialOf } from './AccountSheet';

/**
 * The ranch sign: painted sunset art with the name lettered on as real text, so it stays
 * sharp at any size and reads to screen readers. Phones get a taller crop with the mascot larger.
 */
export function Header({ auth, onOpenAccount, onOpenSettings, onHome }: {
  auth: AuthState;
  onOpenAccount: () => void;
  onOpenSettings: () => void;
  onHome: () => void;
}) {
  const signedIn = auth.status === 'signedIn';
  return (
    <header className="masthead">
      <button type="button" className="brand" onClick={onHome} aria-label={t('home')}>
        <picture className="banner">
          <source media="(max-width: 30rem)" srcSet="/brand/banner-phone-480.webp 480w, /brand/banner-phone-960.webp 960w" sizes="100vw" width={960} height={480} />
          <img
            src="/brand/banner-1536.webp" srcSet="/brand/banner-768.webp 768w, /brand/banner-1536.webp 1536w"
            sizes="(max-width: 42rem) 100vw, 42rem" width={1536} height={512} alt="" fetchPriority="high" decoding="async"
          />
        </picture>
        <span className="sign">
          <h1 className="wordmark">RanchRadar</h1>
          <span className="sign-rail" aria-hidden="true" />
          <p className="tagline">{t('app.tagline')}</p>
        </span>
      </button>
      <div className="masthead-actions">
        {auth.status !== 'unavailable' && (
          <button
            type="button"
            className={`icon-button account-button${signedIn ? ' is-signed-in' : ''}`}
            onClick={onOpenAccount}
            aria-label={signedIn ? t('account.openSignedIn', { email: auth.email }) : t('account.open')}
          >
            {signedIn ? (
              <span className="account-badge" aria-hidden="true">{initialOf(auth.email)}</span>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.5" />
                <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
              </svg>
            )}
          </button>
        )}
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label={t('settings.open')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
