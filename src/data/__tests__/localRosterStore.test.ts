import 'fake-indexeddb/auto';
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
