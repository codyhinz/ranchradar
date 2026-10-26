import type { MessageKey } from '../i18n';

/** Supabase Auth error codes we explain in plain words; anything else gets the generic line. */
const KNOWN: Record<string, MessageKey> = {
  invalid_credentials: 'auth.error.credentials',
  email_not_confirmed: 'auth.error.unconfirmed',
  user_already_exists: 'auth.error.exists',
  email_exists: 'auth.error.exists',
  weak_password: 'auth.error.weak',
  same_password: 'auth.error.samePassword',
  email_address_invalid: 'auth.error.email',
  validation_failed: 'auth.error.email',
  over_email_send_rate_limit: 'auth.error.emailLimit',
  over_request_rate_limit: 'auth.error.rateLimit',
  signup_disabled: 'auth.error.signupOff',
  email_provider_disabled: 'auth.error.signupOff',
  provider_disabled: 'auth.error.provider',
};

export function authErrorKey(error: unknown): MessageKey {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (KNOWN[code]) return KNOWN[code]!;
  if (error instanceof TypeError || (error instanceof Error && /fetch|network/i.test(error.message))) return 'auth.error.offline';
  return 'auth.error.generic';
}
