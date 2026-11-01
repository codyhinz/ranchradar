import 'fake-indexeddb/auto';
import { openRanchDB, type RanchDB } from '../local/db';
import { createLocalRosterStore } from '../local/localRosterStore';
import { syncRoster, type RosterChanges, type RosterRemote, type ServerRow } from '../sync/syncEngine';

const ME = '00000000-0000-0000-0000-00000000000a';
let db: RanchDB;

beforeEach(async () => { db = await openRanchDB(`test-${crypto.randomUUID()}`); });
afterEach(() => db.close());

const mine = () => createLocalRosterStore({ db, userId: ME, syncEnabled: true });

/**
 * A pretend Supabase: bumps version and sets updated_at on every write like the touch_row
 * trigger, answers conditional updates, and can go offline. Its clock runs ahead of nobody's.
 */
function fakeServer() {
  const rows = new Map<string, ServerRow>();
  let clock = Date.parse('2026-11-01T00:00:00.000Z');
  // Postgres-style timestamps, to check the device normalizes them
  const stamp = () => new Date((clock += 1000)).toISOString().replace('Z', '123+00:00');
  let offline = false;
  const down = { ok: false as const, reason: 'offline' as const, message: 'Failed to fetch' };

  const remote: RosterRemote = {
    async insert(batch) {
      if (offline) return down;
      if (batch.some((r) => rows.has(r.id))) return { ok: false, reason: 'duplicate', message: 'duplicate key' };
      for (const r of batch) rows.set(r.id, { ...r, spread: r.spread ?? null, version: 1, updated_at: stamp() });
      return { ok: true };
    },
    async update(id, baseVersion, changes) {
      if (offline) return down;
      const row = rows.get(id);
      if (!row || row.version !== baseVersion) return { ok: true, row: null };
      const next = { ...row, ...changes, version: row.version + 1, updated_at: stamp() };
      rows.set(id, next);
      return { ok: true, row: next };
    },
    async fetch(id) {
      if (offline) return down;
      const row = rows.get(id);
      return { ok: true, rows: row ? [row] : [] };
    },
    async changedSince(userId, since, offset, limit) {
      if (offline) return down;
      const all = [...rows.values()]
        .filter((r) => r.user_id === userId && (!since || Date.parse(r.updated_at) > Date.parse(since)))
        .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.id.localeCompare(b.id));
      return { ok: true, rows: all.slice(offset, offset + limit) };
    },
  };

  /** Another device writing straight to the server. */
  const otherDevice = {
    add(formId: string): ServerRow {
      const at = stamp();
      const row: ServerRow = {
        id: crypto.randomUUID(), user_id: ME, form_id: formId, status: 'permanent', trial_expires_at: null,
        nature: null, variant: null, spread: null, notes: null, source: 'manual', version: 1,
        created_at: at, updated_at: at, deleted_at: null,
      };
      rows.set(row.id, row);
      return row;
    },
    change(id: string, changes: Partial<RosterChanges>) {
      const row = rows.get(id)!;
      rows.set(id, { ...row, ...changes, version: row.version + 1, updated_at: stamp() });
    },
  };

  return { remote, rows, otherDevice, goOffline: (value = true) => { offline = value; } };
}

const sync = (server: ReturnType<typeof fakeServer>) => syncRoster(db, server.remote, ME);
const queue = () => db.getAll('outbox');

describe('sending this device’s changes', () => {
  it('sends an edit as a versioned update and takes the server’s version', async () => {
    const server = fakeServer();
    const entry = await mine().add({ form_id: 'garchomp', status: 'permanent' });
    await sync(server);
    await mine().update(entry.id, { nature: 'jolly' });

    expect(await sync(server)).toMatchObject({ sent: 1, status: 'done' });
    expect(server.rows.get(entry.id)).toMatchObject({ nature: 'jolly', version: 2 });
    expect(await mine().get(entry.id)).toMatchObject({ nature: 'jolly', version: 2 });
    expect(await queue()).toEqual([]);
  });

  it('sends a removal so other devices hear about it', async () => {
    const server = fakeServer();
    const entry = await mine().add({ form_id: 'garchomp', status: 'permanent' });
    await sync(server);
    await mine().remove(entry.id);
    await sync(server);
    expect(server.rows.get(entry.id)?.deleted_at).not.toBeNull();
  });

  it('keeps an edit made while the update was in flight, based on the new version', async () => {
    const server = fakeServer();
    const entry = await mine().add({ form_id: 'garchomp', status: 'permanent' });
    await sync(server);
    await mine().update(entry.id, { nature: 'jolly' });
    const real = server.remote.update;
    server.remote.update = async (...args) => {
      await mine().update(entry.id, { notes: 'scarf' }); // edited mid-request
      return real(...args);
    };
    await sync(server);
    server.remote.update = real;

    expect(await mine().get(entry.id)).toMatchObject({ nature: 'jolly', notes: 'scarf', version: 2 });
    await sync(server);
    expect(server.rows.get(entry.id)).toMatchObject({ notes: 'scarf', version: 3 });
  });

  it('keeps everything queued while offline', async () => {
    const server = fakeServer();
    const entry = await mine().add({ form_id: 'garchomp', status: 'permanent' });
    await sync(server);
    await mine().update(entry.id, { nature: 'jolly' });
    server.goOffline();
    expect((await sync(server)).status).toBe('offline');
    expect(await queue()).toHaveLength(1);
    server.goOffline(false);
    expect(await sync(server)).toMatchObject({ sent: 1, status: 'done' });
  });

  it('sends a row the server lost back up as new', async () => {
    const server = fakeServer();
    const entry = await mine().add({ form_id: 'garchomp', status: 'permanent' });
    await sync(server);
    server.rows.delete(entry.id);
    await mine().update(entry.id, { nature: 'jolly' });
    await sync(server);
    await sync(server);
    expect(server.rows.get(entry.id)).toMatchObject({ nature: 'jolly' });
  });
});

