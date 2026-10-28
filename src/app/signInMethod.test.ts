import { sessionMethod, signInMethod } from './signInMethod';

const linkedAll = {
  app_metadata: { provider: 'email' },
  identities: [{ provider: 'email' }, { provider: 'google' }, { provider: 'discord' }],
};

const token = (amr: unknown) => `h.${btoa(JSON.stringify({ amr })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`;

describe('sessionMethod', () => {
  it('reads the newest amr entry from the access token', () => {
    expect(sessionMethod(token([{ method: 'oauth', timestamp: 2 }, { method: 'password', timestamp: 1 }]))).toBe('oauth');
    expect(sessionMethod(token(['password']))).toBe('password');
  });

  it('returns null for anything it cannot read', () => {
    expect(sessionMethod(undefined)).toBeNull();
    expect(sessionMethod('not-a-jwt')).toBeNull();
    expect(sessionMethod(token([]))).toBeNull();
  });
});

describe('signInMethod', () => {
  it('says email for a password sign-in, even with Google and Discord linked', () => {
    expect(signInMethod(linkedAll, 'password', 'discord')).toBe('email');
  });

  it('names the provider button that was tapped', () => {
    expect(signInMethod(linkedAll, 'oauth', 'google')).toBe('google');
    expect(signInMethod(linkedAll, 'oauth', 'discord')).toBe('discord');
  });

  it('ignores a remembered choice the account has no login for', () => {
    expect(signInMethod({ identities: [{ provider: 'google' }] }, 'oauth', 'discord')).toBe('google');
  });

  it('falls back to the account’s first provider without a remembered choice', () => {
    expect(signInMethod({ app_metadata: { provider: 'google' } }, null, null)).toBe('google');
    expect(signInMethod({ app_metadata: { provider: 'github' } }, null, null)).toBe('email');
  });
});
