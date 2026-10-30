import { Component, type ReactNode } from 'react';
import { reportError } from '../app/errorTracking';
import { currentDiagnostics, feedbackEmailUrl } from '../app/feedback';
import { t, uiLocale } from '../i18n';

/**
 * Catches a crash anywhere in the app, reports it, and shows a way back instead of a blank page.
 * The roster lives in IndexedDB, so reloading loses nothing.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="crash" role="alert">
        <img src="/brand/mark-112.webp" width="72" height="72" alt="" />
        <h1>{t('crash.title')}</h1>
        <p>{t('crash.body')}</p>
        <div className="crash-actions">
          <button type="button" className="button" onClick={() => window.location.reload()}>{t('crash.reload')}</button>
          <a className="button button-quiet" href={feedbackEmailUrl(currentDiagnostics(uiLocale()))}>{t('settings.feedback')}</a>
        </div>
      </main>
    );
  }
}
