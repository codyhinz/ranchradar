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

refreshStatus();
markOwned().catch(() => undefined); // storage blocked or unavailable: the page works without it
