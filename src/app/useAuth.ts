import { useEffect, useState } from 'react';
import { supabase } from '../data/cloud/supabase';

export type AuthState =
  | { status: 'unavailable' } // this build has no Supabase settings: guest-only
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string };

/**
 * Who's signed in, kept current as sessions start, refresh and end (including in other tabs).
 * `recovering` turns on when someone arrives from a password-reset link, so the app can ask
 * for a new password straight away.
 */
export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'unavailable' });
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setAuth(session?.user
        ? { status: 'signedIn', userId: session.user.id, email: session.user.email ?? '' }
        : { status: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { auth, recovering, endRecovery: () => setRecovering(false) };
}
