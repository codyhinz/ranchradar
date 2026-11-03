/**
 * public/_headers carries placeholders in its connect-src. At build time they become this
 * project's exact Supabase origin (https for the API, wss for realtime) and Sentry ingest origin,
 * so the page can talk to our own services and nobody else's. Builds without those settings just
 * drop the placeholders.
 */
import { ADSENSE_CSP, isAdClient } from './adsense';

export const SUPABASE_PLACEHOLDER = '{{SUPABASE}}';
export const SENTRY_PLACEHOLDER = '{{SENTRY}}';

export interface HeaderSources {
  supabaseUrl?: string;
  sentryDsn?: string;
  /** VITE_ADSENSE_CLIENT: when set, the CSP also allows AdSense and Google's consent message. */
  adsenseClient?: string;
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

/**
 * Adds sources to the named directives of every Content-Security-Policy line, skipping any already
 * there. A directive the policy doesn't have yet is added, so nothing falls back to default-src.
 */
export function addCspSources(template: string, additions: Record<string, string[]>): string {
  return template.replace(/^(\s*Content-Security-Policy:\s*)(.*)$/gm, (_line, prefix: string, policy: string) => {
    const directives = policy.split(';').map((part) => part.trim()).filter(Boolean);
    const named = new Map(directives.map((d) => [d.split(/\s+/)[0]!, d]));
    for (const [name, sources] of Object.entries(additions)) {
      const current = named.get(name);
      const have = new Set(current ? current.split(/\s+/).slice(1) : []);
      const extra = sources.filter((source) => !have.has(source));
      if (!current) named.set(name, [name, ...extra].join(' '));
      else if (extra.length) named.set(name, [current, ...extra].join(' '));
    }
    return prefix + [...named.values()].join('; ');
  });
}

export function fillHeaders(template: string, { supabaseUrl, sentryDsn, adsenseClient }: HeaderSources = {}): string {
  const filled = fill(fill(template, SUPABASE_PLACEHOLDER, supabaseSources(supabaseUrl)), SENTRY_PLACEHOLDER, sentrySources(sentryDsn));
  return isAdClient(adsenseClient) ? addCspSources(filled, ADSENSE_CSP) : filled;
}
