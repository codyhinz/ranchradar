import type { AuthProvider } from './useAuth';

const KEY = 'ranchradar:sign-in-method';

/**
 * Supabase's session says a sign-in was "oauth" but not which provider, so the Google or
 * Discord button records its choice here just before the page leaves for that provider.
 */
export function rememberOAuthChoice(provider: Exclude<AuthProvider, 'email'>): void {
  try { localStorage.setItem(KEY, provider); } catch { /* storage blocked: the label falls back */ }
}

export function oauthChoice(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
