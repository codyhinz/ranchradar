/**
 * Push notifications on this device: whether they can work here, and turning them on and off.
 * A subscription belongs to the signed-in account (save_push_subscription takes over a shared
 * browser), and signing out removes it, so a signed-out device never gets someone's reminders.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export type PushSupport =
  | 'off-in-build'  // no VAPID key in this build
  | 'unsupported'   // this browser has no Web Push
  | 'needs-install' // iPhone or iPad: works only from the Home Screen app
  | 'blocked'       // the person (or the browser) said no to notifications
  | 'ready';

export function pushConfigured(): boolean {
  return Boolean(vapidKey);
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (!vapidKey) return 'off-in-build';
  // Safari on iPhone only offers push to Home Screen apps, and hides PushManager elsewhere.
  if (isAppleMobile() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ready';
}

export class PushError extends Error {
  constructor(readonly code: 'denied' | 'no-worker' | 'unsupported') { super(code); }
}

function keyBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((byte, i) => byte === b[i]);
}

/** The installed service worker, or null if none is running (the dev server, a blocked install). */
async function registration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function save(client: SupabaseClient, sub: PushSubscription, locale: string): Promise<void> {
  const json = sub.toJSON();
  const { error } = await client.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh ?? '', p_auth: json.keys?.auth ?? '', p_locale: locale,
  });
  if (error) throw error;
}

/** Asks for permission (only ever from a tap), subscribes and saves this device to the account. */
export async function enablePush(client: SupabaseClient, locale: string): Promise<void> {
  if (pushSupport() !== 'ready' || !vapidKey) throw new PushError('unsupported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushError('denied');
  const reg = await registration();
  if (!reg) throw new PushError('no-worker');
  const key = keyBytes(vapidKey);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older key can't receive anything signed with the new one.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
  await save(client, sub, locale);
}

/** Turns notifications off on this device: removes it from the account, then from the browser. */
export async function disablePush(client: SupabaseClient | null): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  if (client) await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe().catch(() => undefined);
}

/**
 * On sign-in and app start: keeps the account's copy current (language, a browser that renewed its
 * subscription, or another account that used this browser since). Silent when push is off here.
 */
export async function refreshPush(client: SupabaseClient, locale: string): Promise<boolean> {
  const sub = await currentSubscription().catch(() => null);
  if (!sub || !vapidKey) return false;
  if (!sameKey(sub.options.applicationServerKey, keyBytes(vapidKey))) {
    await sub.unsubscribe().catch(() => undefined);
    return false;
  }
  await save(client, sub, locale);
  return true;
}
