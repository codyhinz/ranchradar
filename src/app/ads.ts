/**
 * Google AdSense. Builds without VITE_ADSENSE_CLIENT never load it. With the client id alone, the
 * script loads after first paint (AdSense's review looks for it, and it brings Google's consent
 * message for EEA, UK and Swiss visitors) but no ad units render. VITE_ADSENSE_SLOT turns the
 * units on. Ads never sit in search results or sheets, so the quick check stays clear.
 */
import { adsenseScriptUrl, isAdClient, isAdSlot } from '../../scripts/lib/adsense';

const client = import.meta.env.VITE_ADSENSE_CLIENT;
const slot = import.meta.env.VITE_ADSENSE_SLOT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    googlefc?: { showRevocationMessage?: () => void; callbackQueue?: unknown[] };
  }
}

/** The AdSense script and consent message are on in this build. */
export function adsEnabled(): boolean {
  return isAdClient(client);
}

/** Ad units render in this build. */
export function adUnitsEnabled(): boolean {
  return isAdClient(client) && isAdSlot(slot);
}

let loading: Promise<void> | null = null;

/** Adds the AdSense script once. Resolves when it has loaded; rejects if it's blocked. */
export function loadAdSense(): Promise<void> {
  if (!isAdClient(client)) return Promise.reject(new Error('AdSense is off in this build'));
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = adsenseScriptUrl(client);
    script.onload = () => resolve();
    script.onerror = () => { loading = null; reject(new Error('AdSense was blocked')); };
    document.head.append(script);
  });
  return loading;
}

/** Loads the script when the browser is idle, so it never competes with the first paint. */
export function startAds(): void {
  if (!adsEnabled()) return;
  const go = () => void loadAdSense().catch(() => undefined); // blocked by an ad blocker: nothing else changes
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
}

/** Builds an <ins> ad unit for the configured slot. */
export function createAdUnit(): HTMLModElement {
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.display = 'block';
  ins.dataset.adClient = client!;
  ins.dataset.adSlot = slot!;
  ins.dataset.adFormat = 'auto';
  ins.dataset.fullWidthResponsive = 'true';
  return ins;
}

/** Asks AdSense to fill one unit. Safe to call twice for the same unit (React's dev double effects). */
export async function fillAdUnit(ins: HTMLElement): Promise<void> {
  if (ins.dataset.ranchFilled) return;
  ins.dataset.ranchFilled = 'true';
  try {
    await loadAdSense();
    (window.adsbygoogle ??= []).push({});
  } catch {
    // Blocked or offline: the slot stays collapsed.
  }
}

/**
 * "Ad privacy choices": reopens Google's consent message where it runs (EEA, UK, Switzerland),
 * otherwise opens Google's ad settings, where anyone can turn off personalized ads.
 */
export function openAdChoices(): void {
  const revoke = window.googlefc?.showRevocationMessage;
  if (typeof revoke === 'function') revoke.call(window.googlefc);
  else window.open('https://adssettings.google.com/', '_blank', 'noopener,noreferrer');
}

/**
 * Static pages (about, regulations, privacy): fills each <aside data-ad hidden> placeholder and
 * shows each [data-ad-choices] link. Without the settings they stay hidden and empty.
 */
export function mountStaticAds(): void {
  if (!adsEnabled()) return;
  for (const choices of Array.from(document.querySelectorAll<HTMLElement>('[data-ad-choices]'))) {
    choices.hidden = false;
    choices.querySelector('button')?.addEventListener('click', openAdChoices);
  }
  startAds();
  if (!adUnitsEnabled()) return;
  for (const holder of Array.from(document.querySelectorAll<HTMLElement>('[data-ad]'))) {
    const label = document.createElement('span');
    label.className = 'ad-label';
    label.textContent = 'Advertisement';
    const ins = createAdUnit();
    holder.replaceChildren(label, ins);
    holder.hidden = false;
    void fillAdUnit(ins);
  }
}
