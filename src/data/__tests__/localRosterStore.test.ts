import 'fake-indexeddb/auto';
import type { ImportedRosterEntry } from '../types';
import { openRanchDB, type RanchDB } from '../local/db';
import { createLocalRosterStore } from '../local/localRosterStore';
import { describeOwnership, summarizeByForm } from '../ownership';
import { StorageError } from '../storage';

const T0 = new Date('2026-10-18T12:00:00Z');
let dbName: string;
let db: RanchDB;
let clock: Date;

beforeEach(async () => {
  dbName = `test-${crypto.randomUUID()}`;
  db = await openRanchDB(dbName);
  clock = T0;
});
afterEach(() => db.close());

function store(syncEnabled = false) {
  return createLocalRosterStore({ db, userId: null, syncEnabled, now: () => clock });
}

describe('adding', () => {
  it('saves a trial with a 7-day expiry and a permanent with none', async () => {
    const s = store();
    const trial = await s.add({ form_id: 'garchomp', status: 'trial' });
    const perm = await s.add({ form_id: 'garchomp', status: 'permanent' });

    expect(trial.trial_expires_at).toBe('2026-10-25T12:00:00.000Z');
    expect(perm.trial_expires_at).toBeNull();
    expect(trial.version).toBe(1);
    expect(await s.list()).toHaveLength(2);
  });

  it('rejects unknown natures and over-long notes', async () => {
    const s = store();
    await expect(s.add({ form_id: 'garchomp', status: 'permanent', nature: 'grumpy' as never }))
      .rejects.toBeInstanceOf(StorageError);
    await expect(s.add({ form_id: 'garchomp', status: 'permanent', notes: 'x'.repeat(501) }))
      .rejects.toThrow(/500/);
  });
});

