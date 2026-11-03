import 'fake-indexeddb/auto';
import { itemOutboxId, openRanchDB, type RanchDB } from '../local/db';
import { forgetAccount } from '../local/forgetAccount';
import { createLocalItemStore } from '../local/localItemStore';
import { createLocalRosterStore } from '../local/localRosterStore';
import { claimGuestRoster } from '../sync/guestUpload';
import { syncOwnedItems, type ItemRemote, type ServerItemRow } from '../sync/itemSync';

const ME = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
let db: RanchDB;

beforeEach(async () => { db = await openRanchDB(`test-${crypto.randomUUID()}`); });
afterEach(() => db.close());

const guest = () => createLocalItemStore({ db, userId: null, syncEnabled: false });
const mine = (userId = ME) => createLocalItemStore({ db, userId, syncEnabled: true });
const ids = async (store: ReturnType<typeof guest>) => (await store.list()).map((r) => r.item_id).sort();

/** A pretend Supabase for owned_items: upserts on (user_id, item_id) and bumps version like touch_row. */
function fakeServer() {
  const rows = new Map<string, ServerItemRow>();
  let clock = Date.parse('2026-11-03T00:00:00.000Z');
  const stamp = () => new Date((clock += 1000)).toISOString().replace('Z', '123+00:00');
  let offline = false;
  const key = (userId: string, itemId: string) => `${userId}|${itemId}`;
  const upserts: number[] = [];
  const remote: ItemRemote = {
    async upsert(batch) {
      if (offline) return { ok: false, reason: 'offline', message: 'Failed to fetch' };
      upserts.push(batch.length);
      const out: ServerItemRow[] = [];
      for (const r of batch) {
        const old = rows.get(key(r.user_id, r.item_id));
        const at = stamp();
        const next: ServerItemRow = old
          ? { ...old, deleted_at: r.deleted_at, version: old.version + 1, updated_at: at }
          : { ...r, version: 1, created_at: at, updated_at: at };
        rows.set(key(r.user_id, r.item_id), next);
        out.push(next);
      }
      return { ok: true, rows: out };
    },
    async changedSince(userId, since, offset, limit) {
      if (offline) return { ok: false, reason: 'offline', message: 'Failed to fetch' };
      const all = [...rows.values()]
        .filter((r) => r.user_id === userId && (!since || Date.parse(r.updated_at) > Date.parse(since)))
        .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.item_id.localeCompare(b.item_id));
      return { ok: true, rows: all.slice(offset, offset + limit) };
    },
  };
  /** Another device marking an item straight on the server. */
  const otherDevice = (itemId: string, owned: boolean) => void remote.upsert([{ user_id: ME, item_id: itemId, deleted_at: owned ? null : stamp() }]);
  return { remote, rows, upserts, otherDevice, goOffline: (value = true) => { offline = value; } };
}

describe('marking items bought on this device', () => {
  it('keeps the guest’s items and each account’s apart', async () => {
    await guest().setOwned('focus-sash', true);
    await mine().setOwned('choice-scarf', true);
    await mine(OTHER).setOwned('leftovers', true);
    expect(await ids(guest())).toEqual(['focus-sash']);
    expect(await ids(mine())).toEqual(['choice-scarf']);
    expect(await ids(mine(OTHER))).toEqual(['leftovers']);
  });

  it('unmarks with a soft delete for accounts, so other devices hear about it', async () => {
    const store = mine();
    await store.setOwned('focus-sash', true);
    await store.setOwned('focus-sash', false);
    expect(await ids(store)).toEqual([]);
    expect((await db.get('owned_items', [ME, 'focus-sash']))?.deleted_at).not.toBeNull();
    expect(await db.get('outbox', ['owned_items', itemOutboxId(ME, 'focus-sash')])).toBeDefined();
  });

  it('drops a guest’s row outright and never queues guest changes', async () => {
    const store = guest();
    await store.setOwned('focus-sash', true);
    await store.setOwned('focus-sash', false);
    expect(await db.get('owned_items', ['', 'focus-sash'])).toBeUndefined();
    expect(await db.getAll('outbox')).toEqual([]);
  });

  it('ignores a tap that changes nothing and refuses unknown ids', async () => {
    const store = mine();
    let changes = 0;
    store.subscribe(() => changes++);
    await store.setOwned('focus-sash', false);
    await store.setOwned('focus-sash', true);
    await store.setOwned('focus-sash', true);
    expect(changes).toBe(1);
    await expect(store.setOwned('<script>', true)).rejects.toThrow();
  });
});

