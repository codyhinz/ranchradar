import { parseBackup } from '../data/backup';
import type { RosterEntry } from '../data/types';
import { buildAccountExport, exportFileName } from './accountData';

const entry = (over: Partial<RosterEntry> = {}): RosterEntry => ({
  id: '11111111-1111-1111-1111-111111111111', user_id: '00000000-0000-0000-0000-00000000000a',
  form_id: 'garchomp', status: 'permanent', trial_expires_at: null, nature: null, variant: null,
  notes: null, source: 'manual', created_at: '2026-10-30T00:00:00.000Z', updated_at: '2026-10-30T00:00:00.000Z',
  deleted_at: null, ...over,
} as RosterEntry);

describe('Download my data', () => {
  const user = {
    email: 'cody@example.com', created_at: '2026-10-26T00:00:00.000Z',
    identities: [{ provider: 'email' }, { provider: 'discord' }, { provider: 'email' }],
  } as never;

  it('makes a file that Import reads as a roster backup', () => {
    const removed = entry({ id: '22222222-2222-2222-2222-222222222222', deleted_at: '2026-10-31T00:00:00.000Z' });
    const file = buildAccountExport([entry(), removed], user, { profile: { locale: 'en' } });
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.rows.map((r) => r.id)).toEqual(['11111111-1111-1111-1111-111111111111']);
    expect(parsed.skipped).toBe(0);
  });

  it('adds the account details and the server’s copy, without the user id', () => {
    const file = buildAccountExport([entry()], user, { profile: { locale: 'en' } });
    expect(file.account).toEqual({
      email: 'cody@example.com', created_at: '2026-10-26T00:00:00.000Z',
      sign_in_methods: ['discord', 'email'], server: { profile: { locale: 'en' } },
    });
    expect(JSON.stringify(file.entries)).not.toContain('user_id');
  });

  it('names the file by date', () => {
    expect(exportFileName(new Date(2026, 10, 1))).toBe('ranchradar-my-data-2026-11-01.json');
  });
});
