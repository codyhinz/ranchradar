/**
 * public/_headers carries placeholders in its connect-src. At build time they become this
 * project's exact Supabase origin (https for the API, wss for realtime) and Sentry ingest origin,
 * so the page can talk to our own services and nobody else's. Builds without those settings just
 * drop the placeholders.
 */
export const SUPABASE_PLACEHOLDER = '{{SUPABASE}}';
export const SENTRY_PLACEHOLDER = '{{SENTRY}}';

export interface HeaderSources {
  supabaseUrl?: string;
  sentryDsn?: string;
}

function parseHttps(value: string, name: string): URL {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${name} is not a URL: ${value}`); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error(`${name} must use https`);
  }
  return parsed;
}

export function supabaseSources(url: string | undefined): string {
  if (!url) return '';
  const parsed = parseHttps(url, 'VITE_SUPABASE_URL');
  const ws = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${parsed.origin} ${ws}//${parsed.host}`;
}

/** A DSN looks like https://<public key>@o123.ingest.us.sentry.io/456; events go to its origin. */
export function sentrySources(dsn: string | undefined): string {
  if (!dsn) return '';
  return parseHttps(dsn, 'VITE_SENTRY_DSN').origin;
}

function fill(template: string, placeholder: string, sources: string): string {
  return template.replaceAll(` ${placeholder}`, sources ? ` ${sources}` : '').replaceAll(placeholder, sources);
}

export function fillHeaders(template: string, { supabaseUrl, sentryDsn }: HeaderSources = {}): string {
  return fill(fill(template, SUPABASE_PLACEHOLDER, supabaseSources(supabaseUrl)), SENTRY_PLACEHOLDER, sentrySources(sentryDsn));
}
