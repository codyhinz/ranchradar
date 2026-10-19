import { LOCALE_LABELS, NAME_LOCALES, type NameLocale } from '../catalog';
import { t } from '../i18n';
import { Dialog } from './Dialog';

export function SettingsDialog({ locale, onLocaleChange, onClose }: {
  locale: NameLocale;
  onLocaleChange: (locale: NameLocale) => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <label className="field">
        <span>{t('settings.language')}</span>
        <select value={locale} onChange={(event) => onLocaleChange(event.target.value as NameLocale)}>
          {NAME_LOCALES.map((code) => <option key={code} value={code}>{LOCALE_LABELS[code]}</option>)}
        </select>
      </label>
      <p className="fine-print">{t('settings.disclaimer')}</p>
    </Dialog>
  );
}
