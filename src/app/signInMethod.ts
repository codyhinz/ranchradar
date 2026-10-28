import type { AuthProvider } from './useAuth';

interface IdentityLike { provider?: string; last_sign_in_at?: string | null }
interface UserLike { app_metadata?: { provider?: unknown }; identities?: IdentityLike[] | null }

const asProvider = (value: unknown): AuthProvider | null =>
  value === 'google' || value === 'discord' || value === 'email' ? value : null;

/**
 * How someone signed in this time. Supabase links Google, Discord and email logins that share an
 * address into one account, and app_metadata.provider only ever names the first one used. Each
 * linked identity records its own last sign-in, so the most recent one is the method used now.
 */
export function signInMethod(user: UserLike): AuthProvider {
  let latest: { provider: AuthProvider; at: number } | null = null;
  for (const identity of user.identities ?? []) {
    const provider = asProvider(identity.provider);
    const at = identity.last_sign_in_at ? Date.parse(identity.last_sign_in_at) : NaN;
    if (provider && !Number.isNaN(at) && (!latest || at > latest.at)) latest = { provider, at };
  }
  return latest?.provider ?? asProvider(user.app_metadata?.provider) ?? 'email';
}
