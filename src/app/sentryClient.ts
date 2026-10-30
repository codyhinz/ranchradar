// Only what errorTracking uses, so the lazily loaded chunk leaves out replay, tracing and the rest.
export { captureException, init } from '@sentry/browser';