describe('editing and deleting', () => {
  it('merges patches without touching the server version', async () => {
    const s = store();
    const entry = await s.add({ form_id: 'garchomp', status: 'trial' });
    clock = new Date('2026-10-19T12:00:00Z');
    const edited = await s.update(entry.id, { nature: 'jolly', status: 'permanent' });

    expect(edited.nature).toBe('jolly');
    expect(edited.trial_expires_at).toBeNull();
    expect(edited.version).toBe(1);
    expect(edited.updated_at).toBe('2026-10-19T12:00:00.000Z');
    expect(edited.created_at).toBe(entry.created_at);
  });

  it('soft-deletes: hidden from the list, kept for sync', async () => {
    const s = store();
    const entry = await s.add({ form_id: 'garchomp', status: 'permanent' });
    await s.remove(entry.id);

    expect(await s.list()).toHaveLength(0);
    expect((await s.list({ includeDeleted: true }))[0]?.deleted_at).not.toBeNull();
    await expect(s.update(entry.id, { notes: 'x' })).rejects.toThrow(/No roster entry/);
  });

  it('notifies subscribers after each change', async () => {
    const s = store();
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    const entry = await s.add({ form_id: 'garchomp', status: 'permanent' });
    await s.update(entry.id, { notes: 'lead' });
    unsubscribe();
    await s.remove(entry.id);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('outbox', () => {
  it('stays empty for guests', async () => {
    await store(false).add({ form_id: 'garchomp', status: 'permanent' });
    expect(await db.getAll('outbox')).toHaveLength(0);
  });

  it('keeps one item per row, still an insert after offline edits', async () => {
    const s = store(true);
    const entry = await s.add({ form_id: 'garchomp', status: 'trial' });
    await s.update(entry.id, { nature: 'jolly' });
    await s.remove(entry.id);

    const items = await db.getAll('outbox');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ rowId: entry.id, isNew: true, queuedAt: T0.toISOString() });
  });
});

describe('persistence', () => {
  it('survives closing and reopening the database', async () => {
    await store().add({ form_id: 'ninetales-alola', status: 'permanent' });
    db.close();
    db = await openRanchDB(dbName);
    const entries = await store().list();
    expect(entries.map((e) => e.form_id)).toEqual(['ninetales-alola']);
  });
});

describe('ownership summary', () => {
  it('counts permanent, trial and expired trials per form', async () => {
    const s = store();
    await s.add({ form_id: 'garchomp', status: 'permanent' });
    await s.add({ form_id: 'garchomp', status: 'trial' });
    await s.add({ form_id: 'garchomp', status: 'trial', trial_expires_at: '2026-10-10T00:00:00Z' });
    const deleted = await s.add({ form_id: 'garchomp', status: 'permanent' });
    await s.remove(deleted.id);

    const summary = summarizeByForm(await s.list(), T0).get('garchomp');
    expect(summary).toMatchObject({ total: 3, permanent: 1, trial: 2, expiredTrials: 1 });
    expect(describeOwnership(summary)).toBe('3 owned (1 perm, 2 trial, 1 expired)');
    expect(describeOwnership(undefined)).toBe('Not owned');
  });
});

describe('variants', () => {
  it('saves, changes and clears a cosmetic variant, and counts each one once', async () => {
    const s = store();
    const a = await s.add({ form_id: 'alcremie', status: 'permanent', variant: 'alcremie-ruby-cream' });
    clock = new Date(T0.getTime() + 1000);
    await s.add({ form_id: 'alcremie', status: 'trial', variant: 'alcremie-ruby-cream' });
    clock = new Date(T0.getTime() + 2000);
    const c = await s.add({ form_id: 'alcremie', status: 'permanent' });
    expect(c.variant).toBeNull();

    await s.update(c.id, { variant: 'alcremie-mint-cream' });
    expect(summarizeByForm(await s.list()).get('alcremie')!.variants).toEqual(['alcremie-ruby-cream', 'alcremie-mint-cream']);

    expect((await s.update(a.id, { variant: null })).variant).toBeNull();
  });

  it('upgrades rows saved before variants existed', async () => {
    db.close();
    const { openDB } = await import('idb');
    const name = `old-${crypto.randomUUID()}`;
    const v1 = await openDB(name, 1, {
      upgrade(d) {
        d.createObjectStore('roster_entries', { keyPath: 'id' }).createIndex('by_form', 'form_id');
        d.createObjectStore('outbox', { keyPath: ['table', 'rowId'] });
        d.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    await v1.put('roster_entries', { id: 'old-1', form_id: 'garchomp', status: 'permanent', deleted_at: null });
    v1.close();
    db = await openRanchDB(name);
    expect((await db.get('roster_entries', 'old-1'))!.variant).toBeNull();
  });
});

describe('bulk remove and undo', () => {
  it('removes many copies in one go and brings them back on undo', async () => {
    const s = store(true);
    const copies = [];
    for (let i = 0; i < 29; i++) copies.push(await s.add({ form_id: 'torkoal', status: 'permanent' }));
    const keep = copies[0]!;
    const removed = copies.slice(1).map((e) => e.id);

    await s.removeMany(removed);
    expect((await s.list()).map((e) => e.id)).toEqual([keep.id]);
    expect((await db.getAll('outbox')).length).toBe(29); // every removal is queued for sync

    await s.restore(removed);
    expect((await s.list()).length).toBe(29);
    expect((await s.list()).every((e) => e.deleted_at === null)).toBe(true);
  });
});

describe('importing a backup', () => {
  const row = (over: Partial<ImportedRosterEntry> = {}): ImportedRosterEntry => ({
    id: crypto.randomUUID(), form_id: 'garchomp', status: 'permanent', trial_expires_at: null,
    nature: null, variant: null, notes: null, source: 'manual',
    created_at: '2026-10-10T00:00:00.000Z', updated_at: '2026-10-10T00:00:00.000Z', ...over,
  });

  it('adds missing rows, keeps the newer copy of existing ones, and never deletes', async () => {
    const s = store();
    const mine = await s.add({ form_id: 'garchomp', status: 'permanent' }); // updated at T0
    const keep = await s.add({ form_id: 'lucario', status: 'permanent' });
    const result = await s.importEntries([
      row({ id: mine.id, notes: 'from backup', updated_at: '2026-10-19T00:00:00.000Z' }), // newer: wins
      row({ id: keep.id, form_id: 'lucario', notes: 'old', updated_at: '2026-10-01T00:00:00.000Z' }), // older: ignored
      row({ form_id: 'snorlax' }), // new
    ]);
    expect(result).toEqual({ added: 1, updated: 1, unchanged: 1 });
    expect((await s.get(mine.id))?.notes).toBe('from backup');
    expect((await s.get(keep.id))?.notes).toBeNull();
    expect(await s.list()).toHaveLength(3);
  });

  it('revives a deleted copy when the backup has a newer version of it', async () => {
    const s = store();
    const entry = await s.add({ form_id: 'garchomp', status: 'permanent' });
    await s.remove(entry.id);
    await s.importEntries([row({ id: entry.id, updated_at: '2026-10-20T00:00:00.000Z' })]);
    expect((await s.get(entry.id))?.deleted_at).toBeNull();
  });

  it('queues imported rows for upload when sync is on', async () => {
    const s = store(true);
    await s.importEntries([row()]);
    const [item] = await db.getAll('outbox');
    expect(item?.isNew).toBe(true);
  });
});

describe('purging tombstones', () => {
  it('hard-deletes old tombstones but keeps recent ones and live rows', async () => {
    const s = store();
    const old = await s.add({ form_id: 'garchomp', status: 'permanent' });
    const recent = await s.add({ form_id: 'lucario', status: 'permanent' });
    const live = await s.add({ form_id: 'snorlax', status: 'permanent' });
    await s.remove(old.id);
    clock = new Date(T0.getTime() + 3 * 86_400_000);
    await s.remove(recent.id);
    expect(await s.purgeDeleted(new Date(clock.getTime() - 86_400_000))).toBe(1);
    expect(await s.get(old.id)).toBeUndefined();
    expect((await s.get(recent.id))?.deleted_at).not.toBeNull();
    expect(await s.get(live.id)).toBeDefined();
  });

  it('keeps tombstones that are still waiting to upload', async () => {
    const s = store(true);
    const entry = await s.add({ form_id: 'garchomp', status: 'permanent' });
    await s.remove(entry.id);
    clock = new Date(T0.getTime() + 3 * 86_400_000);
    expect(await s.purgeDeleted(new Date(clock.getTime() - 86_400_000))).toBe(0);
  });
});
