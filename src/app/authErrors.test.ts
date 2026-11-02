import { authErrorKey } from './authErrors';
import { CaptchaError } from './turnstile';

describe('authErrorKey', () => {
  it('explains the common Supabase Auth errors', () => {
    expect(authErrorKey({ code: 'invalid_credentials' })).toBe('auth.error.credentials');
    expect(authErrorKey({ code: 'over_email_send_rate_limit' })).toBe('auth.error.emailLimit');
  });
  it('explains a failed bot check, from Supabase or from the widget', () => {
    expect(authErrorKey({ code: 'captcha_failed' })).toBe('auth.error.captcha');
    expect(authErrorKey(new CaptchaError())).toBe('auth.error.captcha');
  });
  it('falls back for offline and unknown errors', () => {
    expect(authErrorKey(new TypeError('Failed to fetch'))).toBe('auth.error.offline');
    expect(authErrorKey({ code: 'something_new' })).toBe('auth.error.generic');
  });
});
