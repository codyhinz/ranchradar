import { StorageError, type RosterStore } from '../storage';
import {
  MAX_NOTES_LENGTH,
  MAX_ROSTER_ENTRIES,
  MAX_VARIANT_LENGTH,
  NATURES,
  TRIAL_DAYS,
  type NewRosterEntry,
  type RosterEntry,
  type RosterPatch,
} from '../types';
import type { RanchDB } from './db';

export interface LocalRosterStoreOptions {
  db: RanchDB;
  /** null in guest mode. */
  userId: string | null;
  /**
   * When true, every write also lands in the outbox for upload. Guests run with this off:
   * at sign-up their whole local roster is uploaded in one go, so no queue is needed.
   */
  syncEnabled: boolean;
  now?: () => Date;
  newId?: () => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createLocalRosterStore(options: LocalRosterStoreOptions): RosterStore {
  const { db, userId, syncEnabled } = options;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  /** Writes the row and (if syncing) marks it dirty, in one transaction so they can't drift apart. */
  async function write(entry: RosterEntry, isNewRow: boolean): Promise<void> {
    const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
    await tx.objectStore('roster_entries').put(entry);
    if (syncEnabled) {
      const outbox = tx.objectStore('outbox');
      const pending = await outbox.get(['roster_entries', entry.id]);
      await outbox.put({
        table: 'roster_entries',
        rowId: entry.id,
        // A row created offline stays an insert even after later edits.
        isNew: pending ? pending.isNew : isNewRow,
        queuedAt: pending?.queuedAt ?? now().toISOString(),
      });
    }
    await tx.done;
    notify();
  }

  /** Several rows (and their outbox marks) in one transaction, then one change notice. */
  async function writeAll(rows: RosterEntry[]): Promise<void> {
    if (rows.length === 0) return;
    const tx = db.transaction(['roster_entries', 'outbox'], 'readwrite');
    for (const entry of rows) {
      await tx.objectStore('roster_entries').put(entry);
      if (syncEnabled) {
        const outbox = tx.objectStore('outbox');
        const pending = await outbox.get(['roster_entries', entry.id]);
        await outbox.put({ table: 'roster_entries', rowId: entry.id, isNew: pending ? pending.isNew : false, queuedAt: pending?.queuedAt ?? now().toISOString() });
      }
    }
    await tx.done;
    notify();
  }
  const live = (rows: RosterEntry[]) => rows.length;

  async function getLive(id: string): Promise<RosterEntry> {
    const entry = await db.get('roster_entries', id);
    if (!entry || entry.deleted_at) {
      throw new StorageError('not_found', `No roster entry ${id}`);
    }
    return entry;
  }

  return {
    async list({ includeDeleted = false } = {}) {
      const all = await db.getAll('roster_entries');
      return all
        .filter((entry) => includeDeleted || !entry.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },

    get(id) {
      return db.get('roster_entries', id);
    },

    async add(input) {
      const live = (await this.list()).length;
      if (live >= MAX_ROSTER_ENTRIES) {
        throw new StorageError('row_cap_reached', `Roster is limited to ${MAX_ROSTER_ENTRIES} entries`);
      }
      const timestamp = now();
      const entry = validate({
        id: newId(),
        user_id: userId,
        form_id: input.form_id,
        status: input.status,
        trial_expires_at:
          input.status === 'trial'
            ? input.trial_expires_at ?? new Date(timestamp.getTime() + TRIAL_DAYS * DAY_MS).toISOString()
            : null,
        nature: input.nature ?? null,
        variant: input.variant ?? null,
        spread: null,
        notes: input.notes ?? null,
        source: input.source ?? 'manual',
        version: 1,
        created_at: timestamp.toISOString(),
        updated_at: timestamp.toISOString(),
        deleted_at: null,
      });
      await write(entry, true);
      return entry;
    },

    async update(id, patch) {
      const current = await getLive(id);
      const next = applyPatch(current, patch, now());
      await write(next, false);
      return next;
    },

    async remove(id) {
      const current = await getLive(id);
      const timestamp = now().toISOString();
      await write({ ...current, deleted_at: timestamp, updated_at: timestamp }, false);
    },

    async removeMany(ids) {
      const timestamp = now().toISOString();
      const rows: RosterEntry[] = [];
      for (const id of ids) rows.push({ ...(await getLive(id)), deleted_at: timestamp, updated_at: timestamp });
      await writeAll(rows);
    },

    async restore(ids) {
      const timestamp = now().toISOString();
      const rows: RosterEntry[] = [];
      for (const id of ids) {
        const row = await db.get('roster_entries', id);
        if (row?.deleted_at) rows.push({ ...row, deleted_at: null, updated_at: timestamp });
      }
      if (live(await this.list()) + rows.length > MAX_ROSTER_ENTRIES) {
        throw new StorageError('row_cap_reached', `Roster is limited to ${MAX_ROSTER_ENTRIES} entries`);
      }
      await writeAll(rows);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function applyPatch(current: RosterEntry, patch: RosterPatch, at: Date): RosterEntry {
  const next: RosterEntry = { ...current, ...patch, updated_at: at.toISOString() };
  if (patch.status === 'permanent') {
    next.trial_expires_at = null;
  } else if (patch.status === 'trial' && current.status !== 'trial' && patch.trial_expires_at === undefined) {
    next.trial_expires_at = new Date(at.getTime() + TRIAL_DAYS * DAY_MS).toISOString();
  }
  // version is deliberately untouched: it stays the last version the server confirmed,
  // which is exactly the base the upload needs for conflict detection.
  return validate(next);
}

function validate(entry: RosterEntry): RosterEntry {
  if (!entry.form_id) {
    throw new StorageError('invalid', 'form_id is required');
  }
  if (entry.nature !== null && !(NATURES as readonly string[]).includes(entry.nature)) {
    throw new StorageError('invalid', `Unknown nature "${entry.nature}"`);
  }
  if (entry.variant !== null && (typeof entry.variant !== 'string' || entry.variant.length > MAX_VARIANT_LENGTH)) {
    throw new StorageError('invalid', 'Invalid variant');
  }
  if (entry.notes !== null && entry.notes.length > MAX_NOTES_LENGTH) {
    throw new StorageError('invalid', `Notes are limited to ${MAX_NOTES_LENGTH} characters`);
  }
  if (entry.status === 'permanent' && entry.trial_expires_at !== null) {
    throw new StorageError('invalid', 'Permanent entries have no trial expiry');
  }
  return entry;
}
