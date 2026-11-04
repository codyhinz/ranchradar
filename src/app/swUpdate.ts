/** How long to wait for the new service worker to take over before reloading anyway. */
export const UPDATE_TIMEOUT_MS = 4000;

type Listenable = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export interface ApplyUpdateOptions {
  reload: () => void;
  /** navigator.serviceWorker, so a takeover in this tab finishes early. */
  container?: Listenable;
  timeoutMs?: number;
}

/**
 * Swaps in the waiting build and reloads, always. vite-plugin-pwa only reloads on a
 * `controllerchange` in this tab, which never comes when the page isn't controlled (after a
 * hard reload) or when another tab or window already activated the new build, so the Refresh
 * button used to do nothing. Here the reload happens once the waiting worker activates (or is
 * replaced by a newer one), on a takeover, or after a timeout, whichever is first; with no
 * waiting worker left the new build is already active and the page just reloads.
 */
export function applyUpdate(
  registration: Pick<ServiceWorkerRegistration, 'waiting'> | undefined,
  { reload, container, timeoutMs = UPDATE_TIMEOUT_MS }: ApplyUpdateOptions,
): Promise<void> {
  return new Promise((resolve) => {
    const waiting = registration?.waiting ?? null;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onState = () => {
      if (waiting && (waiting.state === 'activated' || waiting.state === 'redundant')) finish();
    };
    function finish() {
      if (done) return;
      done = true;
      if (timer !== undefined) clearTimeout(timer);
      waiting?.removeEventListener('statechange', onState);
      container?.removeEventListener('controllerchange', finish);
      reload();
      resolve();
    }
    if (!waiting) {
      finish();
      return;
    }
    waiting.addEventListener('statechange', onState);
    container?.addEventListener('controllerchange', finish);
    timer = setTimeout(finish, timeoutMs);
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      finish();
    }
  });
}
