import type { ItemStore } from '../storage';
import { StorageError } from '../storage';
import type { OwnedItem } from '../types';
import { itemOutboxId, type RanchDB } from './db';

export interface LocalItemStoreOptions {
  db: RanchDB;
  /** An account's id, or null for the guest's items. A store only ever sees its own owner's rows. */
  userId: string | null;
  /** When true, every change also lands in the outbox for upload (accounts only). */
  syncEnabled: boolean;
  now?: () => Date;
}

/** Item ids are short slugs like 'focus-sash'; anything else is refused before it's stored. */
const ITEM_ID = /^[a-z0-9-]{1,64}$/;

export function createLocalItemStore(options: LocalItemStoreOptions): ItemStore {
  const { db, syncEnabled } = options;
  const owner = options.userId ?? '';
  const now = options.now ?? (() => new Date());
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  /** Every change in one transaction, so a bulk add lands (or fails) as a whole. */
  async function setMany(itemIds: readonly string[], owned: boolean): Promise<number> {
    const unique = [...new Set(itemIds)];
    const bad = unique.find((id) => !ITEM_ID.test(id));
    if (bad !== undefined) throw new StorageError('invalid', `Unknown item "${bad}"`);
    if (unique.length === 0) return 0;
    const tx = db.transaction(['owned_items', 'outbox'], 'readwrite');
    const rows = tx.objectStore('owned_items');
    const outbox = tx.objectStore('outbox');
    const timestamp = now().toISOString();
    let changed = 0;
    for (const itemId of unique) {
      const current = await rows.get([owner, itemId]);
      const isOwned = Boolean(current && !current.deleted_at);
      if (isOwned === owned) continue; // already that way: nothing to send
      if (!owned && !current) continue;
      changed += 1;
      // A guest's rows never leave the device, so there's no one to tell about a removal.
      if (!owned && !syncEnabled) { await rows.delete([owner, itemId]); continue; }
      const next: OwnedItem = current
        ? { ...current, deleted_at: owned ? null : timestamp, updated_at: timestamp }
        : { owner, item_id: itemId, version: 1, created_at: timestamp, updated_at: timestamp, deleted_at: null };
      await rows.put(next);
      if (syncEnabled) {
        const rowId = itemOutboxId(owner, itemId);
        const pending = await outbox.get(['owned_items', rowId]);
        await outbox.put({ table: 'owned_items', rowId, isNew: false, queuedAt: pending?.queuedAt ?? timestamp });
      }
    }
    await tx.done;
    if (changed > 0) notify();
    return changed;
  }

  return {
    async list() {
      const all = await db.getAll('owned_items');
      return all.filter((row) => row.owner === owner && !row.deleted_at);
    },

    async setOwned(itemId, owned) {
      await setMany([itemId], owned);
    },

    setOwnedMany(itemIds, owned) {
      return setMany(itemIds, owned);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    refresh() {
      notify();
    },
  };
}
