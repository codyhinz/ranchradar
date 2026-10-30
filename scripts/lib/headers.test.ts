import { fillHeaders, sentrySources, supabaseSources } from './headers';

describe('security headers', () => {
  const line = "connect-src 'self' {{SUPABASE}} {{SENTRY}}; worker-src 'self'";
  it('allows exactly this project’s Supabase origin', () => {
    expect(supabaseSources('https://abc123.supabase.co/')).toBe('https://abc123.supabase.co wss://abc123.supabase.co');
    expect(fillHeaders(line, { supabaseUrl: 'https://abc123.supabase.co' })).toBe("connect-src 'self' https://abc123.supabase.co wss://abc123.supabase.co; worker-src 'self'");
  });
  it('allows exactly this project’s Sentry ingest origin, never the key', () => {
    const dsn = 'https://publickey123@o4501.ingest.us.sentry.io/4502';
    expect(sentrySources(dsn)).toBe('https://o4501.ingest.us.sentry.io');
    expect(fillHeaders(line, { supabaseUrl: 'https://abc123.supabase.co', sentryDsn: dsn })).toBe(
      "connect-src 'self' https://abc123.supabase.co wss://abc123.supabase.co https://o4501.ingest.us.sentry.io; worker-src 'self'",
    );
  });
  it('drops the placeholders when the build has neither', () => {
    expect(fillHeaders(line)).toBe("connect-src 'self'; worker-src 'self'");
  });
  it('refuses plain-http origins', () => {
    expect(() => supabaseSources('http://abc123.supabase.co')).toThrow();
    expect(() => sentrySources('http://key@o1.ingest.sentry.io/2')).toThrow();
  });
});
