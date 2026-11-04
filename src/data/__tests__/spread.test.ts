import { battleStats, compactSpread, isValidSpread, readSpread, roomFor, sameSpread, spreadTotal, EMPTY_SPREAD } from '../spread';

const GARCHOMP = [108, 130, 95, 80, 85, 102];
const sp = (over: Partial<typeof EMPTY_SPREAD>) => ({ ...EMPTY_SPREAD, ...over });

describe('reading a spread', () => {
  it('returns the canonical form, whatever order the keys came in', () => {
    const read = readSpread({ spe: 32, atk: 32, hp: 2 });
    expect(read).toEqual(sp({ hp: 2, atk: 32, spe: 32 }));
    expect(Object.keys(read!)).toEqual(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
  });

  it('turns no points into null and anything unreadable into null', () => {
    expect(readSpread(EMPTY_SPREAD)).toBeNull();
    expect(readSpread(null)).toBeNull();
    expect(readSpread([2, 32, 0, 0, 0, 32])).toBeNull();
    expect(readSpread({ hp: 252, atk: 252 })).toBeNull(); // EVs, not stat points
    expect(readSpread({ hp: 32, atk: 32, def: 32 })).toBeNull(); // 96 in all
    expect(readSpread({ hp: 2.5 })).toBeNull();
    expect(readSpread({ hp: '2' })).toBeNull();
    expect(readSpread({ hp: 2, speed: 32 })).toBeNull();
  });

  it('only calls canonical spreads within the caps valid', () => {
    expect(isValidSpread(sp({ hp: 2, atk: 32, spe: 32 }))).toBe(true);
    expect(isValidSpread({ spe: 32, atk: 32, hp: 2, def: 0, spa: 0, spd: 0 })).toBe(false);
    expect(isValidSpread(EMPTY_SPREAD)).toBe(false);
  });

  it('compacts six zeros to null and compares null and zeros alike', () => {
    expect(compactSpread(EMPTY_SPREAD)).toBeNull();
    expect(compactSpread(sp({ def: 4 }))).toEqual(sp({ def: 4 }));
    expect(sameSpread(null, EMPTY_SPREAD)).toBe(true);
    expect(sameSpread(null, sp({ hp: 1 }))).toBe(false);
  });
});

describe('room left', () => {
  it('stops at 32 in a stat and 66 in all', () => {
    expect(roomFor(EMPTY_SPREAD, 'atk')).toBe(32);
    expect(roomFor(sp({ atk: 30 }), 'atk')).toBe(2);
    expect(roomFor(sp({ atk: 32, spe: 32 }), 'hp')).toBe(2);
    expect(spreadTotal(sp({ atk: 32, spe: 32, hp: 2 }))).toBe(66);
    expect(roomFor(sp({ atk: 32, spe: 32, hp: 2 }), 'def')).toBe(0);
  });
});

describe('Level 50 stats', () => {
  it('matches the familiar 252/252 numbers for a 32/32 spread', () => {
    // Same as a Jolly 252 Atk / 252 Spe Garchomp in the main games: 182 Atk, 169 Spe
    const stats = battleStats(GARCHOMP, sp({ hp: 2, atk: 32, spe: 32 }), 'jolly');
    expect(stats).toEqual({ hp: 185, atk: 182, def: 115, spa: 90, spd: 105, spe: 169 });
  });

  it('applies the nature to the stats it touches only', () => {
    const neutral = battleStats(GARCHOMP, null, null);
    expect(neutral).toEqual({ hp: 183, atk: 150, def: 115, spa: 100, spd: 105, spe: 122 });
    const adamant = battleStats(GARCHOMP, null, 'adamant');
    expect(adamant.atk).toBe(165); // floor(150 × 1.1)
    expect(adamant.spa).toBe(90); // 100 × 0.9
  });

  it('keeps Shedinja at 1 HP', () => {
    expect(battleStats([1, 90, 45, 30, 30, 40], sp({ hp: 32 }), null).hp).toBe(1);
  });
});
