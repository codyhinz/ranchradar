// Shapes mirror the Supabase tables so rows move between device and server unchanged.

export type ISODate = string;

/** Fields every synced row carries. The server owns `version`; devices never bump it. */
export interface SyncFields {
  version: number;
  created_at: ISODate;
  updated_at: ISODate;
  deleted_at: ISODate | null;
}

export type RosterStatus = 'trial' | 'permanent';
export type EntrySource = 'manual' | 'import' | 'home';

export interface RosterEntry extends SyncFields {
  id: string;
  user_id: string | null; // null for guests
  form_id: string;
  status: RosterStatus;
  trial_expires_at: ISODate | null;
  nature: Nature | null;
  /** Cosmetic version (Alcremie flavor, Florges color, ...); null when not set or not applicable. */
  variant: string | null;
  spread: unknown | null; // reserved for stat spreads
  notes: string | null;
  source: EntrySource;
}

export type NewRosterEntry = Pick<RosterEntry, 'form_id' | 'status'> &
  Partial<Pick<RosterEntry, 'nature' | 'variant' | 'notes' | 'source' | 'trial_expires_at'>>;

export type RosterPatch = Partial<
  Pick<RosterEntry, 'status' | 'trial_expires_at' | 'nature' | 'variant' | 'notes' | 'spread'>
>;

/** A row as it travels in a backup file: no user, server version or tombstone. */
export type ImportedRosterEntry = Pick<
  RosterEntry,
  'id' | 'form_id' | 'status' | 'trial_expires_at' | 'nature' | 'variant' | 'notes' | 'source' | 'created_at' | 'updated_at'
>;

/** Tables that sync. Later features add their stores here and in a new DB migration. */
export type SyncTable = 'roster_entries';

export const NATURES = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
] as const;
export type Nature = (typeof NATURES)[number];

/** Trial length in days (confirmed in-game). */
export const TRIAL_DAYS = 7;
export const MAX_NOTES_LENGTH = 500;
export const MAX_VARIANT_LENGTH = 64;
export const MAX_ROSTER_ENTRIES = 2000;
