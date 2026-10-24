import { LOCALE_LABELS, NAME_LOCALES, type NameLocale } from '../catalog';
import { THEMES, type Theme } from '../app/preferences';
import { BOX_UNLOCKS, boxCapacity, type BoxUnlock } from '../app/box';
import { t, type MessageKey } from '../i18n';
import { Dialog } from './Dialog';

const THEME_LABEL = { system: 'settings.theme.system', light: 'settings.theme.light', dark: 'settings.theme.dark' } as const;

export function SettingsDialog({ locale, onLocaleChange, theme, onThemeChange, boxUnlocks, onBoxUnlocksChange, boxUsed, onClose }: {
  locale: NameLocale;
  onLocaleChange: (locale: NameLocale) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  boxUnlocks: BoxUnlock[];
  onBoxUnlocksChange: (unlocks: BoxUnlock[]) => void;
  boxUsed: number;
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
        <fieldset className="box-space">
          <legend>{t('settings.box')}</legend>
          <small className="hint">{t('settings.box.base')}</small>
          {BOX_UNLOCKS.map((unlock) => (
            <label key={unlock.id} className="check">
              <input
                type="checkbox"
                checked={boxUnlocks.includes(unlock.id)}
                onChange={(event) => onBoxUnlocksChange(event.target.checked
                  ? [...boxUnlocks, unlock.id]
                  : boxUnlocks.filter((id) => id !== unlock.id))}
              />
              <span>{t(`box.${unlock.id}` as MessageKey)}</span>
            </label>
          ))}
          <p className="box-total">
            {t('settings.box.total', { count: boxCapacity(boxUnlocks).toLocaleString() })}
            <span className="count"> · {t('roster.box', { used: boxUsed, capacity: boxCapacity(boxUnlocks) })}</span>
          </p>
        </fieldset>
      </div>
      <p className="fine-print">{t('settings.disclaimer')}</p>
    </Dialog>
  );
}
