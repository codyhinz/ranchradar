import { catalogById, variantsOf } from '../catalog';
import { MAX_NOTES_LENGTH, NATURES, type ImportedRosterEntry, type RosterEntry } from './types';

/**
 * Roster backup files: a guest's only copy lives in this browser, so Settings can save it
 * to a file and bring it back. The format is versioned so later apps can still read old files.
 */
export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export interface RosterBackup {
  app: 'ranchradar';
  format: typeof BACKUP_FORMAT;
  exported_at: string;
  entries: ImportedRosterEntry[];
}

export class BackupError extends Error {
  constructor(public readonly code: 'not_backup' | 'newer_format' | 'too_large', message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Live entries only; who owns them and the server version stay behind. */
export function toBackup(entries: RosterEntry[], now: Date = new Date()): RosterBackup {
  return {
    app: 'ranchradar',
    format: BACKUP_FORMAT,
    exported_at: now.toISOString(),
    entries: entries.filter((e) => !e.deleted_at).map((e) => ({
      id: e.id, form_id: e.form_id, status: e.status, trial_expires_at: e.trial_expires_at,
      nature: e.nature, variant: e.variant, notes: e.notes, source: e.source,
      created_at: e.created_at, updated_at: e.updated_at,
    })),
  };
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `ranchradar-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export interface ParsedBackup {
  rows: ImportedRosterEntry[];
  /** Rows that couldn't be read, e.g. a Pokémon not in this version's catalog. */
  skipped: number;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a backup file. The file is untrusted input: every row is checked field by field and
 * anything unreadable is skipped rather than failing the whole import.
 */
export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('too_large', 'Backup file is too large');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new BackupError('not_backup', 'Not a RanchRadar backup'); }
  if (!isObject(data) || data.app !== 'ranchradar' || typeof data.format !== 'number' || !Array.isArray(data.entries)) {
    throw new BackupError('not_backup', 'Not a RanchRadar backup');
  }
  if (data.format > BACKUP_FORMAT) throw new BackupError('newer_format', 'Backup is from a newer version of RanchRadar');
  const rows: ImportedRosterEntry[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const raw of data.entries) {
    const row = readRow(raw);
    if (!row || seen.has(row.id)) { skipped++; continue; }
    seen.add(row.id);
    rows.push(row);
  }
  return { rows, skipped };
}

function readRow(raw: unknown): ImportedRosterEntry | null {
  if (!isObject(raw)) return null;
  const { id, form_id, status } = raw;
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  if (typeof form_id !== 'string' || !catalogById.has(form_id)) return null;
  if (status !== 'trial' && status !== 'permanent') return null;
  if (!isDate(raw.created_at) || !isDate(raw.updated_at)) return null;
  const nature = typeof raw.nature === 'string' && (NATURES as readonly string[]).includes(raw.nature) ? raw.nature as ImportedRosterEntry['nature'] : null;
  const variant = typeof raw.variant === 'string' && variantsOf(form_id).some((v) => v.id === raw.variant) ? raw.variant : null;
  const notes = typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.slice(0, MAX_NOTES_LENGTH) : null;
  const source = raw.source === 'import' || raw.source === 'home' ? raw.source : 'manual';
  return {
    id: id.toLowerCase(), form_id, status,
    trial_expires_at: status === 'trial' && isDate(raw.trial_expires_at) ? new Date(raw.trial_expires_at).toISOString() : null,
    nature, variant, notes, source,
    created_at: new Date(raw.created_at).toISOString(),
    updated_at: new Date(raw.updated_at).toISOString(),
  };
}
