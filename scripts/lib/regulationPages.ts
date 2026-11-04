/**
 * Public regulation pages, written as static HTML at build time so search engines can read them:
 * /regulations/ lists every season, and /regulations/<id>/ shows one season's Roster Ranch
 * Pokémon, Mega Evolutions and held items, plus what changed from the season before.
 *
 * Everything here is plain data in, HTML out. vite.config.ts writes the files and hands them to
 * Vite as pages, which bundles src/regulations/page.ts into each one: that script marks which
 * Pokémon the visitor owns, from the roster saved on their device.
 */
import type { FormRecord, ItemRecord, NameMap, RegulationFile } from './data';

export const SITE_ORIGIN = 'https://ranchradar.dev';
/** Where the generated pages live, relative to the project root (gitignored). */
export const PAGES_DIR = 'regulations';

export interface RegulationPageData {
  regulations: RegulationFile[];
  forms: FormRecord[];
  items: ItemRecord[];
  formNames: NameMap;
  itemNames: NameMap;
  typeNames: NameMap;
  /** English display name for a Mega Evolution's form id, e.g. absol-mega-z → "Mega Absol Z". */
  megaName: (megaFormId: string) => string;
}

export interface GeneratedPage {
  /** Path relative to the project root, e.g. regulations/m-c/index.html */
  file: string;
  /** Public URL path, e.g. /regulations/m-c/ */
  path: string;
  html: string;
}

export type SeasonStatus = 'upcoming' | 'current' | 'past';

const DATE = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const YEAR = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export const regulationSlug = (id: string) => id.toLowerCase();
export const regulationPath = (id: string) => `/${PAGES_DIR}/${regulationSlug(id)}/`;

/** "September 9 – December 2, 2026" (both ends shown in UTC, as the game announces them). */
export function dateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startYear = YEAR.format(start);
  const endYear = YEAR.format(end);
  return startYear === endYear
    ? `${DATE.format(start)} – ${DATE.format(end)}, ${endYear}`
    : `${DATE.format(start)}, ${startYear} – ${DATE.format(end)}, ${endYear}`;
}

/** Same rule as the app: the latest regulation that has started is the one in effect. */
export function seasonStatus(startsAt: string, nextStartsAt: string | null, now: Date): SeasonStatus {
  if (now.getTime() < Date.parse(startsAt)) return 'upcoming';
  if (nextStartsAt && now.getTime() >= Date.parse(nextStartsAt)) return 'past';
  return 'current';
}

const STATUS_LABEL: Record<SeasonStatus, string> = { upcoming: 'Upcoming', current: 'Current season', past: 'Past season' };

interface Season {
  reg: RegulationFile;
  previous: RegulationFile | null;
  next: RegulationFile | null;
}

function seasons(regulations: RegulationFile[]): Season[] {
  const sorted = [...regulations].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return sorted.map((reg, i) => ({ reg, previous: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null }));
}

