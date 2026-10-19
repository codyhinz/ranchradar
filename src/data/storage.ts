import type { NewRosterEntry, RosterEntry, RosterPatch } from './types';

/**
 * The only way the UI touches roster data. Local (device) and cloud implementations
 * both satisfy it, so screens never know which one they're talking to.
 */
export interface RosterStore {
  /** Live entries, oldest first. Soft-deleted entries are hidden unless asked for. */
  list(options?: { includeDeleted?: boolean }): Promise<RosterEntry[]>;
  get(id: string): Promise<RosterEntry | undefined>;
  add(input: NewRosterEntry): Promise<RosterEntry>;
  update(id: string, patch: RosterPatch): Promise<RosterEntry>;
  /** Soft delete: sets deleted_at so other devices learn it was removed. */
  remove(id: string): Promise<void>;
  /** Called after any change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
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
