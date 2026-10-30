/**
 * Builds data/generated/* from the regulation files.
 *
 *   npm run seed
 *
 * Reads every data/regulations/*.json, collects the form and item ids they use, and fills in
 * metadata from Pokémon Showdown's MIT-licensed data (@pkmn/dex) and multilingual names from
 * PokeAPI's CSVs (pinned to a commit). Any id that doesn't resolve stops the run.
 * New ids are appended to data/id-registry.json, which validation uses to stop renames.
 * Run it after editing a regulation file, then commit the regulation file and the output together.
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Dex, type Species } from '@pkmn/dex';
import {
  DATA_DIR,
  LOCALES,
  readRegistry,
  readVariantFile,
  type VariantRecords,
  readPoolFile,
  readRegulations,
  slug,
  type FormRecord,
  type ItemRecord,
  type Locale,
  type NameMap,
} from './lib/data';

/** Pinned so reruns produce the same output. Bump deliberately to pick up new names. */
const POKEAPI_COMMIT = '2ee1c422ad9f3831245dab0ac2a5cd1aae61cd72';
const POKEAPI_CSV = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv`;

/** PokeAPI language ids per app locale, in preference order (kana before kanji for Japanese). */
const POKEAPI_LANGUAGES: Record<Locale, number[]> = {
  en: [9], ja: [1, 11], ko: [3], 'zh-Hant': [4], 'zh-Hans': [12], fr: [5], de: [6], es: [7], it: [8],
};

/** Official sprites, self-hosted from PokeAPI's sprite repository (pinned). */
const SPRITES_COMMIT = 'bfb75391935310368065096fa08c51e8970bc43e';
const SPRITES_URL = `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_COMMIT}/sprites/pokemon`;
const SPRITES_DIR = join(DATA_DIR, '..', 'public', 'sprites');
/** Where our ids (Showdown naming) differ from PokeAPI's form identifiers. */
const POKEAPI_ALIASES: Record<string, string> = {
  'basculegion-f': 'basculegion-female',
  'indeedee-f': 'indeedee-female',
  'meowstic-f': 'meowstic-female',
  'tauros-paldea-combat': 'tauros-paldea-combat-breed',
  'tauros-paldea-blaze': 'tauros-paldea-blaze-breed',
  'tauros-paldea-aqua': 'tauros-paldea-aqua-breed',
  'oinkologne-f': 'oinkologne-female',
  'darmanitan-galar': 'darmanitan-galar-standard',
  'necrozma-dusk-mane': 'necrozma-dusk',
  'necrozma-dawn-wings': 'necrozma-dawn',
  'greninja-bond': 'greninja-battle-bond',
  'ogerpon-wellspring': 'ogerpon-wellspring-mask',
  'ogerpon-hearthflame': 'ogerpon-hearthflame-mask',
  'ogerpon-cornerstone': 'ogerpon-cornerstone-mask',
  'pikachu-original': 'pikachu-original-cap',
  'pikachu-hoenn': 'pikachu-hoenn-cap',
  'pikachu-sinnoh': 'pikachu-sinnoh-cap',
  'pikachu-unova': 'pikachu-unova-cap',
  'pikachu-kalos': 'pikachu-kalos-cap',
  'pikachu-alola': 'pikachu-alola-cap',
  'pikachu-partner': 'pikachu-partner-cap',
  'pikachu-world': 'pikachu-world-cap',
};
const pokeapiIdentifier = (id: string) => POKEAPI_ALIASES[id] ?? id;

/** Sprites the app shows outside the roster (header and empty state). */
const BRAND_SPRITES = ['torkoal'];

/** Stored size: sharp on 3x phone screens at the largest size the app shows (the 112px mascot). */
const SPRITE_PX = 256;

/**
 * Pokémon HOME renders (512px, smooth 3D like the game itself), shrunk to SPRITE_PX WebP.
 * Forms without a HOME render fall back to the classic 96px sprite, scaled up with hard edges.
 */
/** One sprite at an explicit PokeAPI path (e.g. "671-yellow"), HOME render first. */
async function downloadSpriteAt(target: string, path: string): Promise<boolean> {
  if (existsSync(target)) return true;
  // HOME render, then official artwork (also smooth), then the classic pixel sprite.
  let source = await fetch(`${SPRITES_URL}/other/home/${path}.png`);
  let smooth = true;
  if (!source.ok) source = await fetch(`${SPRITES_URL}/other/official-artwork/${path}.png`);
  if (!source.ok) { source = await fetch(`${SPRITES_URL}/${path}.png`); smooth = false; }
  if (!source.ok) return false;
  await sharp(Buffer.from(await source.arrayBuffer()))
    .trim()
    .resize(SPRITE_PX, SPRITE_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: smooth ? 'lanczos3' : 'nearest' })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(target);
  return true;
}

async function downloadSprites(ids: string[], pokemonIdByForm: Map<string, string>): Promise<string[]> {
  mkdirSync(SPRITES_DIR, { recursive: true });
  const missing: string[] = [];
  for (const id of ids) {
    const target = join(SPRITES_DIR, `${id}.webp`);
    if (existsSync(target)) continue;
    const pokemonId = pokemonIdByForm.get(pokeapiIdentifier(id)) ?? pokemonIdByForm.get(id);
    if (!pokemonId) { missing.push(id); continue; }
    const home = await fetch(`${SPRITES_URL}/other/home/${pokemonId}.png`);
    const source = home.ok ? home : await fetch(`${SPRITES_URL}/${pokemonId}.png`);
    if (!source.ok) { missing.push(id); continue; }
    await sharp(Buffer.from(await source.arrayBuffer()))
      .trim()
      .resize(SPRITE_PX, SPRITE_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: home.ok ? 'lanczos3' : 'nearest' })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(target);
  }
  return missing;
}

/** Showdown flags for forms that aren't in any released game (fan-made, LGPE-only, unreleased). */
const UNRELEASED = new Set(['CAP', 'Custom', 'LGPE', 'Future']);

/**
 * Every form that doesn't evolve any further: fully evolved Pokémon and ones that never evolve,
 * with their regional and alternate forms. Battle-only forms, cosmetic looks and non-base
 * forms of species whose looks live in variants.json are left out, then the hand-kept excludes.
 */
function poolForms(exclude: string[], variantSpecies: string[]): string[] {
  const all = Dex.species.all();
  const cosmetic = new Set(all.flatMap((s) => s.cosmeticFormes ?? []));
  const skip = new Set(exclude);
  const ids: string[] = [];
  for (const s of all) {
    if (s.num <= 0 || UNRELEASED.has(String(s.isNonstandard)) || (s.evos?.length ?? 0) > 0) continue;
    if (s.battleOnly || s.isMega || s.isPrimal || /Gmax|Totem/.test(s.forme) || cosmetic.has(s.name)) continue;
    const id = slug(s.name);
    const base = slug(s.baseSpecies);
    if (id !== base && variantSpecies.includes(base)) continue;
    if (!skip.has(id)) ids.push(id);
  }
  return ids;
}

async function fetchCsv(file: string): Promise<string[][]> {
  const response = await fetch(`${POKEAPI_CSV}/${file}`);
  if (!response.ok) throw new Error(`Fetching ${file} failed: HTTP ${response.status}`);
  const text = await response.text();
  return text.trim().split(/\r?\n/).slice(1).map(parseCsvLine);
}

/** Minimal CSV parsing with quoted fields (PokeAPI quotes names that contain commas). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** For each locale, the first non-empty value among that locale's PokeAPI language ids. */
function pickLocales(byLanguage: Map<number, string>): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    for (const languageId of POKEAPI_LANGUAGES[locale]) {
      const value = byLanguage.get(languageId);
      if (value) { out[locale] = value; break; }
    }
  }
  return out;
}

function groupNames(rows: string[][], keyCol: number, nameCol: number): Map<string, Map<number, string>> {
  const grouped = new Map<string, Map<number, string>>();
  for (const row of rows) {
    const key = row[keyCol]!;
    const name = row[nameCol] ?? '';
    if (!grouped.has(key)) grouped.set(key, new Map());
    if (name) grouped.get(key)!.set(Number(row[1]), name);
  }
  return grouped;
}

async function main() {
  const regulations = readRegulations();
  const formIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const regulation of regulations) {
    regulation.forms.forEach((id) => formIds.add(id));
    regulation.items.forEach((id) => itemIds.add(id));
  }
  // Everything ever shipped keeps its reference record, so a Pokémon that leaves a season
  // stays in people's rosters and can return later. Only the regulation's list decides legality.
  const shipped = readRegistry();
  shipped.forms.forEach((id) => formIds.add(id));
  shipped.items.forEach((id) => itemIds.add(id));

  // Showdown lookups by our slug ids
  const speciesBySlug = new Map<string, Species>(Dex.species.all().map((s) => [slug(s.name), s]));

  // The always-addable pool: Pokémon you can own outside the current season (see data/pool.json).
  const pool = poolForms(readPoolFile().exclude, Object.keys(readVariantFile().variants));
  pool.forEach((id) => formIds.add(id));
  const available = [...new Set([...pool, ...regulations.flatMap((r) => r.forms)])].sort();
  const itemsBySlug = new Map(Dex.items.all().map((item) => [slug(item.name), item]));

  const problems: string[] = [];
  const items: ItemRecord[] = [];
  for (const id of [...itemIds].sort()) {
    const item = itemsBySlug.get(id);
    if (!item) { problems.push(`Unknown item id "${id}"`); continue; }
    const mega = item.megaStone ? Object.entries(item.megaStone)[0] : undefined;
    // Reference data only: the stone's base form gets a record so the stone can point at it.
    // It is not added to any regulation's box list.
    if (mega) formIds.add(slug(mega[0]));
    items.push({
      id,
      category: mega ? 'mega_stone' : item.isBerry ? 'berry' : 'held',
      mega_target: mega ? slug(mega[1]) : null,
      mega_base_form: mega ? slug(mega[0]) : null,
      sprite_key: id,
    });
  }

  const forms: FormRecord[] = [];
  for (const id of formIds) {
    const species = speciesBySlug.get(id);
    if (!species) { problems.push(`Unknown form id "${id}"`); continue; }
    forms.push({
      id,
      species_id: slug(species.baseSpecies),
      dex_number: species.num,
      types: species.types.map((type) => type.toLowerCase()),
      sprite_key: id,
    });
  }
  forms.sort((a, b) => a.dex_number - b.dex_number || a.id.localeCompare(b.id));

  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    console.error('\nCheck spelling against Showdown names (e.g. "Ninetales-Alola" → ninetales-alola).');
    process.exit(1);
  }

  // Names from PokeAPI
  console.log('Fetching PokeAPI names…');
  const [speciesNames, pokemonForms, formNameRows, itemRows, itemNameRows, natureRows, natureNameRows, typeRows, typeNameRows] = await Promise.all([
    fetchCsv('pokemon_species_names.csv'), // pokemon_species_id, language_id, name, genus
    fetchCsv('pokemon_forms.csv'),         // id, identifier, ...
    fetchCsv('pokemon_form_names.csv'),    // pokemon_form_id, language_id, form_name, pokemon_name
    fetchCsv('items.csv'),                 // id, identifier, ...
    fetchCsv('item_names.csv'),            // item_id, language_id, name
    fetchCsv('natures.csv'),               // id, identifier, ...
    fetchCsv('nature_names.csv'),          // nature_id, language_id, name
    fetchCsv('types.csv'),                 // id, identifier, ...
    fetchCsv('type_names.csv'),            // type_id, language_id, name
  ]);
  const speciesNameById = groupNames(speciesNames, 0, 2);
  const formIdByIdentifier = new Map(pokemonForms.map((row) => [row[1]!, row[0]!]));
  const pokemonIdByForm = new Map(pokemonForms.map((row) => [row[1]!, row[3]!]));
  const fullFormNames = groupNames(formNameRows, 0, 3);
  const formLabels = groupNames(formNameRows, 0, 2);
  const itemIdByIdentifier = new Map(itemRows.map((row) => [row[1]!, row[0]!]));
  const itemNamesById = groupNames(itemNameRows, 0, 2);

  const formNames: NameMap = {};
  for (const form of forms) {
    const speciesName = pickLocales(speciesNameById.get(String(form.dex_number)) ?? new Map());
    const pokeapiFormId = formIdByIdentifier.get(pokeapiIdentifier(form.id));
    const full = pickLocales(fullFormNames.get(pokeapiFormId ?? '') ?? new Map());
    const label = pickLocales(formLabels.get(pokeapiFormId ?? '') ?? new Map());
    const names: Partial<Record<Locale, string>> = {};
    const isBaseForm = form.id === form.species_id;
    // English qualifier for forms PokeAPI hasn't translated, e.g. "Hisuian Arcanine" → "Hisuian".
    const enName = full.en ?? speciesBySlug.get(form.id)!.name;
    const enQualifier = (label.en ?? enName.replace(speciesName.en ?? '', '').trim()).replace(/\s*\((.+)\)/, ', $1');
    for (const locale of LOCALES) {
      const species = speciesName[locale];
      let name = full[locale];
      if (!name && species) {
        if (isBaseForm) name = species;
        else if (label[locale]) name = `${species} (${label[locale]})`;
        // No translation of the form yet: keep the local species name so search stays in-language.
        else name = enQualifier ? `${species} (${enQualifier})` : species;
      }
      if (name) names[locale] = name;
    }
    names.en ??= enName;
    formNames[form.id] = names;
  }

  // Forms of one species that end up with the same name in a language (PokeAPI often skips the
  // breed or variety) get the Showdown forme appended, e.g. ケンタロス (パルデアのすがた) Aqua.
  for (const locale of LOCALES) {
    const seen = new Map<string, string[]>();
    for (const form of forms) {
      const name = formNames[form.id]?.[locale];
      if (name) seen.set(name, [...(seen.get(name) ?? []), form.id]);
    }
    for (const ids of seen.values()) {
      if (ids.length < 2) continue;
      for (const id of ids) {
        const forme = speciesBySlug.get(id)!.forme;
        const tag = forme ? forme.split('-').pop() : '';
        if (tag) formNames[id]![locale] = `${formNames[id]![locale]} ${tag}`;
      }
    }
  }

  const itemNames: NameMap = {};
  for (const item of items) {
    const names = pickLocales(itemNamesById.get(itemIdByIdentifier.get(item.id) ?? '') ?? new Map());
    names.en ??= itemsBySlug.get(item.id)!.name;
    itemNames[item.id] = names;
  }

  // Cosmetic variants (Alcremie flavors, Florges colors, ...): names and sprites
  const variantFile = readVariantFile();
  const formRowByIdentifier = new Map(pokemonForms.map((row) => [row[1]!, row]));
  const variants: VariantRecords = {};
  const variantSprites: { id: string; path: string }[] = [];
  for (const [formId, list] of Object.entries(variantFile.variants)) {
    if (!forms.some((f) => f.id === formId)) { problems.push(`variants.json: unknown form "${formId}"`); continue; }
    variants[formId] = list.map((variant) => {
      const row = formRowByIdentifier.get(variant.pokeapi_form);
      if (!row) { problems.push(`variants.json: unknown PokeAPI form "${variant.pokeapi_form}"`); return { id: variant.id, names: { en: variant.en } }; }
      // row: id, identifier, form_identifier, pokemon_id, introduced_in, is_default
      variantSprites.push({ id: variant.id, path: row[5] === '1' ? row[3]! : `${row[3]}-${row[2]}` });
      const label = pickLocales(formLabels.get(row[0]!) ?? new Map());
      const names: Partial<Record<Locale, string>> = {};
      for (const locale of LOCALES) {
        // Alcremie's PokeAPI labels include the sweet; the variant is the cream alone.
        const name = label[locale]?.replace(/\s*(Strawberry Sweet|Fraise en Sucre)$/, '');
        if (name) names[locale] = name;
      }
      names.en = variant.en;
      return { id: variant.id, names };
    });
  }
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }

  // Nature and type names, for the nature picker and type tags
  const namesById = (rows: string[][], nameRows: string[][]): NameMap => {
    const grouped = groupNames(nameRows, 0, 2);
    const out: NameMap = {};
    for (const row of rows) {
      const names = pickLocales(grouped.get(row[0]!) ?? new Map());
      if (Object.keys(names).length) out[row[1]!] = names;
    }
    return out;
  };
  const natureNames = namesById(natureRows, natureNameRows);
  const typeNames = namesById(typeRows, typeNameRows);

  // Write output and grow the registry (append-only)
  const generatedDir = join(DATA_DIR, 'generated');
  mkdirSync(generatedDir, { recursive: true });
  const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  write(join(generatedDir, 'forms.json'), forms);
  write(join(generatedDir, 'available.json'), available);
  write(join(generatedDir, 'items.json'), items);
  write(join(generatedDir, 'form-names.json'), formNames);
  write(join(generatedDir, 'item-names.json'), itemNames);
  write(join(generatedDir, 'nature-names.json'), natureNames);
  write(join(generatedDir, 'type-names.json'), typeNames);

  const registry = readRegistry();
  const grow = (existing: string[], ids: string[]) => [...new Set([...existing, ...ids])].sort();
  write(join(DATA_DIR, 'id-registry.json'), {
    forms: grow(registry.forms, forms.map((f) => f.id)),
    items: grow(registry.items, items.map((i) => i.id)),
    variants: grow(registry.variants ?? [], Object.values(variants).flat().map((v) => v.id)),
  });
  write(join(DATA_DIR, 'generated', 'variants.json'), variants);

  // Base forms PokeAPI files under a gendered or default identifier fall back to the dex number.
  for (const form of forms) {
    if (form.id === form.species_id && !pokemonIdByForm.has(form.id)) pokemonIdByForm.set(form.id, String(form.dex_number));
  }
  console.log('Downloading sprites…');
  const missingSprites = await downloadSprites([...forms.map((f) => f.id), ...BRAND_SPRITES], pokemonIdByForm);
  mkdirSync(join(SPRITES_DIR, 'variants'), { recursive: true });
  for (const { id, path } of variantSprites) {
    if (!(await downloadSpriteAt(join(SPRITES_DIR, 'variants', `${id}.webp`), path))) missingSprites.push(id);
  }

  const missingLocales = forms.filter((f) => Object.keys(formNames[f.id]!).length < LOCALES.length).length;
  console.log(`✓ ${forms.length} forms (${available.length} addable), ${items.length} items from ${regulations.length} regulation file(s)`);
  if (missingLocales) console.log(`  ${missingLocales} form(s) are missing some translations (English is used instead)`);
  if (missingSprites.length) console.log(`  No sprite yet for: ${missingSprites.join(', ')} (the app shows a placeholder)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
