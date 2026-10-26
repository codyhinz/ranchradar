import { BackupError, parseBackup, toBackup } from '../backup';
import type { RosterEntry } from '../types';

const entry = (over: Partial<RosterEntry> = {}): RosterEntry => ({
  id: '0b6c1c1e-6f6a-4c4e-9a59-2f1f3d7c2a10', user_id: null, form_id: 'garchomp', status: 'permanent',
  trial_expires_at: null, nature: 'jolly', variant: null, spread: null, notes: 'Scale Shot', source: 'manual',
  version: 1, created_at: '2026-10-10T00:00:00.000Z', updated_at: '2026-10-11T00:00:00.000Z', deleted_at: null, ...over,
});

describe('backup files', () => {
  it('round-trips live entries and leaves out deleted ones', () => {
    const file = toBackup([entry(), entry({ id: '1b6c1c1e-6f6a-4c4e-9a59-2f1f3d7c2a10', deleted_at: '2026-10-12T00:00:00.000Z' })]);
    const { rows, skipped } = parseBackup(JSON.stringify(file));
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ form_id: 'garchomp', nature: 'jolly', notes: 'Scale Shot' });
    expect(rows[0]).not.toHaveProperty('user_id');
  });

  it('rejects files that are not backups, or from a newer format', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(BackupError);
    try { parseBackup(JSON.stringify({ app: 'ranchradar', format: 99, entries: [] })); }
    catch (error) { expect((error as BackupError).code).toBe('newer_format'); }
  });

  it('treats every row as untrusted: skips bad rows and cleans odd fields', () => {
    const file = toBackup([entry()]);
    const raw = JSON.parse(JSON.stringify(file));
    raw.entries.push(
      { ...raw.entries[0], id: 'not-a-uuid' },
      { ...raw.entries[0], id: '2b6c1c1e-6f6a-4c4e-9a59-2f1f3d7c2a10', form_id: 'missingno' },
      raw.entries[0], // duplicate id
      { ...raw.entries[0], id: '3b6c1c1e-6f6a-4c4e-9a59-2f1f3d7c2a10', nature: 'sleepy', variant: 'nope', notes: 'x'.repeat(900), trial_expires_at: '2026-11-01T00:00:00Z' },
    );
    const { rows, skipped } = parseBackup(JSON.stringify(raw));
    expect(skipped).toBe(3);
    const cleaned = rows[1]!;
    expect(cleaned.nature).toBeNull();
    expect(cleaned.variant).toBeNull();
    expect(cleaned.notes).toHaveLength(500);
    expect(cleaned.trial_expires_at).toBeNull(); // permanent copies have no expiry
  });
});

describe('backup files across seasons', () => {
  it('keeps Pokémon that have left the current regulation', () => {
    const { rows, skipped } = parseBackup(JSON.stringify(toBackup([entry({ form_id: 'bouffalant', nature: null })])));
    expect(skipped).toBe(0);
    expect(rows[0]?.form_id).toBe('bouffalant');
  });
});
