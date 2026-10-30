import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/zilla-slab/600.css';
import '@fontsource/zilla-slab/700.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import './styles.css';
import { App } from './App';
import { startErrorTracking } from './app/errorTracking';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Crash reports load after the first paint, and only in builds with a Sentry DSN.
if ('requestIdleCallback' in window) requestIdleCallback(() => void startErrorTracking(), { timeout: 3000 });
else setTimeout(() => void startErrorTracking(), 1000);
