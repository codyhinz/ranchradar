import { LOCALE_LABELS, NAME_LOCALES, type NameLocale } from '../catalog';
import { THEMES, type Theme } from '../app/preferences';
import { t } from '../i18n';
import { Dialog } from './Dialog';

const THEME_LABEL = { system: 'settings.theme.system', light: 'settings.theme.light', dark: 'settings.theme.dark' } as const;

export function SettingsDialog({ locale, onLocaleChange, theme, onThemeChange, onClose }: {
  locale: NameLocale;
  onLocaleChange: (locale: NameLocale) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}) {
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
      </div>
      <p className="fine-print">{t('settings.disclaimer')}</p>
    </Dialog>
  );
}
