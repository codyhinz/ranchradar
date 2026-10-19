import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../i18n';

/** Tells the person when a new build (say, a new regulation) is ready, instead of serving stale data. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update" role="status">
      <span>{t('update.available')}</span>
      <button type="button" className="button button-primary" onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </button>
    </div>
  );
}
