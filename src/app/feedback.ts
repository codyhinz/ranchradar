/**
 * Report a problem: an email or a GitHub issue, filled in with what helps to reproduce a bug
 * (build, language, browser, screen, installed or not). Nothing from the roster goes in.
 */
export const FEEDBACK_EMAIL = 'ranchradar.dev@gmail.com';
export const ISSUES_URL = 'https://github.com/codyhinz/ranchradar/issues/new';

export interface Diagnostics {
  version: string;
  language: string;
  browser: string;
  screen: string;
  installed: boolean;
}

export function currentDiagnostics(language: string): Diagnostics {
  return {
    version: __APP_VERSION__,
    language,
    browser: navigator.userAgent,
    screen: `${window.innerWidth}×${window.innerHeight}`,
    installed: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  };
}

function report(d: Diagnostics): string {
  return [
    'What happened?',
    '',
    '',
    'What did you expect?',
    '',
    '',
    '---',
    `Version: ${d.version}`,
    `Language: ${d.language}`,
    `Browser: ${d.browser}`,
    `Screen: ${d.screen}`,
    `Installed app: ${d.installed ? 'yes' : 'no'}`,
  ].join('\n');
}

export function feedbackEmailUrl(d: Diagnostics): string {
  const query = new URLSearchParams({ subject: 'RanchRadar problem report', body: report(d) });
  // mailto wants %20 for spaces; URLSearchParams writes +, which mail apps show literally.
  return `mailto:${FEEDBACK_EMAIL}?${query.toString().replace(/\+/g, '%20')}`;
}

export function feedbackIssueUrl(d: Diagnostics): string {
  return `${ISSUES_URL}?${new URLSearchParams({ title: '', body: report(d) }).toString()}`;
}
