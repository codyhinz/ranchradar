import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestReferenceMigration, lit, nextMigrationName, referenceSql, type ReferenceData } from './referenceSql';

const data: ReferenceData = {
  regulations: [{ id: 'M-C', name: 'Regulation Set M-C', starts_at: '2026-09-09T02:00:00Z', ends_at: '2026-12-02T01:59:59Z', status: 'final', expected_forms: 2, forms: ['sirfetchd', 'garchomp'], items: ['garchompite', 'focus-sash'], megas: ['garchompite'] }],
  forms: [
    { id: 'sirfetchd', species_id: 'sirfetchd', dex_number: 865, types: ['fighting'], sprite_key: 'sirfetchd' },
    { id: 'garchomp', species_id: 'garchomp', dex_number: 445, types: ['dragon', 'ground'], sprite_key: 'garchomp' },
  ],
  formNames: { garchomp: { en: 'Garchomp', ja: 'ガブリアス' }, sirfetchd: { en: 'Sirfetch’d', fr: "Palarticho's" } },
  items: [
    { id: 'garchompite', category: 'mega_stone', mega_target: 'garchomp-mega', mega_base_form: 'garchomp', sprite_key: 'garchompite' },
    { id: 'focus-sash', category: 'held', mega_target: null, mega_base_form: null, sprite_key: 'focus-sash' },
  ],
  itemNames: { garchompite: { en: 'Garchompite' }, 'focus-sash': { en: 'Focus Sash' } },
  variants: {},
};

describe('reference data migration', () => {
  const sql = referenceSql(data);

  it('escapes quotes and writes nulls and arrays', () => {
    expect(lit("Palarticho's")).toBe("'Palarticho''s'");
    expect(sql).toContain("('focus-sash', 'held', null, null, 'focus-sash')");
    expect(sql).toContain("array['dragon', 'ground']");
    expect(sql).toContain("'Palarticho''s'");
  });

  it('upserts every table and keeps parents before children', () => {
    for (const table of ['regulations', 'forms', 'form_names', 'items', 'item_names', 'regulation_forms', 'regulation_items', 'regulation_megas']) {
      expect(sql).toContain(`insert into public.${table} `);
    }
    expect(sql.indexOf('into public.forms ')).toBeLessThan(sql.indexOf('into public.items '));
    expect(sql.indexOf('delete from public.regulation_megas')).toBeLessThan(sql.indexOf('delete from public.regulation_items'));
    expect(sql.indexOf('into public.regulation_items ')).toBeLessThan(sql.indexOf('into public.regulation_megas '));
  });

  it('trims each regulation to its list without touching reference rows', () => {
    expect(sql).toContain("delete from public.regulation_forms where regulation_id = 'M-C' and form_id <> all (array['garchomp', 'sirfetchd']::text[]);");
    expect(sql).not.toMatch(/delete from public\.(forms|items|form_names)/);
  });

  it('is the same however the input is ordered', () => {
    expect(referenceSql({ ...data, forms: [...data.forms].reverse(), items: [...data.items].reverse() })).toBe(sql);
  });

  it('names new migrations after every existing one', () => {
    expect(nextMigrationName([], new Date('2026-10-30T03:20:05Z'))).toBe('20261030032005_reference_data.sql');
    expect(nextMigrationName(['20261030032005_reference_data.sql'], new Date('2026-10-30T03:20:05Z'))).toBe('20261030032006_reference_data.sql');
  });

  it('finds the newest reference migration only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
    writeFileSync(join(dir, '20261018000000_initial_schema.sql'), 'schema');
    writeFileSync(join(dir, '20261020000000_reference_data.sql'), 'old');
    writeFileSync(join(dir, '20261030000000_reference_data.sql'), 'new');
    expect(latestReferenceMigration(dir)).toEqual({ file: '20261030000000_reference_data.sql', sql: 'new' });
  });
});
