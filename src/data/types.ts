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
  spread: unknown | null; // reserved for stat spreads
  notes: string | null;
  source: EntrySource;
}

export type NewRosterEntry = Pick<RosterEntry, 'form_id' | 'status'> &
  Partial<Pick<RosterEntry, 'nature' | 'notes' | 'source' | 'trial_expires_at'>>;

export type RosterPatch = Partial<
  Pick<RosterEntry, 'status' | 'trial_expires_at' | 'nature' | 'notes' | 'spread'>
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

/** Assumed trial length; still to be confirmed in-game (see spec open questions). */
export const TRIAL_DAYS = 7;
export const MAX_NOTES_LENGTH = 500;
export const MAX_ROSTER_ENTRIES = 2000;
