import 'fake-indexeddb/auto';
import { openRanchDB, type RanchDB } from '../local/db';
import { forgetAccount } from '../local/forgetAccount';
import { createLocalRosterStore } from '../local/localRosterStore';

const ME = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
let db: RanchDB;

beforeEach(async () => { db = await openRanchDB(`test-${crypto.randomUUID()}`); });
afterEach(() => db.close());

describe('forgetting a deleted account on this device', () => {
  it('removes only that account’s Pokémon, queued uploads and sync records', async () => {
    const guest = createLocalRosterStore({ db, userId: null, syncEnabled: false });
    const mine = createLocalRosterStore({ db, userId: ME, syncEnabled: true });
    const theirs = createLocalRosterStore({ db, userId: OTHER, syncEnabled: true });
    await guest.add({ form_id: 'garchomp', status: 'permanent' });
    await mine.add({ form_id: 'garchomp', status: 'permanent' });
    await mine.add({ form_id: 'mewtwo', status: 'trial' });
    const kept = await theirs.add({ form_id: 'mewtwo', status: 'permanent' });
    await db.put('meta', { key: `sync:roster_entries:cursor:${ME}`, value: '2026-11-01T00:00:00.000Z' });
    await db.put('meta', { key: `guestUpload:declined:${ME}`, value: true });
    await db.put('meta', { key: `sync:roster_entries:cursor:${OTHER}`, value: '2026-11-01T00:00:00.000Z' });

    expect(await forgetAccount(db, ME)).toBe(2);

    const rows = await db.getAll('roster_entries');
    expect(rows.filter((r) => r.user_id === ME)).toHaveLength(0);
    expect(rows.filter((r) => r.user_id === null)).toHaveLength(1);
    expect(rows.map((r) => r.id)).toContain(kept.id);
    const outbox = await db.getAll('outbox');
    expect(outbox.every((item) => rows.some((r) => r.id === item.rowId))).toBe(true);
    expect(outbox.some((item) => item.rowId === kept.id)).toBe(true);
    const keys = await db.getAllKeys('meta');
    expect(keys.filter((k) => k.endsWith(ME))).toEqual([]);
    expect(keys).toContain(`sync:roster_entries:cursor:${OTHER}`);
  });

  it('does nothing when the device never had that account', async () => {
    expect(await forgetAccount(db, ME)).toBe(0);
  });
});
