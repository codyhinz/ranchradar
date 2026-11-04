/**
 * Keeps an account's roster on this device in step with the server.
 *
 * One pass does three things, in order:
 *  1. Inserts: rows the server has never seen (see guestUpload.ts).
 *  2. Updates: edits and removals, each sent as "change this row if it's still at the version I
 *     last saw". If another device got there first, the row is held for the conflict prompt
 *     with the server's copy alongside, and this device keeps showing its own version.
 *  3. Pull: every row the server changed since this device last looked, by the server's own
 *     updated_at, so device clocks never matter. Rows still waiting to upload are left alone.
 *
 * Each row's local `version` stays the last version the server confirmed, which is the base
 * an update is checked against.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutboxItem, RanchDB } from '../local/db';
import type { RosterEntry } from '../types';
import { readSpread } from '../spread';
import { supabaseInserter, uploadPendingInserts, type RosterInserter } from './guestUpload';

/** A roster row as the server stores and returns it. */
export type ServerRow = Omit<RosterEntry, 'user_id'> & { user_id: string };

/** The fields a device may change. form_id, owner and created_at never change after insert. */
export type RosterChanges = Pick<
  RosterEntry, 'status' | 'trial_expires_at' | 'nature' | 'variant' | 'spread' | 'notes' | 'deleted_at'
>;

export type Failure = { ok: false; reason: 'offline' | 'full' | 'error'; message: string };
export type UpdateOutcome = { ok: true; row: ServerRow | null } | Failure;
export type FetchOutcome = { ok: true; rows: ServerRow[] } | Failure;

/** What sync needs from the backend, so tests can stand in for Supabase. */
export interface RosterRemote extends RosterInserter {
  /** Applies the changes only if the row is still at `baseVersion`. row is null when it wasn't. */
  update(id: string, baseVersion: number, changes: RosterChanges): Promise<UpdateOutcome>;
  /** The server's current copy of one row (empty if it doesn't exist). */
  fetch(id: string): Promise<FetchOutcome>;
  /** Rows changed after `since` (or all of them), oldest change first, one page at a time. */
  changedSince(userId: string, since: string | null, offset: number, limit: number): Promise<FetchOutcome>;
}

export interface SyncResult {
  /** Rows the server accepted from this device. */
  sent: number;
  /** Rows from other devices written here. */
  received: number;
  /** Rows waiting on the conflict prompt, including ones held on earlier passes. */
  conflicts: number;
  status: 'done' | 'offline' | 'full' | 'error';
}

/**
 * Pulls re-read this far behind the newest change already seen. updated_at is set when a
 * transaction starts, so a slow write can commit after a later one; the overlap catches it.
 */
const PULL_OVERLAP_MS = 2 * 60 * 1000;
const PAGE = 1000;
/** Updates in flight at once. */
const PARALLEL = 4;

const cursorKey = (userId: string) => `sync:roster_entries:cursor:${userId}`;

export function supabaseRemote(client: SupabaseClient): RosterRemote {
  const failure = (error: { code?: string; message: string }): Failure => {
    if (error.message.includes('row_cap_reached')) return { ok: false, reason: 'full', message: error.message };
    // supabase-js reports a dropped connection as an error without a Postgres code
    return { ok: false, reason: error.code ? 'error' : 'offline', message: error.message };
  };
  const thrown = (err: unknown): Failure => ({ ok: false, reason: 'offline', message: err instanceof Error ? err.message : String(err) });
  return {
    ...supabaseInserter(client),
    async update(id, baseVersion, changes) {
      try {
        const { data, error } = await client.from('roster_entries').update(changes)
          .eq('id', id).eq('version', baseVersion).select().maybeSingle();
        return error ? failure(error) : { ok: true, row: data as ServerRow | null };
      } catch (err) { return thrown(err); }
    },
    async fetch(id) {
      try {
        const { data, error } = await client.from('roster_entries').select().eq('id', id);
        return error ? failure(error) : { ok: true, rows: (data ?? []) as ServerRow[] };
      } catch (err) { return thrown(err); }
    },
    async changedSince(userId, since, offset, limit) {
      try {
        let query = client.from('roster_entries').select().eq('user_id', userId);
        if (since) query = query.gt('updated_at', since);
        const { data, error } = await query.order('updated_at').order('id').range(offset, offset + limit - 1);
        return error ? failure(error) : { ok: true, rows: (data ?? []) as ServerRow[] };
      } catch (err) { return thrown(err); }
    },
  };
}

