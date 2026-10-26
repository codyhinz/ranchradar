import { fillHeaders, supabaseSources } from './headers';

describe('security headers', () => {
  const line = "connect-src 'self' {{SUPABASE}}; worker-src 'self'";
  it('allows exactly this project’s Supabase origin', () => {
    expect(supabaseSources('https://abc123.supabase.co/')).toBe('https://abc123.supabase.co wss://abc123.supabase.co');
    expect(fillHeaders(line, 'https://abc123.supabase.co')).toBe("connect-src 'self' https://abc123.supabase.co wss://abc123.supabase.co; worker-src 'self'");
  });
  it('drops the placeholder when the build has no Supabase settings', () => {
    expect(fillHeaders(line, undefined)).toBe("connect-src 'self'; worker-src 'self'");
  });
  it('refuses a plain-http project URL', () => {
    expect(() => supabaseSources('http://abc123.supabase.co')).toThrow();
  });
});
