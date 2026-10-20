import { t } from '../i18n';
import { Sprite } from './Sprite';

/** Wordmark with Torkoal as the ranch's mascot and a drifting wisp of smoke above it. */
export function Header({ onOpenSettings, onHome }: { onOpenSettings: () => void; onHome: () => void }) {
  return (
    <header className="masthead">
      <button type="button" className="brand" onClick={onHome} aria-label={t('home')}>
        <span className="mascot">
          <svg className="smoke" viewBox="0 0 60 70" aria-hidden="true">
            <path d="M30 68c-9-10 9-16 0-28s8-18 2-30" />
            <path d="M40 66c-6-8 7-12 1-21s5-13 1-20" />
          </svg>
          <Sprite id="torkoal" size={112} className="mascot-sprite" />
        </span>
        <div className="brand-text">
          <h1 className="wordmark">RanchRadar</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
      </button>
      <button type="button" className="icon-button" onClick={onOpenSettings} aria-label={t('settings.open')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </svg>
      </button>
    </header>
  );
}