/** Postgres returns microseconds and +00:00; the device stores plain ISO strings. */
const iso = (value: string | null): string | null => (value === null ? null : new Date(value).toISOString());

function fromServer(row: ServerRow): RosterEntry {
  return {
    id: row.id, user_id: row.user_id, form_id: row.form_id, status: row.status,
    trial_expires_at: iso(row.trial_expires_at), nature: row.nature, variant: row.variant ?? null,
    // Canonical, so the same points compare equal however the server ordered or wrote them.
    spread: readSpread(row.spread), notes: row.notes, source: row.source, version: row.version,
    created_at: iso(row.created_at)!, updated_at: iso(row.updated_at)!, deleted_at: iso(row.deleted_at),
  };
}

function changesOf(entry: RosterEntry): RosterChanges {
  return {
    status: entry.status, trial_expires_at: entry.trial_expires_at, nature: entry.nature,
    variant: entry.variant, spread: entry.spread, notes: entry.notes, deleted_at: entry.deleted_at,
  };
}

/** Same Pokémon details on both sides; timestamps and versions aside. */
function sameContent(a: RosterEntry, b: RosterEntry): boolean {
  const pick = (e: RosterEntry) => JSON.stringify({ ...changesOf(e), deleted_at: e.deleted_at !== null, form_id: e.form_id });
  return pick(a) === pick(b);
}

/** One sync at a time per database: sign-in, edits, reconnects and timers can all ask for one. */
const running = new WeakMap<RanchDB, Promise<SyncResult>>();

export function syncRoster(db: RanchDB, remote: RosterRemote, userId: string): Promise<SyncResult> {
  const current = running.get(db);
  if (current) return current;
  const run = sync(db, remote, userId).finally(() => running.delete(db));
  running.set(db, run);
  return run;
}

async function sync(db: RanchDB, remote: RosterRemote, userId: string): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, received: 0, conflicts: 0, status: 'done' };
  const finish = async (status: SyncResult['status']) => {
    result.status = status;
    result.conflicts = await heldCount(db, userId);
    return result;
  };

  const inserted = await uploadPendingInserts(db, remote, userId);
  result.sent += inserted.uploaded;
  if (inserted.status !== 'done') return finish(inserted.status);

  const checked = await prepareDuplicates(db, remote, userId);
  if (checked !== 'done') return finish(checked);

  const refetched = await refetchChosen(db, remote, userId);
  if (refetched !== 'done') return finish(refetched);

  const pushed = await pushUpdates(db, remote, userId);
  result.sent += pushed.sent;
  if (pushed.status !== 'done') return finish(pushed.status);

  const pulled = await pull(db, remote, userId);
  result.received = pulled.received;
  return finish(pulled.status);
}

async function heldCount(db: RanchDB, userId: string): Promise<number> {
  let count = 0;
  for (const item of await db.getAll('outbox')) {
    if (item.table !== 'roster_entries' || !item.held) continue;
    if ((await db.get('roster_entries', item.rowId))?.user_id === userId) count++;
  }
  return count;
}

/** This account's outbox items, with their rows. */
async function pending(db: RanchDB, userId: string, keep: (item: OutboxItem) => boolean) {
  const found: Array<{ item: OutboxItem; entry: RosterEntry }> = [];
  for (const item of await db.getAll('outbox')) {
    if (item.table !== 'roster_entries' || !keep(item)) continue;
    const entry = await db.get('roster_entries', item.rowId);
    if (entry?.user_id === userId) found.push({ item, entry });
  }
  return found;
}

/**
 * A row held because the server already has its id (a restored backup) gets the server's copy
 * for the prompt. If both copies match there's nothing to ask; if the id belongs to someone
 * else's row, this one simply takes a new id and uploads as a new Pokémon.
 */
