import { useEffect, useState } from 'react';
import { openRanchDB } from '../data/local/db';
import { createLocalRosterStore } from '../data/local/localRosterStore';
import type { RosterStore } from '../data/storage';
import type { RosterEntry } from '../data/types';

/** Opens the on-device database once and hands back a guest-mode store. */
export function useRosterStore(): RosterStore | null {
  const [store, setStore] = useState<RosterStore | null>(null);
  useEffect(() => {
    let cancelled = false;
    openRanchDB().then((db) => {
      if (!cancelled) setStore(createLocalRosterStore({ db, userId: null, syncEnabled: false }));
    });
    return () => { cancelled = true; };
  }, []);
  return store;
}

/** Live list of roster entries; re-reads after every change. */
export function useRosterEntries(store: RosterStore | null): RosterEntry[] | null {
  const [entries, setEntries] = useState<RosterEntry[] | null>(null);
  useEffect(() => {
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
