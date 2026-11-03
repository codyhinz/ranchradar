import { addCspSources, fillHeaders, sentrySources, supabaseSources } from './headers';

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

describe('AdSense in the CSP', () => {
  const template = "/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' {{SUPABASE}}; frame-ancestors 'none'\n  X-Frame-Options: DENY";
  it('leaves the policy strict until a client id is set', () => {
    expect(fillHeaders(template)).not.toContain('googlesyndication');
    expect(fillHeaders(template, { adsenseClient: 'not-a-client' })).not.toContain('googlesyndication');
  });
  it('adds AdSense and the consent message to the right directives', () => {
    const out = fillHeaders(template, { adsenseClient: 'ca-pub-1234567890123456' });
    const policy = out.split('\n')[1]!;
    expect(policy).toMatch(/script-src 'self' https:\/\/pagead2\.googlesyndication\.com /);
    expect(policy).toMatch(/frame-src https:\/\/\*\.googlesyndication\.com /);
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(out).toContain('X-Frame-Options: DENY');
  });
  it('never repeats a source', () => {
    expect(addCspSources("  Content-Security-Policy: img-src 'self' https:", { 'img-src': ['https:'] })).toBe("  Content-Security-Policy: img-src 'self' https:");
  });
});
