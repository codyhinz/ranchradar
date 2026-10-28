import type { AuthProvider } from './useAuth';

interface IdentityLike { provider?: string }
interface UserLike { app_metadata?: { provider?: unknown }; identities?: IdentityLike[] | null }

type OAuthProvider = Exclude<AuthProvider, 'email'>;
const asOAuth = (value: unknown): OAuthProvider | null =>
  value === 'google' || value === 'discord' ? value : null;

/** The newest entry in the access token's `amr` claim: "password", "oauth", "recovery"... */
export function sessionMethod(accessToken: string | undefined): string | null {
  try {
    const payload = accessToken?.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const amr: unknown = JSON.parse(json).amr;
    if (!Array.isArray(amr) || amr.length === 0) return null;
    const first: unknown = amr[0];
    const method = typeof first === 'string' ? first : (first as { method?: unknown })?.method;
    return typeof method === 'string' ? method : null;
  } catch {
    return null;
  }
}

/**
 * How someone signed in this time. Supabase links Google, Discord and email logins that share an
 * address into one account, and neither app_metadata.provider nor the identities' last_sign_in_at
 * (set once when each login is linked, never refreshed) says which one was just used. The session's
 * `amr` claim does say whether it was a password or a provider; for a provider, the button the
 * person tapped (remembered before leaving the page) names which one.
 */
export function signInMethod(user: UserLike, method: string | null, choice: string | null): AuthProvider {
  if (method && method !== 'oauth') return 'email';
  const linked = (user.identities ?? []).map((i) => asOAuth(i.provider)).filter((p): p is OAuthProvider => p !== null);
  const chosen = asOAuth(choice);
  if (chosen && (linked.length === 0 || linked.includes(chosen))) return chosen;
  if (linked.length === 1) return linked[0] as OAuthProvider;
  const first = asOAuth(user.app_metadata?.provider);
  if (method === 'oauth') return first ?? (linked[0] as OAuthProvider | undefined) ?? 'email';
  return first ?? 'email';
}
