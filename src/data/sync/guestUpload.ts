/**
 * Moving a guest's roster into their account, and uploading rows the server hasn't seen yet.
 *
 * Claiming is local and atomic: in one transaction every live guest row takes the account's
 * user_id and joins the outbox as an insert, so a closed tab or a crash can't leave the roster
 * half in each place. Uploading happens afterwards and can fail and retry freely; until it
 * succeeds the rows are simply waiting in the outbox. Entry ids are made on the device, so
 * the upload is plain inserts with no id remapping.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { itemOutboxId, type OutboxItem, type RanchDB } from '../local/db';
import { StorageError } from '../storage';
import { MAX_ROSTER_ENTRIES, type RosterEntry } from '../types';

/** A roster row as the server takes it on insert. The server sets version and updated_at. */
export type ServerRosterRow = Pick<
  RosterEntry,
  'id' | 'form_id' | 'status' | 'trial_expires_at' | 'nature' | 'variant' | 'spread' | 'notes' | 'source' | 'created_at' | 'deleted_at'
> & { user_id: string };

export type InsertOutcome =
  | { ok: true }
  | { ok: false; reason: 'duplicate' | 'full' | 'offline' | 'error'; message: string };

/** What the uploader needs from the backend, so tests can stand in for Supabase. */
export interface RosterInserter {
  insert(rows: ServerRosterRow[]): Promise<InsertOutcome>;
}

export interface UploadResult {
  uploaded: number;
  /** Rows set aside for the conflict prompt (their id is already on the server). */
  held: number;
  /** done: nothing left to send. offline/error: try again later. full: the account hit its cap. */
  status: 'done' | 'offline' | 'full' | 'error';
}

const BATCH = 100;

