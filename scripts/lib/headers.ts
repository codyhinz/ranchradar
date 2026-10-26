/**
 * public/_headers carries a {{SUPABASE}} placeholder in its connect-src. At build time it becomes
 * this project's exact Supabase origin (https for the API, wss for realtime), so the page can talk
 * to our backend and nobody else's. Builds without Supabase settings just drop the placeholder.
 */
export const SUPABASE_PLACEHOLDER = '{{SUPABASE}}';

export function supabaseSources(url: string | undefined): string {
  if (!url) return '';
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(`VITE_SUPABASE_URL is not a URL: ${url}`); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('VITE_SUPABASE_URL must use https');
  }
  const ws = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${parsed.origin} ${ws}//${parsed.host}`;
}

export function fillHeaders(template: string, supabaseUrl: string | undefined): string {
  const sources = supabaseSources(supabaseUrl);
  return template.replaceAll(` ${SUPABASE_PLACEHOLDER}`, sources ? ` ${sources}` : '').replaceAll(SUPABASE_PLACEHOLDER, sources);
}
