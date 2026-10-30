import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FormRecord, IdRegistry, ItemRecord, NameMap, RegulationFile } from './lib/data';
import { slug } from './lib/data';
import { validateData } from './validate';

const forms: FormRecord[] = [
  { id: 'garchomp', species_id: 'garchomp', dex_number: 445, types: ['dragon', 'ground'], sprite_key: 'garchomp' },
  { id: 'ninetales-alola', species_id: 'ninetales', dex_number: 38, types: ['ice', 'fairy'], sprite_key: 'ninetales-alola' },
];
const items: ItemRecord[] = [
  { id: 'focus-sash', category: 'held', mega_target: null, mega_base_form: null, sprite_key: 'focus-sash' },
  { id: 'garchompite-z', category: 'mega_stone', mega_target: 'garchomp-mega-z', mega_base_form: 'garchomp', sprite_key: 'garchompite-z' },
];
const baseRegulation: RegulationFile = {
  id: 'M-C',
  name: 'Regulation Set M-C',
  starts_at: '2026-09-09T02:00:00Z',
  ends_at: '2026-12-02T01:59:59Z',
  status: 'final',
  expected_forms: 2,
  forms: ['garchomp', 'ninetales-alola'],
  items: ['focus-sash', 'garchompite-z'],
  megas: ['garchompite-z'],
};

function setup(options: {
  regulations?: RegulationFile[];
  registry?: IdRegistry;
  forms?: FormRecord[];
  formNames?: NameMap;
  available?: string[];
} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'rr-data-'));
  mkdirSync(join(dir, 'regulations'));
  mkdirSync(join(dir, 'generated'));
  const write = (path: string, value: unknown) => writeFileSync(join(dir, path), JSON.stringify(value));
  for (const reg of options.regulations ?? [baseRegulation]) write(`regulations/${reg.id}.json`, reg);
  const f = options.forms ?? forms;
  write('generated/forms.json', f);
  write('generated/items.json', items);
  write('generated/form-names.json', options.formNames ?? Object.fromEntries(f.map((x) => [x.id, { en: x.id }])));
  write('generated/available.json', options.available ?? f.map((x) => x.id));
  write('generated/item-names.json', Object.fromEntries(items.map((x) => [x.id, { en: x.id }])));
  write('id-registry.json', options.registry ?? { forms: f.map((x) => x.id), items: items.map((x) => x.id) });
  return dir;
}

describe('validateData', () => {
  it('passes a correct data set', () => {
    expect(validateData(setup())).toEqual({ errors: [], warnings: [] });
  });

  it('catches a renamed or removed id', () => {
    const dir = setup({ registry: { forms: ['garchomp', 'ninetales-alola', 'vulpix-alola'], items: [] } });
    expect(validateData(dir).errors.join()).toMatch(/vulpix-alola/);
  });

  it('requires an allowed Mega Stone in items, and only warns when its base Pokémon is not in the box list', () => {
    const noStone = setup({ regulations: [{ ...baseRegulation, items: ['focus-sash'] }] });
    expect(validateData(noStone).errors.join()).toMatch(/stone isn't in this regulation's items/);

    const noBase = setup({ regulations: [{ ...baseRegulation, forms: ['ninetales-alola'], expected_forms: 1 }] });
    expect(validateData(noBase).errors).toEqual([]);
    expect(validateData(noBase).warnings.join()).toMatch(/"garchomp" isn't in this regulation's forms/);
  });

  it('flags ids that were never seeded', () => {
    const dir = setup({ regulations: [{ ...baseRegulation, forms: [...baseRegulation.forms, 'rillaboom'], expected_forms: 3 }] });
    expect(validateData(dir).errors.join()).toMatch(/run "npm run seed".*rillaboom/);
  });

  it('keeps every regulation Pokémon addable and every addable id real', () => {
    expect(validateData(setup({ available: ['garchomp'] })).errors.join()).toMatch(/not addable.*ninetales-alola/);
    expect(validateData(setup({ available: ['garchomp', 'ninetales-alola', 'mewtwo'] })).errors.join()).toMatch(/missing from forms\.json: mewtwo/);
  });

  it('enforces the published count only once final', () => {
    const final = setup({ regulations: [{ ...baseRegulation, expected_forms: 229 }] });
    expect(validateData(final).errors.join()).toMatch(/lists 229/);

    const draft = setup({ regulations: [{ ...baseRegulation, expected_forms: 229, status: 'draft' }] });
    expect(validateData(draft).errors).toEqual([]);
    expect(validateData(draft).warnings.join()).toMatch(/2 of 229/);
  });

  it('rejects overlapping regulations and bad dates', () => {
    const overlap = setup({
      regulations: [baseRegulation, { ...baseRegulation, id: 'M-D', starts_at: '2026-11-01T02:00:00Z', ends_at: '2027-02-01T01:59:59Z' }],
    });
    expect(validateData(overlap).errors.join()).toMatch(/overlap/);

    const badDate = setup({ regulations: [{ ...baseRegulation, starts_at: 'Sept 9' }] });
    expect(validateData(badDate).errors.join()).toMatch(/UTC timestamps/);
  });

  it('requires an English name for every form', () => {
    const dir = setup({ formNames: { garchomp: { en: 'Garchomp' }, 'ninetales-alola': { ja: 'キュウコン' } } });
    expect(validateData(dir).errors.join()).toMatch(/ninetales-alola" has no English name/);
  });
});

describe('slug', () => {
  it('matches the id style used everywhere', () => {
    expect(slug('Ninetales-Alola')).toBe('ninetales-alola');
    expect(slug('Mr. Mime')).toBe('mr-mime');
    expect(slug('Garchompite Z')).toBe('garchompite-z');
    expect(slug('Flabébé')).toBe('flabebe');
    expect(slug('Nidoran♀')).toBe('nidoran-f');
    expect(slug("Farfetch’d")).toBe('farfetchd');
  });
});