describe('receiving other devices’ changes', () => {
  it('brings in Pokémon added elsewhere, then only what’s changed since', async () => {
    const server = fakeServer();
    server.otherDevice.add('mewtwo');
    server.otherDevice.add('torkoal');
    expect(await sync(server)).toMatchObject({ received: 2 });
    expect((await mine().list()).map((e) => e.form_id).sort()).toEqual(['mewtwo', 'torkoal']);
    expect(await sync(server)).toMatchObject({ received: 0 }); // the overlap re-reads, but writes nothing
  });

  it('stores server timestamps in the device’s format', async () => {
    const server = fakeServer();
    const row = server.otherDevice.add('mewtwo');
    await sync(server);
    expect((await mine().get(row.id))?.updated_at).toBe(new Date(row.updated_at).toISOString());
  });

  it('applies edits and removals made elsewhere', async () => {
    const server = fakeServer();
    const kept = server.otherDevice.add('mewtwo');
    const gone = server.otherDevice.add('torkoal');
    await sync(server);
    server.otherDevice.change(kept.id, { nature: 'timid' });
    server.otherDevice.change(gone.id, { deleted_at: new Date().toISOString() });
    expect(await sync(server)).toMatchObject({ received: 2 });
    expect(await mine().get(kept.id)).toMatchObject({ nature: 'timid', version: 2 });
    expect((await mine().list()).map((e) => e.form_id)).toEqual(['mewtwo']);
  });

  it('skips rows removed before this device ever saw them', async () => {
    const server = fakeServer();
    const row = server.otherDevice.add('mewtwo');
    server.otherDevice.change(row.id, { deleted_at: new Date().toISOString() });
    await sync(server);
    expect(await db.get('roster_entries', row.id)).toBeUndefined();
  });
});

describe('conflicts', () => {
  async function bothEdited(theirs: Partial<RosterChanges>, ours: Parameters<ReturnType<typeof mine>['update']>[1] | 'remove') {
    const server = fakeServer();
    const entry = await mine().add({ form_id: 'garchomp', status: 'permanent' });
    await sync(server);
    server.otherDevice.change(entry.id, theirs);
    if (ours === 'remove') await mine().remove(entry.id);
    else await mine().update(entry.id, ours);
    return { server, entry };
  }

  it('holds a row both devices changed, with the server’s copy, and keeps this device’s', async () => {
    const { server, entry } = await bothEdited({ nature: 'timid' }, { nature: 'jolly' });
    expect(await sync(server)).toMatchObject({ sent: 0, conflicts: 1, status: 'done' });
    expect(await mine().get(entry.id)).toMatchObject({ nature: 'jolly' });
    expect(await queue()).toEqual([expect.objectContaining({ held: 'conflict', theirs: expect.objectContaining({ nature: 'timid', version: 2 }) })]);
    expect(server.rows.get(entry.id)).toMatchObject({ nature: 'timid' });
    // later passes leave it for the prompt instead of overwriting either side
    expect(await sync(server)).toMatchObject({ sent: 0, received: 0, conflicts: 1 });
  });

  it('treats an edit against a removal elsewhere as a conflict too', async () => {
    const { server } = await bothEdited({ deleted_at: new Date().toISOString() }, { nature: 'jolly' });
    expect(await sync(server)).toMatchObject({ conflicts: 1 });
  });

  it('doesn’t ask when both devices made the same change', async () => {
    const { server, entry } = await bothEdited({ nature: 'jolly' }, { nature: 'jolly' });
    expect(await sync(server)).toMatchObject({ conflicts: 0 });
    expect(await mine().get(entry.id)).toMatchObject({ nature: 'jolly', version: 2 });
    expect(await queue()).toEqual([]);
  });

  it('doesn’t ask when both devices removed it', async () => {
    const { server } = await bothEdited({ deleted_at: new Date().toISOString() }, 'remove');
    expect(await sync(server)).toMatchObject({ conflicts: 0 });
    expect(await queue()).toEqual([]);
  });
});
