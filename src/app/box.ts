/**
 * Pokémon Champions box space. Every player starts with 30 slots; reaching the Great, Ultra
 * and Master Ball tiers in Ranked Battles adds 5, 5 and 10 (50 for a fully free player), the
 * Starter Pack adds 50, and an active membership adds 1,000.
 * Every copy in the roster takes a slot, expired trials included, until it's returned in-game.
 */
export const BOX_BASE_SLOTS = 30;

export const BOX_UNLOCKS = [
  { id: 'great', slots: 5 },
  { id: 'ultra', slots: 5 },
  { id: 'master', slots: 10 },
  { id: 'starter', slots: 50 },
  { id: 'membership', slots: 1000 },
] as const;
export type BoxUnlock = (typeof BOX_UNLOCKS)[number]['id'];

export function boxCapacity(unlocks: readonly BoxUnlock[]): number {
  return BOX_UNLOCKS.reduce((sum, unlock) => sum + (unlocks.includes(unlock.id) ? unlock.slots : 0), BOX_BASE_SLOTS);
}