function head(title: string, description: string, path: string): string {
  const url = SITE_ORIGIN + path;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="RanchRadar" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_ORIGIN}/brand/og-1200x630.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#e9e6e3" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1f1b19" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <script type="module" src="/src/regulations/page.ts"></script>
  </head>`;
}

const brand = `<a class="legal-home" href="/"><img src="/brand/mark-112.webp" width="48" height="48" alt="" /><span>RanchRadar</span></a>`;

function footer(): string {
  return `
      <footer class="legal-foot">
        <a class="legal-back" href="/">Open RanchRadar</a>
        <p><a href="/${PAGES_DIR}/">All regulations</a> · <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
        <p data-ad-choices hidden><button type="button" class="link-button">Ad privacy choices</button></p>
        <p>RanchRadar is an unofficial fan project and isn’t affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and all related names are trademarks of their respective owners.</p>
      </footer>`;
}

function statusBadge(season: Season, now: Date): string {
  const status = seasonStatus(season.reg.starts_at, season.next?.starts_at ?? null, now);
  // page.ts recomputes this on load, so a page built weeks ago still shows the right label.
  return `<span class="season-status" data-status="${status}" data-starts="${season.reg.starts_at}" data-next-starts="${season.next?.starts_at ?? ''}">${STATUS_LABEL[status]}</span>`;
}

export function renderRegulationPages(data: RegulationPageData, now: Date = new Date()): GeneratedPage[] {
  const formsById = new Map(data.forms.map((f) => [f.id, f]));
  const itemsById = new Map(data.items.map((i) => [i.id, i]));
  const formName = (id: string) => data.formNames[id]?.en ?? id;
  const itemName = (id: string) => data.itemNames[id]?.en ?? id;
  const typeName = (type: string) => data.typeNames[type]?.en ?? type;
  const byDex = (a: string, b: string) =>
    (formsById.get(a)?.dex_number ?? 0) - (formsById.get(b)?.dex_number ?? 0) || formName(a).localeCompare(formName(b));
  const byName = (names: (id: string) => string) => (a: string, b: string) => names(a).localeCompare(names(b));

  const tile = (id: string) => {
    const form = formsById.get(id);
    const types = (form?.types ?? [])
      .map((type) => `<span class="type" data-type="${type}">${escapeHtml(typeName(type))}</span>`)
      .join('');
    return `<li class="reg-mon" data-form="${id}"><img src="/sprites/${id}.webp" width="64" height="64" alt="" loading="lazy" decoding="async" /><span class="reg-mon-name">${escapeHtml(formName(id))}</span><span class="types">${types}</span><span class="reg-owned" hidden>Owned</span></li>`;
  };
  const monGrid = (ids: string[]) => `<ul class="reg-grid">${[...ids].sort(byDex).map(tile).join('')}</ul>`;

  const megaRow = (stone: string, reg: RegulationFile) => {
    const item = itemsById.get(stone);
    const base = item?.mega_base_form ?? '';
    const recruitable = reg.forms.includes(base);
    const note = recruitable ? '' : `<span class="reg-note">Not recruitable at the Roster Ranch</span>`;
    return `<li><img src="/sprites/${base}.webp" width="40" height="40" alt="" loading="lazy" decoding="async" /><span><strong>${escapeHtml(data.megaName(item?.mega_target ?? stone))}</strong><span class="reg-sub">${escapeHtml(itemName(stone))}</span>${note}</span></li>`;
  };
  const megaName = (stone: string) => data.megaName(itemsById.get(stone)?.mega_target ?? stone);
  const megaList = (stones: string[], reg: RegulationFile) =>
    `<ul class="reg-megas">${[...stones].sort(byName(megaName)).map((s) => megaRow(s, reg)).join('')}</ul>`;
  // Same picture path as the app's itemSpriteUrl (src/components/Sprite.tsx).
  const itemChip = (id: string) =>
    `<li><img src="/sprites/items/${id}.webp" width="28" height="28" alt="" loading="lazy" decoding="async" /><span>${escapeHtml(itemName(id))}</span></li>`;
  const itemList = (ids: string[]) => `<ul class="reg-items">${[...ids].sort(byName(itemName)).map(itemChip).join('')}</ul>`;
  const heldOnly = (ids: string[]) => ids.filter((id) => itemsById.get(id)?.category !== 'mega_stone');

  const list = seasons(data.regulations);
  const pages: GeneratedPage[] = [];

  for (const season of list) {
    const { reg, previous, next } = season;
    const path = regulationPath(reg.id);
    const held = heldOnly(reg.items).filter((id) => itemsById.get(id)?.category === 'held');
    const berries = heldOnly(reg.items).filter((id) => itemsById.get(id)?.category === 'berry');
    const dates = dateRange(reg.starts_at, reg.ends_at);
    const title = `${reg.name}: all ${reg.forms.length} Pokémon · Pokémon Champions · RanchRadar`;
    const description = `Every Pokémon you can recruit at the Roster Ranch in Pokémon Champions ${reg.name} (${dates}), plus its ${reg.megas.length} Mega Evolutions and ${heldOnly(reg.items).length} held items.`;

    let changes = '';
    if (previous) {
      const newForms = reg.forms.filter((id) => !previous.forms.includes(id));
      const goneForms = previous.forms.filter((id) => !reg.forms.includes(id));
      const newMegas = reg.megas.filter((id) => !previous.megas.includes(id));
      const newItems = heldOnly(reg.items).filter((id) => !previous.items.includes(id));
      const parts: string[] = [];
      if (newForms.length) parts.push(`<h3>${newForms.length} new Pokémon</h3>${monGrid(newForms)}`);
      if (goneForms.length) parts.push(`<h3>${goneForms.length} left the Roster Ranch</h3>${monGrid(goneForms)}`);
      if (newMegas.length) parts.push(`<h3>${newMegas.length} new Mega Evolutions</h3>${megaList(newMegas, reg)}`);
      if (newItems.length) parts.push(`<h3>${newItems.length} new held items</h3>${itemList(newItems)}`);
      if (parts.length) {
        changes = `
      <section aria-labelledby="new">
        <h2 id="new">New since ${escapeHtml(previous.id)}</h2>
        ${parts.join('\n        ')}
      </section>`;
      }
    }

    // Jump links: one per section, in page order, each with its count so the strip doubles as a summary.
    const jumps: Array<[id: string, label: string, count: number]> = [
      ...(changes ? [['new', 'What’s new', 0] as [string, string, number]] : []),
      ['pokemon', 'Pokémon', reg.forms.length],
      ['megas', 'Mega Evolutions', reg.megas.length],
      ['items', 'Held items', held.length],
      ['berries', 'Berries', berries.length],
    ];
    const jumpNav = `<nav class="reg-jump" aria-label="Jump to section"><ul>${jumps
      .map(([id, label, count]) => `<li><a class="reg-jump-link" href="#${id}">${escapeHtml(label)}${count ? ` <span class="reg-jump-count">${count}</span>` : ''}</a></li>`)
      .join('')}</ul></nav>`;

    const neighbours = [
      previous ? `<a href="${regulationPath(previous.id)}">← ${escapeHtml(previous.name)}</a>` : '',
      next ? `<a href="${regulationPath(next.id)}">${escapeHtml(next.name)} →</a>` : '',
    ].filter(Boolean).join('');

    const html = `${head(title, description, path)}
  <body>
    <main class="legal reg">
      ${brand}
      <nav class="reg-crumbs" aria-label="Breadcrumb"><a href="/${PAGES_DIR}/">Regulations</a> / <span aria-current="page">${escapeHtml(reg.id)}</span></nav>
      <h1>${escapeHtml(reg.name)}</h1>
      <p class="legal-date">Pokémon Champions · ${dates} ${statusBadge(season, now)}</p>

      <ul class="reg-stats">
        <li><strong>${reg.forms.length}</strong> Pokémon to recruit</li>
        <li><strong>${reg.megas.length}</strong> Mega Evolutions</li>
        <li><strong>${heldOnly(reg.items).length}</strong> held items</li>
      </ul>

      <div class="legal-summary reg-mine" data-total="${reg.forms.length}">
        <p class="reg-mine-count" hidden><strong></strong></p>
        <progress class="reg-mine-bar" max="${reg.forms.length}" value="0" hidden></progress>
        <p class="reg-mine-text">Track which of these you own with <a href="/">RanchRadar</a>: tab over from the game, search, and know at a glance whether today’s recruit is new to your box. It works without an account.</p>
      </div>

      ${jumpNav}
