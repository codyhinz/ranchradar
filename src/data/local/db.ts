import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { RosterEntry, SyncTable } from '../types';

export const DB_NAME = 'ranchradar';

/** A row waiting to upload. The row itself is read at upload time, so the latest edit wins. */
export interface OutboxItem {
  table: SyncTable;
  rowId: string;
  /** true until the server has seen the row: upload as insert, otherwise as a versioned update. */
  isNew: boolean;
  queuedAt: string;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface RanchDBSchema extends DBSchema {
  roster_entries: { key: string; value: RosterEntry; indexes: { by_form: string } };
  outbox: { key: [string, string]; value: OutboxItem };
  meta: { key: string; value: MetaRecord };
}

export type RanchDB = IDBPDatabase<RanchDBSchema>;
type UpgradeTx = IDBPTransaction<RanchDBSchema, StoreNames<RanchDBSchema>[], 'versionchange'>;

/**
 * Append-only. Never edit a shipped step; add a new one. Step N upgrades version N to N+1,
 * so a device on any old version replays exactly the steps it's missing and keeps its data.
 */
const migrations: Array<(db: RanchDB, tx: UpgradeTx) => void> = [
  // v1: roster, outbox, meta
  (db) => {
    const roster = db.createObjectStore('roster_entries', { keyPath: 'id' });
    roster.createIndex('by_form', 'form_id');
    db.createObjectStore('outbox', { keyPath: ['table', 'rowId'] });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
  // v2: roster entries gain an optional cosmetic variant
  (_db, tx) => {
    const store = tx.objectStore('roster_entries');
    void store.openCursor().then(async function step(cursor): Promise<void> {
      if (!cursor) return;
      if (cursor.value.variant === undefined) await cursor.update({ ...cursor.value, variant: null });
      return step(await cursor.continue());
    });
  },
];

export const DB_VERSION = migrations.length;

export async function openRanchDB(name: string = DB_NAME): Promise<RanchDB> {
  const db: RanchDB = await openDB<RanchDBSchema>(name, DB_VERSION, {
    upgrade(upgradeDb, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < DB_VERSION; v++) {
        migrations[v]!(upgradeDb, tx);
      }
    },
    // Another tab opened a newer app version: close this connection so its upgrade
    // can run. The "new version available" prompt then reloads this tab.
    blocking() {
      db.close();
    },
  });
  return db;
}
