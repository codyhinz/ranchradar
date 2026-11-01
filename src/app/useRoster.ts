import { useEffect, useState } from 'react';
import { openRanchDB, type RanchDB } from '../data/local/db';
import { createLocalRosterStore } from '../data/local/localRosterStore';
import type { RosterStore } from '../data/storage';
import type { RosterEntry } from '../data/types';

/** Deleted copies stay restorable this long, then are cleared out on the next launch. */
export const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;

/** Opens the on-device database once. */
export function useRanchDB(): RanchDB | null {
  const [db, setDb] = useState<RanchDB | null>(null);
  useEffect(() => {
    let cancelled = false;
    void openRanchDB().then((opened) => { if (cancelled) opened.close(); else setDb(opened); });
    return () => { cancelled = true; };
  }, []);
  return db;
}

/**
 * The roster for whoever is using the app: an account's when signed in (its writes queue for
 * upload), the guest roster otherwise. `owner` is undefined while sign-in is still being checked,
 * so the guest roster never flashes up before an account's.
 */
export function useRosterStore(db: RanchDB | null, owner: string | null | undefined): RosterStore | null {
  const [store, setStore] = useState<RosterStore | null>(null);
  useEffect(() => {
    if (!db || owner === undefined) { setStore(null); return; }
    const local = createLocalRosterStore({ db, userId: owner, syncEnabled: owner !== null });
    // Housekeeping only: a failed purge just leaves the tombstones for next time.
    void local.purgeDeleted(new Date(Date.now() - TOMBSTONE_TTL_MS)).catch(() => undefined);
    setStore(local);
  }, [db, owner]);
  return store;
}

/** Live list of roster entries; re-reads after every change. */
export function useRosterEntries(store: RosterStore | null): RosterEntry[] | null {
  const [entries, setEntries] = useState<RosterEntry[] | null>(null);
  useEffect(() => {
    setEntries(null); // a different roster (signed in or out): don't show the old one meanwhile
    if (!store) return;
    let alive = true;
    const load = () => void store.list().then((list) => { if (alive) setEntries(list); });
    load();
    const unsubscribe = store.subscribe(load);
    return () => { alive = false; unsubscribe(); };
  }, [store]);
  return entries;
}

/** Asks the browser not to evict guest data under storage pressure. Safe to call repeatedly. */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.().catch(() => undefined);
}
