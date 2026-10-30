import { LOCALE_LABELS, NAME_LOCALES, type NameLocale } from '../catalog';
import { THEMES, type Theme } from '../app/preferences';
import { boxCapacity, type BoxSettings } from '../app/box';
import { currentDiagnostics, feedbackEmailUrl, feedbackIssueUrl } from '../app/feedback';
import { t } from '../i18n';
import { useRef } from 'react';
import { Dialog } from './Dialog';

const THEME_LABEL = { system: 'settings.theme.system', light: 'settings.theme.light', dark: 'settings.theme.dark' } as const;

export function SettingsDialog({ locale, onLocaleChange, theme, onThemeChange, box, onBoxChange, boxUsed, onExport, onImport, onClose }: {
  locale: NameLocale;
  onLocaleChange: (locale: NameLocale) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  box: BoxSettings;
  onBoxChange: (box: BoxSettings) => void;
  boxUsed: number;
  /** Saves the roster to a backup file. */
  onExport: () => void;
  /** Merges a chosen backup file into the roster. */
  onImport: (file: File) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <div className="fields">
        <fieldset className="segmented segmented-plain">
          <legend>{t('settings.theme')}</legend>
          {THEMES.map((option) => (
            <label key={option} className="segment">
              <input type="radio" name="theme" checked={theme === option} onChange={() => onThemeChange(option)} />
              <span>{t(THEME_LABEL[option])}</span>
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>{t('settings.language')}</span>
          <select value={locale} onChange={(event) => onLocaleChange(event.target.value as NameLocale)}>
            {NAME_LOCALES.map((code) => <option key={code} value={code}>{LOCALE_LABELS[code]}</option>)}
          </select>
          <small className="hint">{t('settings.languageHint')}</small>
        </label>
        <fieldset className="box-space">
          <legend>{t('settings.box')}</legend>
          <small className="hint">{t('settings.box.base')}</small>
          <fieldset className="segmented segmented-plain">
            <legend className="sub-legend">{t('settings.box.ranked')}</legend>
            {([false, true] as const).map((earned) => (
              <label key={String(earned)} className="segment">
                <input type="radio" name="box-ranked" checked={box.rankedRewards === earned} onChange={() => onBoxChange({ ...box, rankedRewards: earned })} />
                <span>{t(earned ? 'box.ranked.all' : 'box.ranked.none')}</span>
              </label>
            ))}
          </fieldset>
          <label className="switch">
            <input type="checkbox" role="switch" checked={box.freeToPlay} onChange={(event) => onBoxChange({ ...box, freeToPlay: event.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
            <span className="switch-text">
              <span>{t('settings.box.f2p')}</span>
              <small className="hint">{t('settings.box.f2pHint')}</small>
            </span>
          </label>
          {!box.freeToPlay && (
            <div className="box-purchases">
              <label className="check">
                <input type="checkbox" checked={box.starterPack} onChange={(event) => onBoxChange({ ...box, starterPack: event.target.checked })} />
                <span>{t('box.starter')}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={box.membership} onChange={(event) => onBoxChange({ ...box, membership: event.target.checked })} />
                <span>{t('box.membership')}</span>
              </label>
            </div>
          )}
          <p className="box-total">
            {t('settings.box.total', { count: boxCapacity(box).toLocaleString() })}
            <span className="count"> · {t('roster.box', { used: boxUsed, capacity: boxCapacity(box) })}</span>
          </p>
        </fieldset>
        <fieldset className="backup">
          <legend>{t('settings.backup')}</legend>
          <small className="hint">{t('settings.backup.hint')}</small>
          <div className="backup-actions">
            <button type="button" className="button button-quiet" onClick={onExport}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" /></svg>
              {t('backup.export')}
            </button>
            <button type="button" className="button button-quiet" onClick={() => fileRef.current?.click()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14" /></svg>
              {t('backup.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = ''; // the same file can be picked again later
                if (file) onImport(file);
              }}
            />
          </div>
        </fieldset>
        <section className="backup" aria-labelledby="feedback-heading">
          <h3 id="feedback-heading" className="section-label">{t('settings.feedback')}</h3>
          <small className="hint">{t('settings.feedback.hint')}</small>
          <div className="backup-actions">
            <a className="button button-quiet" href={feedbackEmailUrl(currentDiagnostics(locale))}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6" /></svg>
              {t('feedback.email')}
            </a>
            <a className="button button-quiet" href={feedbackIssueUrl(currentDiagnostics(locale))} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v5M12 16h.01" /></svg>
              {t('feedback.github')}
            </a>
          </div>
        </section>
      </div>
      <p className="fine-print">{t('settings.disclaimer')}</p>
    </Dialog>
  );
}
