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

  return {
    async list() {
      const all = await db.getAll('owned_items');
      return all.filter((row) => row.owner === owner && !row.deleted_at);
    },

    async setOwned(itemId, owned) {
      if (!ITEM_ID.test(itemId)) throw new StorageError('invalid', `Unknown item "${itemId}"`);
      const tx = db.transaction(['owned_items', 'outbox'], 'readwrite');
      const rows = tx.objectStore('owned_items');
      const current = await rows.get([owner, itemId]);
      const isOwned = Boolean(current && !current.deleted_at);
      if (isOwned === owned) { await tx.done; return; } // already that way: nothing to send
      if (!owned && !current) { await tx.done; return; }
      const timestamp = now().toISOString();
      // A guest's rows never leave the device, so there's no one to tell about a removal.
      if (!owned && !syncEnabled) { await rows.delete([owner, itemId]); await tx.done; notify(); return; }
      const next: OwnedItem = current
        ? { ...current, deleted_at: owned ? null : timestamp, updated_at: timestamp }
        : { owner, item_id: itemId, version: 1, created_at: timestamp, updated_at: timestamp, deleted_at: null };
      await rows.put(next);
      if (syncEnabled) {
        const outbox = tx.objectStore('outbox');
        const rowId = itemOutboxId(owner, itemId);
        const pending = await outbox.get(['owned_items', rowId]);
        await outbox.put({ table: 'owned_items', rowId, isNew: false, queuedAt: pending?.queuedAt ?? timestamp });
      }
      await tx.done;
      notify();
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
