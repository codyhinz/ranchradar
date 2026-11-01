import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../data/cloud/supabase';
import type { AuthState } from './useAuth';

/** 'ask' means the account hasn't answered yet; 'unknown' covers loading and being offline. */
export type AgeStatus = 'unknown' | 'ok' | 'ask';

const cacheKey = (userId: string) => `ranchradar:age-ok:${userId}`;

function cached(userId: string): boolean {
  try { return localStorage.getItem(cacheKey(userId)) === '1'; } catch { return false; }
}
function remember(userId: string): void {
  try { localStorage.setItem(cacheKey(userId), '1'); } catch { /* storage blocked: we just ask the server again */ }
}
export function forgetAgeAnswer(userId: string): void {
  try { localStorage.removeItem(cacheKey(userId)); } catch { /* nothing to clear */ }
}

/**
 * Every account answers the age question once, whichever way it signed up (email, Google or
 * Discord all land here). The answer lives in profiles.age_confirmed_at; this device also
 * remembers a yes so it doesn't ask the server on every launch. Offline, nothing is asked:
 * the check runs again on the next sign-in or reload.
 */
export function useAgeCheck(auth: AuthState) {
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const [status, setStatus] = useState<AgeStatus>('unknown');

  useEffect(() => {
    if (!userId || !supabase) { setStatus('unknown'); return; }
    if (cached(userId)) { setStatus('ok'); return; }
    let alive = true;
    setStatus('unknown');
    void (async () => {
      const { data, error } = await supabase.from('profiles').select('age_confirmed_at').eq('user_id', userId).maybeSingle();
      if (!alive || error) return;
      if (data?.age_confirmed_at) { remember(userId); setStatus('ok'); }
      else setStatus('ask');
    })();
    return () => { alive = false; };
  }, [userId]);

  /** Records a yes, along with accepting the terms shown at sign-in. */
  const confirm = useCallback(async () => {
    if (!userId || !supabase) return;
    const at = new Date().toISOString();
    const { data, error } = await supabase.from('profiles')
      .update({ age_confirmed_at: at, terms_accepted_at: at })
      .eq('user_id', userId)
      .select('user_id');
    if (error) throw error;
    if (!data?.length) throw new Error('Profile not found');
    remember(userId);
    setStatus('ok');
  }, [userId]);

  return { status, confirm };
}
