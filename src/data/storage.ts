import type { ImportedRosterEntry, NewRosterEntry, RosterEntry, RosterPatch } from './types';

/**
 * The only way the UI touches roster data. Local (device) and cloud implementations
 * both satisfy it, so screens never know which one they're talking to.
 */
export interface RosterStore {
  /** Live entries, oldest first. Soft-deleted entries are hidden unless asked for. */
  list(options?: { includeDeleted?: boolean }): Promise<RosterEntry[]>;
  get(id: string): Promise<RosterEntry | undefined>;
  add(input: NewRosterEntry): Promise<RosterEntry>;
  /** Adds several at once, in one write (bulk add). All or nothing. */
  addMany(inputs: NewRosterEntry[]): Promise<RosterEntry[]>;
  update(id: string, patch: RosterPatch): Promise<RosterEntry>;
  /** Soft delete: sets deleted_at so other devices learn it was removed. */
  remove(id: string): Promise<void>;
  /** Removes several at once, in one write, e.g. clearing out duplicates. */
  removeMany(ids: string[]): Promise<void>;
  /** Brings back entries removed moments ago (Undo). */
  restore(ids: string[]): Promise<void>;
  /**
   * Merges rows from a backup file, matched by id: rows not on this device are added,
   * and for rows already here the newer `updated_at` wins. Nothing is ever deleted.
   */
  importEntries(rows: ImportedRosterEntry[]): Promise<ImportResult>;
  /**
   * Hard-deletes tombstones removed before `before` that are no longer waiting to upload,
   * so soft deletes don't pile up forever. Returns how many were purged.
   */
  purgeDeleted(before: Date): Promise<number>;
  /** Called after any change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

export interface ImportResult {
  added: number;
  updated: number;
  /** Already here and at least as new as the backup's copy. */
  unchanged: number;
}

export class StorageError extends Error {
  constructor(
    public readonly code: 'not_found' | 'invalid' | 'row_cap_reached',
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