export function supabaseInserter(client: SupabaseClient): RosterInserter {
  return {
    async insert(rows) {
      try {
        const { error } = await client.from('roster_entries').insert(rows);
        if (!error) return { ok: true };
        if (error.code === '23505') return { ok: false, reason: 'duplicate', message: error.message };
        if (error.message.includes('row_cap_reached')) return { ok: false, reason: 'full', message: error.message };
        // supabase-js reports a dropped connection as an error without a Postgres code
        if (!error.code) return { ok: false, reason: 'offline', message: error.message };
        return { ok: false, reason: 'error', message: error.message };
      } catch (err) {
        return { ok: false, reason: 'offline', message: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

/** Live Pokémon in the guest roster on this device. */
export async function guestCount(db: RanchDB): Promise<number> {
  return (await db.getAll('roster_entries')).filter((e) => e.user_id === null && !e.deleted_at).length;
}

/**
 * Moves every live guest Pokémon into the account and queues it for upload. Guest tombstones
 * were never uploaded, so they're simply dropped. The guest's bought items come along too, added
 * to whatever the account already owns. Returns how many Pokémon moved.
 */
export async function claimGuestRoster(db: RanchDB, userId: string, now: Date = new Date()): Promise<number> {
  const tx = db.transaction(['roster_entries', 'owned_items', 'outbox'], 'readwrite');
  const rows = tx.objectStore('roster_entries');
  const outbox = tx.objectStore('outbox');
  const items = tx.objectStore('owned_items');
  const all = await rows.getAll();
  const guest = all.filter((e) => e.user_id === null);
  const moving = guest.filter((e) => !e.deleted_at);
  const accountLive = all.filter((e) => e.user_id === userId && !e.deleted_at).length;
  if (accountLive + moving.length > MAX_ROSTER_ENTRIES) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new StorageError('row_cap_reached', `An account holds at most ${MAX_ROSTER_ENTRIES} Pokémon`);
  }
  const queuedAt = now.toISOString();
  for (const entry of guest) {
    if (entry.deleted_at) { await rows.delete(entry.id); continue; }
    await rows.put({ ...entry, user_id: userId });
    await outbox.put({ table: 'roster_entries', rowId: entry.id, isNew: true, queuedAt });
  }
  for (const item of await items.getAll()) {
    if (item.owner !== '') continue;
    await items.delete(['', item.item_id]);
    if (item.deleted_at) continue;
    const theirs = await items.get([userId, item.item_id]);
    if (theirs && !theirs.deleted_at) continue; // the account already has it
    await items.put({ ...item, owner: userId, version: theirs?.version ?? 1, updated_at: queuedAt });
    await outbox.put({ table: 'owned_items', rowId: itemOutboxId(userId, item.item_id), isNew: false, queuedAt });
  }
  await tx.done;
  return moving.length;
}

function toServerRow(entry: RosterEntry, userId: string): ServerRosterRow {
  return {
    id: entry.id, user_id: userId, form_id: entry.form_id, status: entry.status,
    trial_expires_at: entry.trial_expires_at, nature: entry.nature, variant: entry.variant,
    spread: entry.spread, notes: entry.notes, source: entry.source, created_at: entry.created_at,
    deleted_at: null,
  };
}

/** One upload at a time per database: sign-in, coming online and reopening can all start one. */
const running = new WeakMap<RanchDB, Promise<UploadResult>>();

/**
 * Sends this account's rows that the server hasn't seen yet. Rows deleted before they ever
 * uploaded are dropped instead of sent. A row edited while its insert was in flight stays
 * queued as an update, so the edit isn't lost.
 */
export function uploadPendingInserts(db: RanchDB, inserter: RosterInserter, userId: string): Promise<UploadResult> {
  const current = running.get(db);
  if (current) return current;
  const run = upload(db, inserter, userId).finally(() => running.delete(db));
  running.set(db, run);
  return run;
}

async function upload(db: RanchDB, inserter: RosterInserter, userId: string): Promise<UploadResult> {
  const result: UploadResult = { uploaded: 0, held: 0, status: 'done' };
  const items = (await db.getAll('outbox')).filter((i) => i.table === 'roster_entries' && i.isNew && !i.held);
  const pending: RosterEntry[] = [];
  for (const item of items) {
    const entry = await db.get('roster_entries', item.rowId);
    if (!entry || entry.user_id !== userId) continue; // another account's queue; it uploads when they sign in
    if (entry.deleted_at) { await db.delete('outbox', ['roster_entries', entry.id]); continue; }
    pending.push(entry);
  }

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const outcome = await inserter.insert(batch.map((e) => toServerRow(e, userId)));
    if (outcome.ok) { await markUploaded(db, batch); result.uploaded += batch.length; continue; }
    if (outcome.reason !== 'duplicate') { result.status = outcome.reason; return result; }
    // One id in the batch is already on the server: send them one by one to find which.
    for (const entry of batch) {
      const single = await inserter.insert([toServerRow(entry, userId)]);
      if (single.ok) { await markUploaded(db, [entry]); result.uploaded++; }
      else if (single.reason === 'duplicate') { await hold(db, entry.id); result.held++; }
      else { result.status = single.reason; return result; }
    }
  }
  return result;
}

async function markUploaded(db: RanchDB, sent: RosterEntry[]): Promise<void> {
  const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
  for (const entry of sent) {
    const now = await tx.objectStore('roster_entries').get(entry.id);
    const key: [string, string] = ['roster_entries', entry.id];
    const item = await tx.objectStore('outbox').get(key);
    if (!item) continue;
    // Compare the whole row: an edit can land in the same millisecond, so timestamps can't tell.
    const unchanged = now !== undefined && JSON.stringify(now) === JSON.stringify(entry);
    if (unchanged) await tx.objectStore('outbox').delete(key);
    else await tx.objectStore('outbox').put({ ...item, isNew: false } satisfies OutboxItem); // edited mid-upload: send as an update next
  }
  await tx.done;
}

async function hold(db: RanchDB, rowId: string): Promise<void> {
  const item = await db.get('outbox', ['roster_entries', rowId]);
  if (item) await db.put('outbox', { ...item, held: 'duplicate_id' });
}

/** Remembers that this account chose to keep the guest roster separate, so the offer isn't repeated. */
export async function declineGuestUpload(db: RanchDB, userId: string): Promise<void> {
  await db.put('meta', { key: `guestUpload:declined:${userId}`, value: true });
}

export async function guestUploadDeclined(db: RanchDB, userId: string): Promise<boolean> {
  return Boolean((await db.get('meta', `guestUpload:declined:${userId}`))?.value);
}
