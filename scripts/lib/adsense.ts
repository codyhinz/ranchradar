/**
 * Google AdSense settings, shared by the build (CSP, ads.txt, the account meta tag) and the app.
 *
 * VITE_ADSENSE_CLIENT (ca-pub-…) turns on everything AdSense needs to review the site: the
 * google-adsense-account meta tag, ads.txt, the CSP entries and the AdSense script. No ads show
 * until VITE_ADSENSE_SLOT (the numeric id of a display ad unit) is set too, so the client id can go
 * in as soon as the site is submitted for review and the slot once it's approved.
 */

const CLIENT = /^ca-pub-\d{10,20}$/;
const SLOT = /^\d{6,20}$/;

export function isAdClient(value: string | undefined | null): value is string {
  return typeof value === 'string' && CLIENT.test(value);
}

export function isAdSlot(value: string | undefined | null): value is string {
  return typeof value === 'string' && SLOT.test(value);
}

/** Throws on a value that's set but malformed, so a typo fails the build instead of silently showing nothing. */
export function checkAdSettings(client: string | undefined, slot: string | undefined): { client?: string; slot?: string } {
  if (client && !isAdClient(client)) throw new Error(`VITE_ADSENSE_CLIENT should look like ca-pub-1234567890123456, got: ${client}`);
  if (slot && !isAdSlot(slot)) throw new Error(`VITE_ADSENSE_SLOT should be the ad unit's numeric id, got: ${slot}`);
  if (slot && !client) throw new Error('VITE_ADSENSE_SLOT is set without VITE_ADSENSE_CLIENT');
  return { client: client || undefined, slot: slot || undefined };
}

/** ads.txt names Google as an authorized seller of this publisher's inventory. */
export function adsTxt(client: string): string {
  const publisher = client.replace(/^ca-/, '');
  return `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`;
}

export function adsenseScriptUrl(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
}

/**
 * What the AdSense script, its ad frames and Google's consent message (Privacy & messaging) load.
 * Ad creatives run inside their own frames, so only the loader, beacons and frames need listing here.
 * The consent message adds <style> elements, hence 'unsafe-inline' for styles (scripts stay strict),
 * and ad beacons are images from many hosts, hence any https image.
 */
export const ADSENSE_CSP: Record<string, string[]> = {
  'script-src': [
    'https://pagead2.googlesyndication.com',
    'https://tpc.googlesyndication.com',
    'https://*.adtrafficquality.google',
    'https://fundingchoicesmessages.google.com',
    'https://adservice.google.com',
    'https://www.google.com',
    'https://www.gstatic.com',
  ],
  'style-src': ["'unsafe-inline'"],
  'img-src': ['https:'],
  'connect-src': [
    'https://pagead2.googlesyndication.com',
    'https://*.googlesyndication.com',
    'https://*.doubleclick.net',
    'https://*.adtrafficquality.google',
    'https://fundingchoicesmessages.google.com',
    'https://adservice.google.com',
    'https://www.google.com',
  ],
  'frame-src': [
    'https://*.googlesyndication.com',
    'https://*.doubleclick.net',
    'https://*.adtrafficquality.google',
    'https://fundingchoicesmessages.google.com',
    'https://www.google.com',
  ],
};
