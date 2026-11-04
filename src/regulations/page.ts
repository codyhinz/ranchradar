// Regulation pages: same fonts, colors and theme as the legal pages, plus two small touches.
import '../legal/legal';
import './regulations.css';
import { DB_NAME, openRanchDB } from '../data/local/db';
import { seasonStatus } from '../../scripts/lib/regulationPages';

const LABELS = { upcoming: 'Upcoming', current: 'Current season', past: 'Past season' } as const;

/** The page is built ahead of time, so the season label is worked out again here. */
function refreshStatus(): void {
  for (const badge of Array.from(document.querySelectorAll<HTMLElement>('.season-status'))) {
    const status = seasonStatus(badge.dataset.starts ?? '', badge.dataset.nextStarts || null, new Date());
    badge.dataset.status = status;
    badge.textContent = LABELS[status];
  }
}

/**
 * Whose roster to count: the signed-in account's, read from the session Supabase keeps in this
 * browser (no network call), else the guest roster. Same rule the app uses to pick a roster.
 */
function currentOwner(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split('.')[0];
    const session = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? 'null') as { user?: { id?: unknown } } | null;
    return typeof session?.user?.id === 'string' ? session.user.id : null;
  } catch {
    return null;
  }
}

/** Marks the Pokémon this device's roster holds and shows "You own X of Y". Nothing leaves the device. */
async function markOwned(): Promise<void> {
  // Don't create an empty database for visitors who have never opened the app.
  const known = await indexedDB.databases?.().catch(() => undefined);
  if (known && !known.some((db) => db.name === DB_NAME)) return;
  const db = await openRanchDB();
  const owner = currentOwner();
  const rows = await db.getAll('roster_entries');
  db.close();
  const owned = new Set(rows.filter((row) => row.user_id === owner && !row.deleted_at).map((row) => row.form_id));
  if (owned.size === 0) return;

  for (const tile of Array.from(document.querySelectorAll<HTMLElement>('.reg-mon[data-form]'))) {
    if (!owned.has(tile.dataset.form ?? '')) continue;
    tile.classList.add('is-owned');
    tile.querySelector<HTMLElement>('.reg-owned')?.removeAttribute('hidden');
  }

  const mine = document.querySelector<HTMLElement>('.reg-mine');
  if (!mine) return;
  const total = Number(mine.dataset.total);
  const tiles = document.querySelectorAll<HTMLElement>('section[aria-labelledby="pokemon"] .reg-mon');
  const have = new Set(Array.from(tiles).map((tile) => tile.dataset.form).filter((id) => id && owned.has(id))).size;
  const count = mine.querySelector<HTMLElement>('.reg-mine-count');
  const bar = mine.querySelector<HTMLProgressElement>('.reg-mine-bar');
  const text = mine.querySelector<HTMLElement>('.reg-mine-text');
  if (!count || !bar || !text) return;
  count.querySelector('strong')!.textContent = `You own ${have} of ${total} in your RanchRadar roster on this device.`;
  count.hidden = false;
  bar.value = have;
  bar.hidden = false;
  bar.setAttribute('aria-label', `${have} of ${total} owned`);
  const link = document.createElement('a');
  link.href = '/';
  link.textContent = 'Open RanchRadar';
  text.replaceChildren('Owned Pokémon are marked below. ', link, ' to update your roster.');
}

/**
 * Lights the jump link for the section on screen, and keeps that link in view inside the strip.
 * Only the strip scrolls sideways, never the page.
 */
function trackSections(): void {
  const strip = document.querySelector<HTMLElement>('.reg-jump ul');
  if (!strip) return;
  const links = Array.from(strip.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  // A section heading stands for its whole section, so the link stays lit until the next one starts.
  const targets = links.map((link) => {
    const el = document.getElementById(link.hash.slice(1));
    return el?.tagName === 'H2' ? el.closest('section') ?? el : el;
  });
  let lit: HTMLAnchorElement | null = null;
  let queued = false;
  const update = () => {
    queued = false;
    // The last section whose heading has reached the strip (plus a little slack) is the one being read.
    const line = strip.getBoundingClientRect().bottom + 48;
    // At the very bottom the last sections can't scroll up to the strip, so the lowest heading on screen wins.
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const reach = atEnd ? window.innerHeight * 0.6 : line;
    let index = -1;
    targets.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= reach) index = i; });
    const next = links[index] ?? null;
    if (next === lit) return;
    lit?.removeAttribute('aria-current');
    next?.setAttribute('aria-current', 'location');
    lit = next;
    const li = next?.parentElement;
    if (!li) return;
    const left = li.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + li.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 16) });
    }
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('scrollend', schedule); // a smooth jump's last scroll event can land before it settles
  window.addEventListener('hashchange', schedule);
  window.addEventListener('resize', schedule);
  update();
}

refreshStatus();
trackSections();
markOwned().catch(() => undefined); // storage blocked or unavailable: the page works without it
