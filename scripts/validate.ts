/**
 * Checks the data files. Runs in CI on every pull request, with no network access.
 *
 *   npm run validate:data
 */
import { pathToFileURL } from 'node:url';
import { DATA_DIR, readGenerated, readRegistry, readRegulations } from './lib/data';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateData(dataDir: string = DATA_DIR): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const regulations = readRegulations(dataDir);
  const generated = readGenerated(dataDir);
  const registry = readRegistry(dataDir);

  const formIds = new Set(generated.forms.map((f) => f.id));
  const itemsById = new Map(generated.items.map((i) => [i.id, i]));

  // Each regulation file on its own
  const seenRegulationIds = new Set<string>();
  for (const reg of regulations) {
    const where = `regulations/${reg.id}`;
    if (seenRegulationIds.has(reg.id)) errors.push(`${where}: duplicate regulation id`);
    seenRegulationIds.add(reg.id);

    if (!ISO_DATE.test(reg.starts_at) || !ISO_DATE.test(reg.ends_at)) {
      errors.push(`${where}: starts_at and ends_at must be UTC timestamps like 2026-09-09T02:00:00Z`);
    } else if (reg.ends_at <= reg.starts_at) {
      errors.push(`${where}: ends_at must be after starts_at`);
    }
    if (reg.status !== 'draft' && reg.status !== 'final') {
      errors.push(`${where}: status must be "draft" or "final"`);
    }

    for (const [label, ids] of [['forms', reg.forms], ['items', reg.items], ['megas', reg.megas]] as const) {
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dupes.length) errors.push(`${where}: duplicate ${label}: ${[...new Set(dupes)].join(', ')}`);
      const badSlugs = ids.filter((id) => !SLUG.test(id));
      if (badSlugs.length) errors.push(`${where}: ${label} ids must be lowercase-with-dashes: ${badSlugs.join(', ')}`);
    }

    const unseeded = [...reg.forms.filter((id) => !formIds.has(id)), ...reg.items.filter((id) => !itemsById.has(id))];
    if (unseeded.length) {
      errors.push(`${where}: not in generated data (run "npm run seed"): ${unseeded.join(', ')}`);
    }

    for (const stone of reg.megas) {
      const item = itemsById.get(stone);
      if (!reg.items.includes(stone)) {
        errors.push(`${where}: Mega "${stone}" is allowed but its stone isn't in this regulation's items`);
      } else if (item && item.category !== 'mega_stone') {
        errors.push(`${where}: "${stone}" is listed under megas but isn't a Mega Stone`);
      } else if (item?.mega_base_form && !reg.forms.includes(item.mega_base_form)) {
        // Megas are tracked separately from the box list, so this is a heads-up, not a failure.
        warnings.push(`${where}: Mega "${stone}" is allowed but "${item.mega_base_form}" isn't in this regulation's forms`);
      }
    }

    if (reg.status === 'final' && reg.forms.length !== reg.expected_forms) {
      errors.push(`${where}: has ${reg.forms.length} forms but the announcement lists ${reg.expected_forms}`);
    } else if (reg.status === 'draft') {
      warnings.push(`${where}: draft, ${reg.forms.length} of ${reg.expected_forms} forms listed`);
    }
  }

  // Regulations must not overlap in time
  const byStart = [...regulations].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (let i = 1; i < byStart.length; i++) {
    if (byStart[i]!.starts_at < byStart[i - 1]!.ends_at) {
      errors.push(`regulations ${byStart[i - 1]!.id} and ${byStart[i]!.id} overlap in time`);
    }
  }

  // Stable ids: nothing ever shipped may disappear
  const missingForms = registry.forms.filter((id) => !formIds.has(id));
  const missingItems = registry.items.filter((id) => !itemsById.has(id));
  const variantIds = new Set(Object.values(generated.variants).flat().map((v) => v.id));
  const missingVariants = (registry.variants ?? []).filter((id) => !variantIds.has(id));
  if (missingForms.length || missingItems.length || missingVariants.length) {
    errors.push(
      `ids were removed or renamed (shipped ids must never change): ${[...missingForms, ...missingItems, ...missingVariants].join(', ')}`,
    );
  }

  // Cosmetic variants: belong to a real form, unique, slug-shaped, named in English
  const seenVariants = new Set<string>();
  for (const [formId, list] of Object.entries(generated.variants)) {
    if (!formIds.has(formId)) errors.push(`variants: form "${formId}" doesn't exist`);
    if (list.length < 2) errors.push(`variants: "${formId}" needs at least two variants`);
    for (const variant of list) {
      if (!SLUG.test(variant.id)) errors.push(`variants: "${variant.id}" isn't a lowercase-dash id`);
      if (seenVariants.has(variant.id) || formIds.has(variant.id)) errors.push(`variants: "${variant.id}" is used twice`);
      seenVariants.add(variant.id);
      if (!variant.names.en) errors.push(`variants: "${variant.id}" has no English name`);
    }
  }

  // The addable pool: real forms, and every regulation's Pokémon can always be added
  const available = new Set(generated.available);
  const unknownAvailable = generated.available.filter((id) => !formIds.has(id));
  if (unknownAvailable.length) errors.push(`generated: addable forms missing from forms.json: ${unknownAvailable.join(', ')}`);
  for (const reg of regulations) {
    const notAddable = reg.forms.filter((id) => formIds.has(id) && !available.has(id));
    if (notAddable.length) errors.push(`regulations/${reg.id}: not addable (run "npm run seed"): ${notAddable.join(', ')}`);
  }

  // Every generated record has English and stays consistent
  for (const form of generated.forms) {
    if (!generated.formNames[form.id]?.en) errors.push(`generated: form "${form.id}" has no English name`);
  }
  for (const item of generated.items) {
    if (!generated.itemNames[item.id]?.en) errors.push(`generated: item "${item.id}" has no English name`);
    if (item.mega_base_form && !formIds.has(item.mega_base_form)) {
      errors.push(`generated: Mega Stone "${item.id}" points at missing form "${item.mega_base_form}"`);
    }
  }

  return { errors, warnings };
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { errors, warnings } = validateData();
  warnings.forEach((w) => console.warn(`! ${w}`));
  errors.forEach((e) => console.error(`✗ ${e}`));
  if (errors.length) {
    console.error(`\n${errors.length} problem(s) found.`);
    process.exit(1);
  }
  console.log('✓ Data is valid');
}
