/**
 * Web Push with nothing but WebCrypto, so the same code runs in the Edge Function (Deno) and in
 * the tests (Node): message encryption from RFC 8291 (aes128gcm, RFC 8188) and VAPID sender
 * identification from RFC 8292. No dependency means nothing to pin or audit.
 */

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/**
 * The browsers' push services. Anything else is refused before a request is made, so a stored
 * endpoint can never point the server at an address of someone's choosing.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && !url.username && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // the browser's public key, base64url
  auth: string;   // the browser's auth secret, base64url
}

/** Encrypts one message for one subscription (RFC 8291 §3). `salt` and `senderKeys` are for tests. */
export async function encryptPayload(
  payload: Uint8Array,
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  testing?: { salt: Uint8Array; senderKeys: CryptoKeyPair },
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(subscription.p256dh);
  const authSecret = b64urlDecode(subscription.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('bad p256dh key');
  if (authSecret.length !== 16) throw new Error('bad auth secret');

  const senderKeys = testing?.senderKeys
    ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderKeys.privateKey, 256));

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = testing?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // One record: the message, then the 0x02 delimiter that marks the last record.
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export interface VapidKeys {
  publicKey: string;  // uncompressed P-256 point, base64url (the same value the app subscribes with)
  privateKey: string; // the private scalar d, base64url
  subject: string;    // mailto: or https: contact for push services
}

async function vapidSigningKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = b64urlDecode(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('bad VAPID public key');
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', d: keys.privateKey,
    x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: false,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** The Authorization header for one push service (RFC 8292 §2–3), valid for 12 hours. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: keys.subject,
  })));
  const signingInput = `${header}.${claims}`;
  // WebCrypto's ECDSA signature is already r || s, the form JWS uses.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidSigningKey(keys), enc.encode(signingInput)));
  return `vapid t=${signingInput}.${b64urlEncode(signature)}, k=${keys.publicKey}`;
}

export type PushResult = 'sent' | 'gone' | 'retry' | 'failed' | 'refused';

export interface PushMessage {
  payload: unknown;     // sent as JSON
  ttlSeconds: number;   // how long the push service holds it for an offline device
  topic?: string;       // a newer message with the same topic replaces an undelivered older one
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

/** Sends one notification. 'gone' means the subscription no longer exists and should be deleted. */
export async function sendPush(
  subscription: PushSubscriptionKeys,
  message: PushMessage,
  keys: VapidKeys,
  fetcher: typeof fetch = fetch,
): Promise<PushResult> {
  if (!isPushEndpoint(subscription.endpoint)) return 'refused';
  const body = await encryptPayload(enc.encode(JSON.stringify(message.payload)), subscription);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(subscription.endpoint, keys),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(Math.max(0, Math.round(message.ttlSeconds))),
    Urgency: message.urgency ?? 'normal',
  };
  if (message.topic) headers.Topic = message.topic;
  const response = await fetcher(subscription.endpoint, { method: 'POST', headers, body, redirect: 'manual' });
  await response.body?.cancel();
  if (response.status >= 200 && response.status < 300) return 'sent';
  if (response.status === 404 || response.status === 410) return 'gone';
  if (response.status === 429 || response.status >= 500) return 'retry';
  return 'failed';
}
