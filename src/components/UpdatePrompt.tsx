import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../i18n';

const HOUR_MS = 60 * 60 * 1000;
const MIN_GAP_MS = 15 * 60 * 1000;

/**
 * Tells the person when a new build (say, a new regulation) is ready, instead of serving stale
 * data. An installed app can stay open for days, so it also checks for a new build every hour
 * and when it comes back into view (at most every 15 minutes, since people tab back and forth
 * with the game constantly). When a regulation already in this build starts while the page is
 * open, the same banner offers a reload.
 */
export function UpdatePrompt({ seasonStarted }: { seasonStarted: string | null }) {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let lastCheck = Date.now();
      const check = () => {
        if (registration.installing || !navigator.onLine || Date.now() - lastCheck < MIN_GAP_MS) return;
        lastCheck = Date.now();
        void registration.update().catch(() => undefined); // offline or flaky: try again later
      };
      window.setInterval(check, HOUR_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });
  if (!needRefresh && !seasonStarted) return null;
  return (
    <div className="update" role="status">
      <span>{needRefresh ? t('update.available') : t('season.started', { id: seasonStarted! })}</span>
      <button
        type="button"
        className="button button-primary"
        onClick={() => (needRefresh ? void updateServiceWorker(true) : window.location.reload())}
      >
        {t('update.reload')}
      </button>
    </div>
  );
}
