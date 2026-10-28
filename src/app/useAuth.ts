import { useEffect, useState } from 'react';
import { supabase } from '../data/cloud/supabase';
import type { MessageKey } from '../i18n';
import { oauthChoice } from './signInHint';
import { sessionMethod, signInMethod } from './signInMethod';

export type AuthProvider = 'email' | 'google' | 'discord';

export type AuthState =
  | { status: 'unavailable' } // this build has no Supabase settings: guest-only
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string; provider: AuthProvider };

/**
 * A Google or Discord sign-in that fails or is cancelled comes back with the reason in the URL.
 * Read it once at startup and strip it, so a reload doesn't show the error again.
 */
function takeRedirectError(): MessageKey | null {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const error = hash.get('error') ?? query.get('error');
  if (!error) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return error === 'access_denied' ? 'auth.error.cancelled' : 'auth.error.provider';
}
const redirectError = takeRedirectError();

/**
 * Who's signed in, kept current as sessions start, refresh and end (including in other tabs).
 * `recovering` turns on when someone arrives from a password-reset link, so the app can ask
 * for a new password straight away.
 */
export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'unavailable' });
  const [recovering, setRecovering] = useState(false);
  const [returnError, setReturnError] = useState<MessageKey | null>(redirectError);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      const user = session?.user;
      setAuth(user
        ? { status: 'signedIn', userId: user.id, email: user.email ?? '', provider: signInMethod(user, sessionMethod(session?.access_token), oauthChoice()) }
        : { status: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return {
    auth,
    recovering,
    endRecovery: () => setRecovering(false),
    /** Why a Google or Discord sign-in didn't finish, if one just came back without a session. */
    returnError,
    clearReturnError: () => setReturnError(null),
  };
}
