/**
 * Keeps an account's owned items on this device in step with the server.
 *
 * An owned item is a yes or no, so there's nothing to merge and no conflict prompt: each change
 * is sent as an upsert of (item, removed or not), and the last one the server receives wins.
 * Then every row the server changed since this device last looked is pulled, the same way the
 * roster does it. Rows still waiting to upload are never overwritten by a pull.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { itemOutboxId, type RanchDB } from '../local/db';
import type { OwnedItem } from '../types';

/** An owned item as the server stores and returns it. */
export interface ServerItemRow {
  user_id: string;
  item_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** What a device sends: the server sets version and timestamps. */
export type ItemUpsert = Pick<ServerItemRow, 'user_id' | 'item_id' | 'deleted_at'>;

type Failure = { ok: false; reason: 'offline' | 'error'; message: string };
export type ItemRowsOutcome = { ok: true; rows: ServerItemRow[] } | Failure;

/** What item sync needs from the backend, so tests can stand in for Supabase. */
export interface ItemRemote {
  upsert(rows: ItemUpsert[]): Promise<ItemRowsOutcome>;
  /** Rows changed after `since` (or all of them), oldest change first, one page at a time. */
  changedSince(userId: string, since: string | null, offset: number, limit: number): Promise<ItemRowsOutcome>;
}

export interface ItemSyncResult {
  sent: number;
  received: number;
  status: 'done' | 'offline' | 'error';
}

const PULL_OVERLAP_MS = 2 * 60 * 1000;
const PAGE = 1000;
/** Upserts per request; an account can't own more items than the game sells. */
const BATCH = 200;

const cursorKey = (userId: string) => `sync:owned_items:cursor:${userId}`;

export function supabaseItemRemote(client: SupabaseClient): ItemRemote {
  // supabase-js reports a dropped connection as an error without a Postgres code
  const failure = (error: { code?: string; message: string }): Failure => ({ ok: false, reason: error.code ? 'error' : 'offline', message: error.message });
  const thrown = (err: unknown): Failure => ({ ok: false, reason: 'offline', message: err instanceof Error ? err.message : String(err) });
  return {
    async upsert(rows) {
      try {
        const { data, error } = await client.from('owned_items').upsert(rows, { onConflict: 'user_id,item_id' }).select();
        return error ? failure(error) : { ok: true, rows: (data ?? []) as ServerItemRow[] };
      } catch (err) { return thrown(err); }
    },
    async changedSince(userId, since, offset, limit) {
      try {
        let query = client.from('owned_items').select().eq('user_id', userId);
        if (since) query = query.gt('updated_at', since);
        const { data, error } = await query.order('updated_at').order('item_id').range(offset, offset + limit - 1);
        return error ? failure(error) : { ok: true, rows: (data ?? []) as ServerItemRow[] };
      } catch (err) { return thrown(err); }
    },
  };
}

/** Postgres returns microseconds and +00:00; the device stores plain ISO strings. */
const iso = (value: string | null): string | null => (value === null ? null : new Date(value).toISOString());

function fromServer(row: ServerItemRow): OwnedItem {
  return {
    owner: row.user_id, item_id: row.item_id, version: row.version,
    created_at: iso(row.created_at)!, updated_at: iso(row.updated_at)!, deleted_at: iso(row.deleted_at),
  };
}

const running = new WeakMap<RanchDB, Promise<ItemSyncResult>>();

/** One item sync at a time per database. */
export function syncOwnedItems(db: RanchDB, remote: ItemRemote, userId: string): Promise<ItemSyncResult> {
  const current = running.get(db);
  if (current) return current;
  const run = sync(db, remote, userId).finally(() => running.delete(db));
  running.set(db, run);
  return run;
}

async function sync(db: RanchDB, remote: ItemRemote, userId: string): Promise<ItemSyncResult> {
  const result: ItemSyncResult = { sent: 0, received: 0, status: 'done' };
  const pushed = await push(db, remote, userId);
  result.sent = pushed.sent;
  if (pushed.status !== 'done') { result.status = pushed.status; return result; }
  const pulled = await pull(db, remote, userId);
  result.received = pulled.received;
  result.status = pulled.status;
  return result;
}

async function push(db: RanchDB, remote: ItemRemote, userId: string): Promise<{ sent: number; status: ItemSyncResult['status'] }> {
  const prefix = itemOutboxId(userId, '');
  const queued: OwnedItem[] = [];
  for (const item of await db.getAll('outbox')) {
    if (item.table !== 'owned_items' || !item.rowId.startsWith(prefix)) continue;
    const row = await db.get('owned_items', [userId, item.rowId.slice(prefix.length)]);
    if (row) queued.push(row);
    else await db.delete('outbox', ['owned_items', item.rowId]); // nothing left to send
  }

  let sent = 0;
  for (let i = 0; i < queued.length; i += BATCH) {
    const batch = queued.slice(i, i + BATCH);
    const outcome = await remote.upsert(batch.map((row) => ({ user_id: userId, item_id: row.item_id, deleted_at: row.deleted_at })));
    if (!outcome.ok) return { sent, status: outcome.reason };
    const accepted = new Map(outcome.rows.map((row) => [row.item_id, fromServer(row)]));
    const tx = db.transaction(['owned_items', 'outbox'], 'readwrite');
    for (const sentAs of batch) {
      const server = accepted.get(sentAs.item_id);
      if (!server) continue; // not confirmed: stays queued for the next pass
      const now = await tx.objectStore('owned_items').get([userId, sentAs.item_id]);
      // Compare the whole row: a tap can land in the same millisecond, so timestamps can't tell.
      if (now && JSON.stringify(now) === JSON.stringify(sentAs)) {
        await tx.objectStore('owned_items').put(server);
        await tx.objectStore('outbox').delete(['owned_items', itemOutboxId(userId, sentAs.item_id)]);
        sent++;
      } else if (now) {
        await tx.objectStore('owned_items').put({ ...now, version: server.version }); // tapped again mid-send: that change goes next
      }
    }
    await tx.done;
  }
  return { sent, status: 'done' };
}

async function pull(db: RanchDB, remote: ItemRemote, userId: string): Promise<{ received: number; status: ItemSyncResult['status'] }> {
  const saved = (await db.get('meta', cursorKey(userId)))?.value;
  const newest = typeof saved === 'string' ? saved : null;
  const since = newest ? new Date(new Date(newest).getTime() - PULL_OVERLAP_MS).toISOString() : null;

  let received = 0;
  let cursor = newest;
  for (let offset = 0; ; offset += PAGE) {
    const page = await remote.changedSince(userId, since, offset, PAGE);
    if (!page.ok) return { received, status: page.reason };
    received += await apply(db, userId, page.rows.map(fromServer));
    for (const row of page.rows) {
      const at = iso(row.updated_at)!;
      if (!cursor || at > cursor) cursor = at;
    }
    if (page.rows.length < PAGE) break;
  }
  if (cursor && cursor !== newest) await db.put('meta', { key: cursorKey(userId), value: cursor });
  return { received, status: 'done' };
}

async function apply(db: RanchDB, userId: string, incoming: OwnedItem[]): Promise<number> {
  if (incoming.length === 0) return 0;
  const tx = db.transaction(['owned_items', 'outbox'], 'readwrite');
  let written = 0;
  for (const theirs of incoming) {
    if (theirs.owner !== userId) continue;
    if (await tx.objectStore('outbox').get(['owned_items', itemOutboxId(userId, theirs.item_id)])) continue; // ours goes up first
    const mine = await tx.objectStore('owned_items').get([userId, theirs.item_id]);
    if (!mine && theirs.deleted_at) continue; // removed before this device ever saw it
    if (mine && mine.version >= theirs.version) continue; // already have it (the pull overlaps)
    await tx.objectStore('owned_items').put(theirs);
    written++;
  }
  await tx.done;
  return written;
}
