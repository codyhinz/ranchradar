import { tabFromHash } from './tabs';

describe('tabFromHash', () => {
  it('opens the tab named in the hash', () => {
    expect(tabFromHash('#teams', ['roster', 'teams'])).toBe('teams');
  });

  it('falls back to the roster for no hash or an unknown one', () => {
    expect(tabFromHash('')).toBe('roster');
    expect(tabFromHash('#nope', ['roster', 'teams'])).toBe('roster');
  });
});
