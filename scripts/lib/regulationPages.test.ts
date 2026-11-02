import { readJson, readGenerated, readRegulations, DATA_DIR, type NameMap, type RegulationFile } from './data';
import { join } from 'node:path';
import { Dex } from '@pkmn/dex';
import { dateRange, escapeHtml, megaDisplayName, renderRegulationPages, renderSitemap, seasonStatus, type RegulationPageData } from './regulationPages';

const reg = (id: string, starts: string, ends: string, forms: string[], extra: Partial<RegulationFile> = {}): RegulationFile => ({
  id, name: `Regulation Set ${id}`, starts_at: starts, ends_at: ends, status: 'final', expected_forms: forms.length,
  forms, items: [], megas: [], ...extra,
});

const small: RegulationPageData = {
  regulations: [
    reg('M-B', '2026-06-17T02:00:00Z', '2026-09-09T01:59:59Z', ['absol', 'garchomp'], { items: ['leftovers', 'absolite'], megas: ['absolite'] }),
    reg('M-A', '2026-04-08T02:00:00Z', '2026-06-17T01:59:59Z', ['garchomp']),
  ],
  forms: [
    { id: 'absol', species_id: 'absol', dex_number: 359, types: ['dark'], sprite_key: 'absol' },
    { id: 'garchomp', species_id: 'garchomp', dex_number: 445, types: ['dragon', 'ground'], sprite_key: 'garchomp' },
    { id: 'floette-eternal', species_id: 'floette', dex_number: 670, types: ['fairy'], sprite_key: 'floette-eternal' },
  ],
  items: [
    { id: 'leftovers', category: 'held', mega_target: null, mega_base_form: null, sprite_key: 'leftovers' },
    { id: 'absolite', category: 'mega_stone', mega_target: 'absol-mega', mega_base_form: 'absol', sprite_key: 'absolite' },
  ],
  formNames: { absol: { en: 'Absol' }, garchomp: { en: 'Garchomp' } },
  itemNames: { leftovers: { en: 'Leftovers' }, absolite: { en: 'Absolite' } },
  typeNames: { dark: { en: 'Dark' }, dragon: { en: 'Dragon' }, ground: { en: 'Ground' } },
  megaName: (id) => (id === 'absol-mega' ? 'Mega Absol' : id),
};

describe('regulation pages', () => {
  const now = new Date('2026-07-01T00:00:00Z');
  const pages = renderRegulationPages(small, now);
  const page = (path: string) => pages.find((p) => p.path === path)!;

  it('writes one page per regulation plus an index', () => {
    expect(pages.map((p) => p.file).sort()).toEqual(['regulations/index.html', 'regulations/m-a/index.html', 'regulations/m-b/index.html']);
  });

  it('lists the season, what it added, and links to its neighbours', () => {
    const html = page('/regulations/m-b/').html;
    expect(html).toContain('<h1>Regulation Set M-B</h1>');
    expect(html).toContain('June 17 – September 9, 2026');
    expect(html).toContain('New since M-A');
    expect(html).toContain('1 new Pokémon');
    expect(html).toContain('data-form="absol"');
    expect(html).toContain('Mega Absol');
    expect(html).toContain('Leftovers');
    expect(html).toContain('href="/regulations/m-a/"');
    expect(html).toContain('<link rel="canonical" href="https://ranchradar.dev/regulations/m-b/" />');
    expect(page('/regulations/m-a/').html).not.toContain('New since');
  });

  it('marks the current season the same way the app picks it', () => {
    expect(page('/regulations/m-b/').html).toContain('data-status="current"');
    expect(page('/regulations/m-a/').html).toContain('data-status="past"');
    expect(seasonStatus('2026-09-09T02:00:00Z', null, now)).toBe('upcoming');
    // after the last season ends, it stays current until the next file ships
    expect(seasonStatus('2026-06-17T02:00:00Z', null, new Date('2027-01-01T00:00:00Z'))).toBe('current');
  });

  it('notes Megas whose Pokémon the Roster Ranch never offers', () => {
    const data = { ...small, regulations: [reg('M-C', '2026-09-09T02:00:00Z', '2026-12-02T01:59:59Z', ['absol'], { items: ['absolite'], megas: ['absolite'] })] };
    data.items = [...small.items, { id: 'floettite', category: 'mega_stone', mega_target: 'floette-mega', mega_base_form: 'floette-eternal', sprite_key: 'floettite' }];
    data.regulations[0]!.items.push('floettite');
    data.regulations[0]!.megas.push('floettite');
    const html = renderRegulationPages(data, now)[0]!.html;
    expect(html.match(/Not recruitable at the Roster Ranch/g)).toHaveLength(1);
  });

  it('escapes text and formats names', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(dateRange('2026-12-02T02:00:00Z', '2027-02-01T01:59:59Z')).toBe('December 2, 2026 – February 1, 2027');
    expect(megaDisplayName('Absol', 'Mega-Z')).toBe('Mega Absol Z');
    expect(megaDisplayName('Charizard', 'Mega-X')).toBe('Mega Charizard X');
    expect(megaDisplayName('Meowstic', 'M-Mega')).toBe('Mega Meowstic');
    expect(megaDisplayName('Floette', 'Mega')).toBe('Mega Floette');
  });

  it('writes a sitemap', () => {
    expect(renderSitemap(['/', '/regulations/'])).toContain('<loc>https://ranchradar.dev/regulations/</loc>');
  });

  it('builds from the real data without gaps', () => {
    const generated = readGenerated();
    const real = renderRegulationPages({
      regulations: readRegulations(),
      forms: generated.forms,
      items: generated.items,
      formNames: generated.formNames,
      itemNames: generated.itemNames,
      typeNames: readJson<NameMap>(join(DATA_DIR, 'generated', 'type-names.json')),
      megaName: (id) => {
        const species = Dex.species.get(id);
        return species.exists ? megaDisplayName(species.baseSpecies, species.forme) : id;
      },
    });
    for (const { html, path } of real) {
      // every Mega resolved to a display name, every form and item has an English name
      expect(html, path).not.toMatch(/<strong>[a-z][a-z0-9-]*<\/strong>/);
      expect(html, path).not.toMatch(/reg-mon-name">[a-z][a-z0-9-]*</);
    }
  });
});