${changes}
      <section aria-labelledby="pokemon">
        <h2 id="pokemon">All ${reg.forms.length} Pokémon</h2>
        <p>Every Pokémon the Roster Ranch can offer during ${escapeHtml(reg.id)}, in Pokédex order, as listed on the in-game Recruit → Roster Info screen. Pokémon that only come from gifts or Pokémon HOME may also be allowed in battle.</p>
        ${monGrid(reg.forms)}
      </section>

      <aside class="ad-slot" data-ad hidden aria-label="Advertisement"></aside>

      <section aria-labelledby="megas">
        <h2 id="megas">${reg.megas.length} Mega Evolutions</h2>
        <p>Only these Pokémon can Mega Evolve during ${escapeHtml(reg.id)}, each while holding its Mega Stone.</p>
        ${megaList(reg.megas, reg)}
      </section>

      <section aria-labelledby="items">
        <h2 id="items">${heldOnly(reg.items).length} held items</h2>
        <h3>Items</h3>
        ${itemList(held)}
        <h3 id="berries">Berries</h3>
        ${itemList(berries)}
      </section>

      ${neighbours ? `<nav class="reg-neighbours" aria-label="Other regulations">${neighbours}</nav>` : ''}
${footer()}
    </main>
  </body>
</html>
`;
    pages.push({ file: `${PAGES_DIR}/${regulationSlug(reg.id)}/index.html`, path, html });
  }

  const cards = [...list].reverse().map((season) => {
    const { reg } = season;
    return `<li><a class="reg-card" href="${regulationPath(reg.id)}"><span class="reg-card-title">${escapeHtml(reg.name)}</span><span class="reg-sub">${dateRange(reg.starts_at, reg.ends_at)}</span><span class="reg-sub">${reg.forms.length} Pokémon · ${reg.megas.length} Mega Evolutions · ${heldOnly(reg.items).length} held items</span>${statusBadge(season, now)}</a></li>`;
  });
  const indexPath = `/${PAGES_DIR}/`;
  pages.push({
    file: `${PAGES_DIR}/index.html`,
    path: indexPath,
    html: `${head('Pokémon Champions regulations · RanchRadar', 'Every Pokémon Champions regulation set: the Pokémon you can recruit at the Roster Ranch, the Mega Evolutions and held items allowed, and what each season added.', indexPath)}
  <body>
    <main class="legal reg">
      ${brand}
      <h1>Pokémon Champions regulations</h1>
      <p class="legal-date">Each ranked season runs under a regulation set that decides which Pokémon, Mega Evolutions and held items you can use. Pick one to see its full list and what it added.</p>
      <ul class="reg-cards">${cards.join('')}</ul>
${footer()}
    </main>
  </body>
</html>
`,
  });
  return pages;
}

/** sitemap.xml for every public page: the app, the regulation pages and the legal pages. */
export function renderSitemap(paths: string[]): string {
  const urls = paths.map((path) => `  <url><loc>${SITE_ORIGIN}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** "Absol-Mega-Z" → "Mega Absol Z", "Meowstic-M-Mega" → "Mega Meowstic", "Floette-Mega" → "Mega Floette". */
export function megaDisplayName(baseSpecies: string, forme: string): string {
  const after = forme.split('Mega')[1] ?? '';
  const suffix = after.replace(/^-/, '').replace(/-/g, ' ');
  return `Mega ${baseSpecies}${suffix ? ` ${suffix}` : ''}`;
}