describe('syncing owned items', () => {
  it('sends this device’s marks and settles them with the server’s version', async () => {
    const server = fakeServer();
    await mine().setOwned('focus-sash', true);
    await mine().setOwned('leftovers', true);
    const result = await syncOwnedItems(db, server.remote, ME);
    expect(result).toEqual({ sent: 2, received: 0, status: 'done' });
    expect(server.upserts).toEqual([2]);
    expect(await db.getAll('outbox')).toEqual([]);
    expect([...server.rows.values()].every((r) => r.deleted_at === null)).toBe(true);
  });

  it('pulls marks made on another device, including unmarking', async () => {
    const server = fakeServer();
    server.otherDevice('focus-sash', true);
    server.otherDevice('leftovers', true);
    expect((await syncOwnedItems(db, server.remote, ME)).received).toBe(2);
    expect(await ids(mine())).toEqual(['focus-sash', 'leftovers']);
    server.otherDevice('leftovers', false);
    await syncOwnedItems(db, server.remote, ME);
    expect(await ids(mine())).toEqual(['focus-sash']);
  });

  it('keeps a change waiting to upload over the server’s copy, then sends it', async () => {
    const server = fakeServer();
    server.otherDevice('focus-sash', true);
    await syncOwnedItems(db, server.remote, ME);
    server.goOffline();
    await mine().setOwned('focus-sash', false);
    expect((await syncOwnedItems(db, server.remote, ME)).status).toBe('offline');
    expect(await ids(mine())).toEqual([]);
    server.goOffline(false);
    await syncOwnedItems(db, server.remote, ME);
    expect(server.rows.get(`${ME}|focus-sash`)?.deleted_at).not.toBeNull();
    expect(await ids(mine())).toEqual([]);
  });

  it('never touches another account’s queued items', async () => {
    const server = fakeServer();
    await mine(OTHER).setOwned('focus-sash', true);
    await syncOwnedItems(db, server.remote, ME);
    expect(server.rows.size).toBe(0);
    expect(await db.get('outbox', ['owned_items', itemOutboxId(OTHER, 'focus-sash')])).toBeDefined();
  });
});

describe('items and the guest roster', () => {
  it('come along when the guest roster is added to an account, without doubling up', async () => {
    await createLocalRosterStore({ db, userId: null, syncEnabled: false }).add({ form_id: 'garchomp', status: 'permanent' });
    await guest().setOwned('focus-sash', true);
    await guest().setOwned('leftovers', true);
    await mine().setOwned('leftovers', true);
    await claimGuestRoster(db, ME);
    expect(await ids(guest())).toEqual([]);
    expect(await ids(mine())).toEqual(['focus-sash', 'leftovers']);
    const queued = (await db.getAll('outbox')).filter((i) => i.table === 'owned_items').map((i) => i.rowId).sort();
    expect(queued).toEqual([itemOutboxId(ME, 'focus-sash'), itemOutboxId(ME, 'leftovers')]);
  });

  it('are forgotten with a deleted account, leaving everyone else’s', async () => {
    await guest().setOwned('focus-sash', true);
    await mine().setOwned('focus-sash', true);
    await mine(OTHER).setOwned('focus-sash', true);
    await forgetAccount(db, ME);
    expect(await ids(mine())).toEqual([]);
    expect(await ids(guest())).toEqual(['focus-sash']);
    expect(await ids(mine(OTHER))).toEqual(['focus-sash']);
    expect((await db.getAll('outbox')).map((i) => i.rowId)).toEqual([itemOutboxId(OTHER, 'focus-sash')]);
  });
});
