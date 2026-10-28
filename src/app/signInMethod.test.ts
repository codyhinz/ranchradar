import { signInMethod } from './signInMethod';

describe('signInMethod', () => {
  it('names the linked login used most recently, not the first one', () => {
    expect(signInMethod({
      app_metadata: { provider: 'email' },
      identities: [
        { provider: 'email', last_sign_in_at: '2026-10-27T10:00:00Z' },
        { provider: 'discord', last_sign_in_at: '2026-10-28T18:00:00Z' },
      ],
    })).toBe('discord');
  });

  it('falls back to the account’s first provider when identities are missing', () => {
    expect(signInMethod({ app_metadata: { provider: 'google' } })).toBe('google');
    expect(signInMethod({ app_metadata: { provider: 'google' }, identities: [] })).toBe('google');
  });

  it('treats anything unknown as email', () => {
    expect(signInMethod({ app_metadata: { provider: 'github' }, identities: [{ provider: 'github', last_sign_in_at: '2026-10-28T18:00:00Z' }] })).toBe('email');
  });
});
