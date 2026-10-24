/**
 * Pokémon Champions box space. Every player starts with 30 slots, and first-time Ranked tier
 * rewards raise that to 50, the most a free-to-play player can have. The Starter Pack adds a
 * permanent 50 and an active membership adds 1,000. Every copy in the roster takes a slot,
 * expired trials included, until it's returned in-game.
 */
export const BOX_START_SLOTS = 30;
export const BOX_RANKED_SLOTS = 50;
export const STARTER_PACK_SLOTS = 50;
export const MEMBERSHIP_SLOTS = 1000;

export interface BoxSettings {
  freeToPlay: boolean;
  /** Has earned the Ranked tier box rewards (30 → 50). */
  rankedRewards: boolean;
  starterPack: boolean;
  membership: boolean;
}

export const DEFAULT_BOX: BoxSettings = { freeToPlay: true, rankedRewards: true, starterPack: false, membership: false };

export function boxCapacity(box: BoxSettings): number {
  const base = box.rankedRewards ? BOX_RANKED_SLOTS : BOX_START_SLOTS;
  if (box.freeToPlay) return base;
  return base + (box.starterPack ? STARTER_PACK_SLOTS : 0) + (box.membership ? MEMBERSHIP_SLOTS : 0);
}
