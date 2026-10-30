import { feedbackEmailUrl, feedbackIssueUrl, type Diagnostics } from './feedback';
import { scrubBreadcrumb, scrubEvent, scrubUrl } from './errorTracking';

const d: Diagnostics = { version: 'abc1234', language: 'ja', browser: 'TestBrowser/1.0', screen: '390×844', installed: true };

describe('report a problem', () => {
  it('fills the email with the build and device, with spaces as %20', () => {
    const url = feedbackEmailUrl(d);
    expect(url.startsWith('mailto:ranchradar.dev@gmail.com?subject=RanchRadar%20problem%20report')).toBe(true);
    expect(url).not.toContain('+');
    const body = decodeURIComponent(url.split('body=')[1] ?? '');
    expect(body).toContain('Version: abc1234');
    expect(body).toContain('Installed app: yes');
  });
  it('opens a prefilled GitHub issue', () => {
    const url = new URL(feedbackIssueUrl(d));
    expect(url.origin + url.pathname).toBe('https://github.com/codyhinz/ranchradar/issues/new');
    expect(url.searchParams.get('body')).toContain('Language: ja');
  });
});

describe('error reports', () => {
  it('drops tokens in query strings and hashes', () => {
    expect(scrubUrl('https://ranchradar.dev/#access_token=secret&type=recovery')).toBe('https://ranchradar.dev/');
    expect(scrubUrl('https://x.supabase.co/rest/v1/roster?user_id=eq.123')).toBe('https://x.supabase.co/rest/v1/roster');
  });
  it('strips the user, query and referer from events', () => {
    const event = scrubEvent({
      type: undefined,
      user: { ip_address: '1.2.3.4' },
      request: { url: 'https://ranchradar.dev/?code=abc', query_string: 'code=abc', headers: { Referer: 'https://ranchradar.dev/#token', 'User-Agent': 'x' } },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://ranchradar.dev/', headers: { 'User-Agent': 'x' } });
  });
  it('drops console breadcrumbs and scrubs navigation and fetch URLs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'note text' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/', to: '/#access_token=s' } })?.data).toEqual({ from: '/', to: '/' });
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x.supabase.co/a?b=c', status_code: 200 } })?.data).toEqual({ url: 'https://x.supabase.co/a', status_code: 200 });
  });
});
