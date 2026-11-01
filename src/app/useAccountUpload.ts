import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../data/cloud/supabase';
import type { RanchDB } from '../data/local/db';
import { StorageError } from '../data/storage';
import { MAX_ROSTER_ENTRIES } from '../data/types';
import {
  claimGuestRoster, declineGuestUpload, guestCount, guestUploadDeclined, supabaseInserter, uploadPendingInserts,
  type UploadResult,
} from '../data/sync/guestUpload';
import { t } from '../i18n';
import type { AuthState } from './useAuth';

/**
 * Signing in with Pokémon already on the device: offer once to add them to the account, and keep
 * uploading whatever the server hasn't seen yet (on sign-in, when the connection returns, and
 * when the app comes back into view). Uploads that fail just wait for the next chance.
 */
export function useAccountUpload(db: RanchDB | null, auth: AuthState, say: (text: string) => void) {
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const [guestPokemon, setGuestPokemon] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);
  // The caller's toast function changes every render; reading it through a ref keeps the
  // upload effects from re-running each time.
  const sayRef = useRef(say);
  sayRef.current = say;
  const full = () => sayRef.current(t('upload.full', { max: MAX_ROSTER_ENTRIES.toLocaleString() }));

  const report = useCallback((result: UploadResult) => {
    if (result.status === 'full') full();
  }, []);

  const upload = useCallback(async () => {
    if (!db || !userId || !supabase) return;
    report(await uploadPendingInserts(db, supabaseInserter(supabase), userId));
  }, [db, userId, report]);

  // On sign-in: send anything left from last time, then make the offer if there's a guest roster.
  useEffect(() => {
    if (!db || !userId) { setOfferOpen(false); return; }
    let alive = true;
    void (async () => {
      await upload();
      const count = await guestCount(db);
      if (!alive) return;
      setGuestPokemon(count);
      if (count > 0 && !(await guestUploadDeclined(db, userId)) && alive) setOfferOpen(true);
    })();
    return () => { alive = false; };
  }, [db, userId, upload]);

  // Retry when the connection comes back or the app is reopened.
  useEffect(() => {
    if (!userId) return;
    const retry = () => { if (document.visibilityState === 'visible') void upload(); };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); };
  }, [userId, upload]);

  const addGuestPokemon = useCallback(async () => {
    if (!db || !userId) return;
    setOfferOpen(false);
    try {
      const moved = await claimGuestRoster(db, userId);
      setGuestPokemon(0);
      sayRef.current(t('guest.added', { count: moved }));
      await upload();
    } catch (error) {
      if (error instanceof StorageError && error.code === 'row_cap_reached') full();
      else throw error;
    }
  }, [db, userId, upload]);

  const keepSeparate = useCallback(async () => {
    setOfferOpen(false);
    if (db && userId) await declineGuestUpload(db, userId);
  }, [db, userId]);

  /** Closed without choosing (Esc): ask again next time they sign in. */
  const dismissOffer = useCallback(() => setOfferOpen(false), []);

  return { guestPokemon, offerOpen, addGuestPokemon, keepSeparate, dismissOffer };
}
