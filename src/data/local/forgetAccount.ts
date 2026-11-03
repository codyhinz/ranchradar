import { itemOutboxId, type RanchDB } from './db';

/**
 * Removes everything this device keeps for one account: its roster copy, its owned items, anything still
 * waiting to upload, and its sync bookkeeping (meta keys end in the account id). Used after
 * the account is deleted, so nothing of it lingers here. The guest roster and other accounts
 * on the device are untouched. Returns how many Pokémon were removed.
 */
export async function forgetAccount(db: RanchDB, userId: string): Promise<number> {
  const tx = db.transaction(['roster_entries', 'owned_items', 'outbox', 'meta'], 'readwrite');
  const rows = tx.objectStore('roster_entries');
  const outbox = tx.objectStore('outbox');
  const meta = tx.objectStore('meta');

  let removed = 0;
  for (const entry of await rows.getAll()) {
    if (entry.user_id !== userId) continue;
    await rows.delete(entry.id);
    await outbox.delete(['roster_entries', entry.id]);
    removed++;
  }
  const items = tx.objectStore('owned_items');
  for (const item of await items.getAll()) {
    if (item.owner !== userId) continue;
    await items.delete([userId, item.item_id]);
    await outbox.delete(['owned_items', itemOutboxId(userId, item.item_id)]);
  }
  for (const key of await meta.getAllKeys()) {
    if (key.endsWith(`:${userId}`)) await meta.delete(key);
  }
  await tx.done;
  return removed;
}
