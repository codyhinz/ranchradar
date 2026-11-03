import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../data/cloud/supabase';
import type { RanchDB } from '../data/local/db';
import { StorageError, type ItemStore, type RosterStore } from '../data/storage';
import { MAX_ROSTER_ENTRIES } from '../data/types';
import { claimGuestRoster, declineGuestUpload, guestCount, guestUploadDeclined } from '../data/sync/guestUpload';
import { listConflicts, resolveConflict, supabaseRemote, syncRoster, type Conflict, type SyncResult } from '../data/sync/syncEngine';
import { supabaseItemRemote, syncOwnedItems } from '../data/sync/itemSync';
import { t } from '../i18n';
import type { AuthState } from './useAuth';

/** How long after a change to wait before sending it, so a burst of taps goes in one pass. */
const AFTER_CHANGE_MS = 1500;
/** How often an open, visible app checks for other devices' changes. */
const POLL_MS = 60 * 1000;

/**
 * Keeps a signed-in account's roster and owned items in sync, and offers once to add the device's guest roster
 * to it. Sync runs on sign-in, shortly after each change, when the connection returns, when the
 * app comes back into view, and every minute while it's open. Failures just wait for the next one.
 */
export function useAccountSync(db: RanchDB | null, store: RosterStore | null, auth: AuthState, say: (text: string) => void, items: ItemStore | null = null) {
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  // The account's own stores, never the guest ones from before sign-in finished switching over
  const accountStore = userId && store ? store : null;
  const itemStore = userId && items ? items : null;
  const [guestPokemon, setGuestPokemon] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // The caller's toast function changes every render; reading it through a ref keeps the
  // sync effects from re-running each time.
  const sayRef = useRef(say);
  sayRef.current = say;
  const full = () => sayRef.current(t('upload.full', { max: MAX_ROSTER_ENTRIES.toLocaleString() }));

  const lastStatus = useRef<SyncResult['status']>('done');
  const busy = useRef(false);
  const again = useRef(false);
  const ourRefresh = useRef(false);

  const sync = useCallback(async () => {
    if (!db || !userId || !accountStore || !supabase) return;
    if (busy.current) { again.current = true; return; } // a change landed mid-sync: go once more after
    busy.current = true;
    try {
      do {
        again.current = false;
        const result = await syncRoster(db, supabaseRemote(supabase), userId);
        if (result.received > 0) {
          ourRefresh.current = true; // our own redraw isn't a new change to send
          accountStore.refresh();
          ourRefresh.current = false;
        }
        setConflicts(result.conflicts > 0 ? await listConflicts(db, userId) : []);
        if (result.status === 'full' && lastStatus.current !== 'full') full(); // say it once, not every minute
        lastStatus.current = result.status;
        // Items have their own little sync; a roster that's offline or full doesn't hold them back.
        if (itemStore && result.status !== 'offline') {
          const itemResult = await syncOwnedItems(db, supabaseItemRemote(supabase), userId);
          if (itemResult.received > 0) {
            ourRefresh.current = true;
            itemStore.refresh();
            ourRefresh.current = false;
          }
        }
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [db, userId, accountStore, itemStore]);

  // On sign-in: catch up, then make the offer if there's a guest roster.
  useEffect(() => {
    if (!db || !userId || !accountStore) { setOfferOpen(false); setConflicts([]); return; }
    let alive = true;
    lastStatus.current = 'done';
    void (async () => {
      await sync();
      const count = await guestCount(db);
      if (!alive) return;
      setGuestPokemon(count);
      if (count > 0 && !(await guestUploadDeclined(db, userId)) && alive) setOfferOpen(true);
    })();
    return () => { alive = false; };
  }, [db, userId, accountStore, sync]);

  // Shortly after each change on this device.
  useEffect(() => {
    if (!accountStore) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      if (ourRefresh.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), AFTER_CHANGE_MS);
    };
    const unsubscribe = accountStore.subscribe(changed);
    const unsubscribeItems = itemStore?.subscribe(changed);
    return () => { clearTimeout(timer); unsubscribe(); unsubscribeItems?.(); };
  }, [accountStore, itemStore, sync]);

  // When the connection comes back, the app is reopened, and every minute while it's in view.
  useEffect(() => {
    if (!accountStore) return;
    const whenVisible = () => { if (document.visibilityState === 'visible') void sync(); };
    window.addEventListener('online', whenVisible);
    document.addEventListener('visibilitychange', whenVisible);
    const poll = setInterval(whenVisible, POLL_MS);
    return () => {
      window.removeEventListener('online', whenVisible);
      document.removeEventListener('visibilitychange', whenVisible);
      clearInterval(poll);
    };
  }, [accountStore, sync]);

  const addGuestPokemon = useCallback(async () => {
    if (!db || !userId) return;
    setOfferOpen(false);
    try {
      const moved = await claimGuestRoster(db, userId);
      setGuestPokemon(0);
      accountStore?.refresh(); // show them now; the change listener sends them shortly
      itemStore?.refresh(); // the guest's bought items came along
      sayRef.current(t('guest.added', { count: moved }));
    } catch (error) {
      if (error instanceof StorageError && error.code === 'row_cap_reached') full();
      else throw error;
    }
  }, [db, userId, accountStore, itemStore]);

  const keepSeparate = useCallback(async () => {
    setOfferOpen(false);
    if (db && userId) await declineGuestUpload(db, userId);
  }, [db, userId]);

  /** Picks one version of a Pokémon changed on two sides; the change listener sends it shortly. */
  const resolve = useCallback(async (id: string, keep: 'mine' | 'theirs') => {
    if (!db || !userId) return;
    await resolveConflict(db, id, keep);
    setConflicts(await listConflicts(db, userId));
    accountStore?.refresh();
  }, [db, userId, accountStore]);

  /** Closed without choosing (Esc): ask again next time they sign in. */
  const dismissOffer = useCallback(() => setOfferOpen(false), []);

  return { guestPokemon, offerOpen, addGuestPokemon, keepSeparate, dismissOffer, conflicts, resolve };
}
