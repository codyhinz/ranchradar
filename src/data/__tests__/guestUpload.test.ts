import 'fake-indexeddb/auto';
import { openRanchDB, type RanchDB } from '../local/db';
import { createLocalRosterStore } from '../local/localRosterStore';
import { StorageError } from '../storage';
import {
  claimGuestRoster, declineGuestUpload, guestCount, guestUploadDeclined, uploadPendingInserts,
  type InsertOutcome, type RosterInserter, type ServerRosterRow,
} from '../sync/guestUpload';

const ME = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
let db: RanchDB;

beforeEach(async () => { db = await openRanchDB(`test-${crypto.randomUUID()}`); });
afterEach(() => db.close());

const guest = () => createLocalRosterStore({ db, userId: null, syncEnabled: false });
const account = (userId = ME) => createLocalRosterStore({ db, userId, syncEnabled: true });

/** A pretend server: remembers ids, enforces a cap, can be told to go offline. */
function fakeServer({ cap = 2000, existing = [] as string[] } = {}) {
  const ids = new Set(existing);
  const calls: ServerRosterRow[][] = [];
  let offline = false;
  const inserter: RosterInserter = {
    async insert(rows): Promise<InsertOutcome> {
      calls.push(rows);
      if (offline) return { ok: false, reason: 'offline', message: 'Failed to fetch' };
      if (rows.some((r) => ids.has(r.id))) return { ok: false, reason: 'duplicate', message: 'duplicate key' };
      if (ids.size + rows.length > cap) return { ok: false, reason: 'full', message: 'row_cap_reached' };
      rows.forEach((r) => ids.add(r.id));
      return { ok: true };
    },
  };
  return { inserter, ids, calls, goOffline: (value = true) => { offline = value; } };
}

describe('each roster sees only its own Pokémon', () => {
  it('keeps the guest roster and an account roster apart on one device', async () => {
    await guest().add({ form_id: 'garchomp', status: 'permanent' });
    await account().add({ form_id: 'mewtwo', status: 'permanent' });
    expect((await guest().list()).map((e) => e.form_id)).toEqual(['garchomp']);
    expect((await account().list()).map((e) => e.form_id)).toEqual(['mewtwo']);
    expect(await account(OTHER).list()).toEqual([]);
  });

  it('won’t read or remove another roster’s Pokémon by id', async () => {
    const theirs = await account().add({ form_id: 'mewtwo', status: 'permanent' });
    expect(await guest().get(theirs.id)).toBeUndefined();
    await expect(guest().remove(theirs.id)).rejects.toThrow(StorageError);
  });

  it('skips backup rows that already belong to the other roster here', async () => {
    const mine = await account().add({ form_id: 'mewtwo', status: 'permanent' });
    const result = await guest().importEntries([{ ...mine, status: 'trial', updated_at: '2099-01-01T00:00:00.000Z' }]);
    expect(result).toEqual({ added: 0, updated: 0, unchanged: 1 });
    expect((await account().get(mine.id))?.status).toBe('permanent');
  });
});

describe('claiming the guest roster', () => {
  it('moves live guest Pokémon into the account and queues them as inserts', async () => {
    await guest().add({ form_id: 'garchomp', status: 'permanent' });
    const gone = await guest().add({ form_id: 'torkoal', status: 'trial' });
    await guest().remove(gone.id);

    expect(await guestCount(db)).toBe(1);
    expect(await claimGuestRoster(db, ME)).toBe(1);
    expect(await guestCount(db)).toBe(0);
    expect((await account().list()).map((e) => e.form_id)).toEqual(['garchomp']);
    expect(await db.get('roster_entries', gone.id)).toBeUndefined(); // guest tombstones never uploaded
    const queue = await db.getAll('outbox');
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ isNew: true });
  });

  it('refuses, changing nothing, if the account would go over the cap', async () => {
    await guest().addMany(Array.from({ length: 3 }, () => ({ form_id: 'garchomp', status: 'permanent' as const })));
    await account().addMany(Array.from({ length: 1998 }, () => ({ form_id: 'mewtwo', status: 'permanent' as const })));
    await expect(claimGuestRoster(db, ME)).rejects.toMatchObject({ code: 'row_cap_reached' });
    expect(await guestCount(db)).toBe(3);
  });

  it('remembers a choice to keep the guest roster separate, per account', async () => {
    await declineGuestUpload(db, ME);
    expect(await guestUploadDeclined(db, ME)).toBe(true);
    expect(await guestUploadDeclined(db, OTHER)).toBe(false);
  });
});

