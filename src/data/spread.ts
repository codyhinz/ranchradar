import type { Nature } from './types';

/**
 * Stat points (SP), Pokémon Champions' stand-in for EVs: up to 32 in a stat and 66 in all,
 * each point adding exactly 1 to the Level 50 stat. IVs don't exist (every stat acts as 31).
 *
 * A spread is stored on the roster entry as `{ hp, atk, def, spa, spd, spe }`, always with all
 * six keys in this order (the order Postgres keeps jsonb keys in, so both sides compare equal).
 * A copy with no points recorded stores null rather than six zeros.
 */
export const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type StatKey = (typeof STATS)[number];
export type StatSpread = Record<StatKey, number>;

export const MAX_STAT_POINTS = 32;
export const TOTAL_STAT_POINTS = 66;

export const EMPTY_SPREAD: StatSpread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/** Raised and lowered stat for each nature; neutral natures have none. */
export const NATURE_EFFECTS: Partial<Record<Nature, [Exclude<StatKey, 'hp'>, Exclude<StatKey, 'hp'>]>> = {
  lonely: ['atk', 'def'], brave: ['atk', 'spe'], adamant: ['atk', 'spa'], naughty: ['atk', 'spd'],
  bold: ['def', 'atk'], relaxed: ['def', 'spe'], impish: ['def', 'spa'], lax: ['def', 'spd'],
  timid: ['spe', 'atk'], hasty: ['spe', 'def'], jolly: ['spe', 'spa'], naive: ['spe', 'spd'],
  modest: ['spa', 'atk'], mild: ['spa', 'def'], quiet: ['spa', 'spe'], rash: ['spa', 'spd'],
  calm: ['spd', 'atk'], gentle: ['spd', 'def'], sassy: ['spd', 'spe'], careful: ['spd', 'spa'],
};

export const spreadTotal = (spread: StatSpread | null): number =>
  spread ? STATS.reduce((sum, stat) => sum + spread[stat], 0) : 0;

/**
 * Reads a spread from anywhere untrusted (the server, a backup file). Missing stats count as 0;
 * anything else unexpected (extra keys, fractions, over a cap) makes it unreadable. Returns the
 * canonical form, or null for "not recorded" (no points, or unreadable).
 */
export function readSpread(value: unknown): StatSpread | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !(STATS as readonly string[]).includes(key))) return null;
  const spread = { ...EMPTY_SPREAD };
  for (const stat of STATS) {
    const points = raw[stat] ?? 0;
    if (typeof points !== 'number' || !Number.isInteger(points) || points < 0 || points > MAX_STAT_POINTS) return null;
    spread[stat] = points;
  }
  const total = spreadTotal(spread);
  return total === 0 || total > TOTAL_STAT_POINTS ? null : spread;
}

/** True for a spread the store will keep as is (canonical, within the caps, not empty). */
export function isValidSpread(value: unknown): value is StatSpread {
  const read = readSpread(value);
  return read !== null && JSON.stringify(read) === JSON.stringify(value);
}

/** Canonical copy of a spread being saved; six zeros become null. */
export function compactSpread(spread: StatSpread | null): StatSpread | null {
  if (!spread || spreadTotal(spread) === 0) return null;
  const out = { ...EMPTY_SPREAD };
  for (const stat of STATS) out[stat] = spread[stat];
  return out;
}

/** Same points on both, treating null and all zeros alike. */
export function sameSpread(a: StatSpread | null, b: StatSpread | null): boolean {
  return STATS.every((stat) => (a?.[stat] ?? 0) === (b?.[stat] ?? 0));
}

/** 1.1 for the stat a nature raises, 0.9 for the one it lowers, 1 otherwise. */
export function natureMultiplier(nature: Nature | null, stat: StatKey): number {
  const effect = nature ? NATURE_EFFECTS[nature] : undefined;
  if (!effect) return 1;
  return effect[0] === stat ? 1.1 : effect[1] === stat ? 0.9 : 1;
}

/**
 * Level 50 stats with every IV at 31 (Champions has no IVs):
 *   HP    = base + SP + 75
 *   other = floor((base + SP + 20) × nature)
 * `base` is HP, Atk, Def, SpA, SpD, Spe. Shedinja's HP is always 1.
 */
export function battleStats(base: readonly number[], spread: StatSpread | null, nature: Nature | null): StatSpread {
  const out = { ...EMPTY_SPREAD };
  STATS.forEach((stat, i) => {
    const b = base[i] ?? 0;
    const points = spread?.[stat] ?? 0;
    if (stat === 'hp') out.hp = b === 1 ? 1 : b + points + 75;
    // Integer math (×10) so 1.1 × 155 doesn't land a hair under 170.5 and floor the wrong way
    else out[stat] = Math.floor(((b + points + 20) * Math.round(natureMultiplier(nature, stat) * 10)) / 10);
  });
  return out;
}

/** How many more points `stat` can take: its own cap or what's left of the 66, whichever is less. */
export function roomFor(spread: StatSpread, stat: StatKey): number {
  const left = TOTAL_STAT_POINTS - spreadTotal(spread);
  return Math.max(0, Math.min(MAX_STAT_POINTS - spread[stat], left));
}