async function prepareDuplicates(db: RanchDB, remote: RosterRemote, userId: string): Promise<SyncResult['status']> {
  for (const { entry } of await pending(db, userId, (i) => i.held === 'duplicate_id' && !i.theirs)) {
    const lookup = await remote.fetch(entry.id);
    if (!lookup.ok) return lookup.reason;
    const theirs = lookup.rows[0] ? fromServer(lookup.rows[0]) : undefined;
    const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
    const rows = tx.objectStore('roster_entries');
    const outbox = tx.objectStore('outbox');
    const key: [string, string] = ['roster_entries', entry.id];
    const item = await outbox.get(key);
    if (item) {
      if (!theirs) {
        const fresh = { ...entry, id: crypto.randomUUID() };
        await rows.delete(entry.id);
        await outbox.delete(key);
        await rows.put(fresh);
        await outbox.put({ table: 'roster_entries', rowId: fresh.id, isNew: true, queuedAt: item.queuedAt });
      } else if (sameContent(entry, theirs)) {
        await rows.put(theirs);
        await outbox.delete(key);
      } else {
        await outbox.put({ ...item, theirs });
      }
    }
    await tx.done;
  }
  return 'done';
}

/** Rows where the person kept the server's copy: take the server's latest, then they're settled. */
async function refetchChosen(db: RanchDB, remote: RosterRemote, userId: string): Promise<SyncResult['status']> {
  for (const { item } of await pending(db, userId, (i) => i.refetch === true)) {
    const lookup = await remote.fetch(item.rowId);
    if (!lookup.ok) return lookup.reason;
    const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
    const key: [string, string] = ['roster_entries', item.rowId];
    const still = await tx.objectStore('outbox').get(key);
    // An edit since the choice turned this into an ordinary update; leave that to the push.
    if (still?.refetch) {
      if (lookup.rows[0]) await tx.objectStore('roster_entries').put(fromServer(lookup.rows[0]));
      await tx.objectStore('outbox').delete(key);
    }
    await tx.done;
  }
  return 'done';
}

