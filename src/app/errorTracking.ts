/**
 * Crash reports through Sentry's free tier. Only builds with VITE_SENTRY_DSN report anything, and
 * the SDK loads after the app so it never slows the first paint. Reports carry the error, the build,
 * the browser and recent clicks and page changes, never the roster, notes or anything typed. URLs
 * lose their query and hash first, because sign-in links carry tokens there.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/browser';

type Sentry = typeof import('./sentryClient');

const dsn = import.meta.env.VITE_SENTRY_DSN;
let sentry: Sentry | null = null;
/** Errors caught before the SDK finished loading, sent once it has. */
const early: unknown[] = [];

/** Drops the query string and hash, where sign-in and reset links keep their tokens. */
export function scrubUrl(url: string): string {
  return url.replace(/[?#].*$/, '');
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    if (event.request.headers) delete event.request.headers.Referer;
  }
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  const data = breadcrumb.data;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = scrubUrl(data[key]);
    }
  }
  return breadcrumb;
}

export function errorTrackingEnabled(): boolean {
  return Boolean(dsn);
}

export async function startErrorTracking(): Promise<void> {
  if (!dsn || sentry) return;
  try {
    const loaded = await import('./sentryClient');
    loaded.init({
      dsn,
      release: `ranchradar@${__APP_VERSION__}`,
      environment: import.meta.env.MODE,
      // Collect as little as the SDK allows: no user info, cookies, query strings, request or
      // response bodies (a synced note would be one), or local variables.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
      // Only errors from our own scripts, not browser extensions.
      allowUrls: [window.location.origin],
      maxBreadcrumbs: 30,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    sentry = loaded;
    early.splice(0).forEach((error) => loaded.captureException(error));
  } catch {
    // Blocked by an ad blocker or offline: the app works the same without reports.
  }
}

/** Sends an error the app caught itself, such as a crash stopped by the error screen. */
export function reportError(error: unknown): void {
  if (!dsn) return;
  if (sentry) sentry.captureException(error);
  else if (early.length < 10) early.push(error);
}