describe('uploading', () => {
  async function claimed(count: number) {
    await guest().addMany(Array.from({ length: count }, () => ({ form_id: 'garchomp', status: 'permanent' as const })));
    await claimGuestRoster(db, ME);
  }

  it('sends queued rows in batches with the account’s id and clears the queue', async () => {
    await claimed(250);
    const server = fakeServer();
    expect(await uploadPendingInserts(db, server.inserter, ME)).toEqual({ uploaded: 250, held: 0, status: 'done' });
    expect(server.calls.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(server.calls[0]![0]).toMatchObject({ user_id: ME, form_id: 'garchomp', deleted_at: null });
    expect(await db.getAll('outbox')).toEqual([]);
  });

  it('keeps everything queued while offline and finishes later', async () => {
    await claimed(3);
    const server = fakeServer();
    server.goOffline();
    expect((await uploadPendingInserts(db, server.inserter, ME)).status).toBe('offline');
    expect(await db.getAll('outbox')).toHaveLength(3);
    server.goOffline(false);
    expect(await uploadPendingInserts(db, server.inserter, ME)).toMatchObject({ uploaded: 3, status: 'done' });
  });

  it('drops rows deleted before they uploaded instead of sending them', async () => {
    await claimed(2);
    const [first] = await account().list();
    await account().remove(first!.id);
    const server = fakeServer();
    expect(await uploadPendingInserts(db, server.inserter, ME)).toMatchObject({ uploaded: 1 });
    expect(server.ids.has(first!.id)).toBe(false);
  });

  it('sets aside only the row whose id the server already has', async () => {
    await claimed(3);
    const [dupe] = await account().list();
    const server = fakeServer({ existing: [dupe!.id] });
    expect(await uploadPendingInserts(db, server.inserter, ME)).toEqual({ uploaded: 2, held: 1, status: 'done' });
    const queue = await db.getAll('outbox');
    expect(queue).toEqual([expect.objectContaining({ rowId: dupe!.id, held: 'duplicate_id' })]);
    // held rows wait for the conflict prompt rather than retrying forever
    expect(await uploadPendingInserts(db, server.inserter, ME)).toMatchObject({ uploaded: 0, held: 0 });
  });

  it('stops when the account is full and keeps the rest queued', async () => {
    await claimed(5);
    const server = fakeServer({ cap: 2 });
    expect((await uploadPendingInserts(db, server.inserter, ME)).status).toBe('full');
    expect(await db.getAll('outbox')).toHaveLength(5);
  });

  it('leaves another account’s queue alone', async () => {
    await claimed(2);
    const server = fakeServer();
    expect(await uploadPendingInserts(db, server.inserter, OTHER)).toMatchObject({ uploaded: 0, status: 'done' });
    expect(await db.getAll('outbox')).toHaveLength(2);
  });

  it('keeps an edit made while the insert was in flight, as an update', async () => {
    await claimed(1);
    const [entry] = await account().list();
    const server = fakeServer();
    const slow: RosterInserter = {
      async insert(rows) {
        await account().update(entry!.id, { nature: 'jolly' }); // the person edits mid-upload
        return server.inserter.insert(rows);
      },
    };
    await uploadPendingInserts(db, slow, ME);
    expect(await db.getAll('outbox')).toEqual([expect.objectContaining({ rowId: entry!.id, isNew: false })]);
  });
});