async function pushUpdates(db: RanchDB, remote: RosterRemote, userId: string): Promise<{ sent: number; status: SyncResult['status'] }> {
  const queue: RosterEntry[] = [];
  for (const item of await db.getAll('outbox')) {
    if (item.table !== 'roster_entries' || item.isNew || item.held || item.refetch) continue;
    const entry = await db.get('roster_entries', item.rowId);
    if (entry?.user_id === userId) queue.push(entry);
  }

  let sent = 0;
  let stop: SyncResult['status'] = 'done';
  const worker = async () => {
    for (let entry = queue.shift(); entry && stop === 'done'; entry = queue.shift()) {
      const outcome = await pushOne(db, remote, entry);
      if (outcome === 'sent') sent++;
      else if (outcome !== 'held' && outcome !== 'requeued') stop = outcome;
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return { sent, status: stop };
}

async function pushOne(db: RanchDB, remote: RosterRemote, sentAs: RosterEntry): Promise<'sent' | 'held' | 'requeued' | 'offline' | 'full' | 'error'> {
  const outcome = await remote.update(sentAs.id, sentAs.version, changesOf(sentAs));
  if (!outcome.ok) return outcome.reason;
  if (outcome.row) {
    await settle(db, sentAs, fromServer(outcome.row));
    return 'sent';
  }

  // Nothing matched: either another device moved the row on, or it's gone from the server.
  const lookup = await remote.fetch(sentAs.id);
  if (!lookup.ok) return lookup.reason;
  const theirs = lookup.rows[0] ? fromServer(lookup.rows[0]) : undefined;
  const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
  const rows = tx.objectStore('roster_entries');
  const outbox = tx.objectStore('outbox');
  const key: [string, string] = ['roster_entries', sentAs.id];
  const mine = await rows.get(sentAs.id);
  const item = await outbox.get(key);
  let verdict: 'sent' | 'held' | 'requeued' = 'held';
  if (!mine || !item) {
    verdict = 'sent'; // changed underneath us (e.g. signed out and purged); nothing left to do
  } else if (!theirs) {
    // The server no longer has it. A removal is done; anything else goes back up as new.
    if (mine.deleted_at) await outbox.delete(key);
    else await outbox.put({ ...item, isNew: true });
    verdict = mine.deleted_at ? 'sent' : 'requeued';
  } else if (sameContent(mine, theirs)) {
    // Both devices made the same change (or both removed it): nothing to ask about.
    await rows.put(theirs);
    await outbox.delete(key);
    verdict = 'sent';
  } else {
    await outbox.put({ ...item, held: 'conflict', theirs });
  }
  await tx.done;
  return verdict;
}

/**
 * Records what the server accepted. If the person edited the row again while the request was
 * out, their edit stays queued, now based on the version the server just confirmed.
 */
async function settle(db: RanchDB, sentAs: RosterEntry, accepted: RosterEntry): Promise<void> {
  const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
  const rows = tx.objectStore('roster_entries');
  const key: [string, string] = ['roster_entries', sentAs.id];
  const now = await rows.get(sentAs.id);
  // Compare the whole row: an edit can land in the same millisecond, so timestamps can't tell.
  if (now && JSON.stringify(now) === JSON.stringify(sentAs)) {
    await rows.put(accepted);
    await tx.objectStore('outbox').delete(key);
  } else if (now) {
    await rows.put({ ...now, version: accepted.version });
  }
  await tx.done;
}

async function pull(db: RanchDB, remote: RosterRemote, userId: string): Promise<{ received: number; status: SyncResult['status'] }> {
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

/** Writes rows from the server, skipping ones this device already has or is still uploading. */
async function apply(db: RanchDB, userId: string, incoming: RosterEntry[]): Promise<number> {
  if (incoming.length === 0) return 0;
  const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
  const rows = tx.objectStore('roster_entries');
  const outbox = tx.objectStore('outbox');
  let written = 0;
  for (const theirs of incoming) {
    const mine = await rows.get(theirs.id);
    if (mine && mine.user_id !== userId) continue; // the same id in this device's guest roster
    if (await outbox.get(['roster_entries', theirs.id])) continue; // the push decides this one
    if (!mine && theirs.deleted_at) continue; // removed before this device ever saw it
    if (mine && mine.version >= theirs.version) continue; // already have it (the pull overlaps)
    await rows.put(theirs);
    written++;
  }
  await tx.done;
  return written;
}

/** A Pokémon that changed on two sides, waiting for the person to pick a version. */
export interface Conflict {
  /** changed: edited on another device too. duplicate: a restored backup row the account already has. */
  kind: 'changed' | 'duplicate';
  mine: RosterEntry;
  theirs: RosterEntry;
}

/** Rows waiting on the prompt, oldest first. Duplicates still being looked up aren't ready yet. */
export async function listConflicts(db: RanchDB, userId: string): Promise<Conflict[]> {
  const held = await pending(db, userId, (i) => Boolean(i.held && i.theirs));
  return held
    .sort((a, b) => a.item.queuedAt.localeCompare(b.item.queuedAt))
    .map(({ item, entry }) => ({ kind: item.held === 'conflict' ? 'changed' : 'duplicate', mine: entry, theirs: item.theirs! }));
}

/**
 * Settles a conflict. mine: this device's version goes up next sync, replacing the server's.
 * theirs: the server's copy replaces this device's now, and is re-fetched next sync in case it
 * changed again meanwhile. Either way the row is an ordinary queued update afterwards.
 */
export async function resolveConflict(db: RanchDB, id: string, keep: 'mine' | 'theirs', now: Date = new Date()): Promise<void> {
  const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
  const rows = tx.objectStore('roster_entries');
  const outbox = tx.objectStore('outbox');
  const key: [string, string] = ['roster_entries', id];
  const item = await outbox.get(key);
  const mine = await rows.get(id);
  if (item?.held && item.theirs && mine) {
    const base = { table: 'roster_entries' as const, rowId: id, isNew: false, queuedAt: now.toISOString() };
    if (keep === 'mine') {
      // Based on the server's version, so the update applies unless it moved on yet again.
      await rows.put({ ...mine, version: item.theirs.version });
      await outbox.put(base);
    } else {
      await rows.put(item.theirs);
      await outbox.put({ ...base, refetch: true });
    }
  }
  await tx.done;
}
