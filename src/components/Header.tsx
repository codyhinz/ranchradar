import type { AuthState } from '../app/useAuth';
import { t } from '../i18n';
import { initialOf } from './AccountSheet';
import { Sprite } from './Sprite';

/** Wordmark with Torkoal as the ranch's mascot and a drifting wisp of smoke above it. */
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
        <span className="mascot">
          <svg className="smoke" viewBox="0 0 60 70" aria-hidden="true">
            <path d="M30 68c-9-10 9-16 0-28s8-18 2-30" />
            <path d="M40 66c-6-8 7-12 1-21s5-13 1-20" />
          </svg>
          <Sprite id="torkoal" size={96} className="mascot-sprite" />
        </span>
        <div className="brand-text">
          <h1 className="wordmark">RanchRadar</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
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
