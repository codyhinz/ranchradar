import { useEffect, useState } from 'react';
import type { RanchDB } from '../data/local/db';
import { createLocalItemStore } from '../data/local/localItemStore';
import type { ItemStore } from '../data/storage';

/**
 * Bought items for whoever is using the app, the same way useRosterStore picks a roster: the
 * account's (changes queue for upload) when signed in, the guest's otherwise, none while unsure.
 */
export function useItemStore(db: RanchDB | null, owner: string | null | undefined): ItemStore | null {
  const [store, setStore] = useState<ItemStore | null>(null);
  useEffect(() => {
    if (!db || owner === undefined) { setStore(null); return; }
    setStore(createLocalItemStore({ db, userId: owner, syncEnabled: owner !== null }));
  }, [db, owner]);
  return store;
}

/**
 * Every item owned right now, mapped to when it was last marked bought (for "recently bought").
 * Re-reads after every change. null while loading.
 */
export function useOwnedItems(store: ItemStore | null): ReadonlyMap<string, string> | null {
  const [owned, setOwned] = useState<ReadonlyMap<string, string> | null>(null);
  useEffect(() => {
    setOwned(null);
    if (!store) return;
    let alive = true;
    const load = () => void store.list().then((rows) => { if (alive) setOwned(new Map(rows.map((r) => [r.item_id, r.updated_at]))); });
    load();
    const unsubscribe = store.subscribe(load);
    return () => { alive = false; unsubscribe(); };
  }, [store]);
  return owned;
}
