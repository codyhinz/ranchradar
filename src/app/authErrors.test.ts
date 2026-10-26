import { authErrorKey } from './authErrors';

describe('authErrorKey', () => {
  it('explains the common Supabase Auth errors', () => {
    expect(authErrorKey({ code: 'invalid_credentials' })).toBe('auth.error.credentials');
    expect(authErrorKey({ code: 'over_email_send_rate_limit' })).toBe('auth.error.emailLimit');
  });
  it('falls back for offline and unknown errors', () => {
    expect(authErrorKey(new TypeError('Failed to fetch'))).toBe('auth.error.offline');
    expect(authErrorKey({ code: 'something_new' })).toBe('auth.error.generic');
  });
});
