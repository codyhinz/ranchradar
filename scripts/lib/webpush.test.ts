import { b64urlDecode, b64urlEncode, encryptPayload, isPushEndpoint, sendPush, vapidAuthorization, type VapidKeys } from '../../supabase/functions/_shared/webpush';
import { buildNotifications, relativeTime } from '../../supabase/functions/_shared/messages';

const enc = new TextEncoder();

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** The browser's side of RFC 8291, written separately from the sender so the two check each other. */
async function decrypt(body: Uint8Array, ua: CryptoKeyPair, authSecret: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const idLength = body[20]!;
  const asPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, secret, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));
  expect(plain[plain.length - 1]).toBe(2); // last-record delimiter
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function browserSubscription() {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey)));
  return { ua, authSecret, keys: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh, auth: b64urlEncode(authSecret) } };
}

async function vapidKeys(): Promise<{ keys: VapidKeys; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { keys: { publicKey: b64urlEncode(raw), privateKey: jwk.d!, subject: 'mailto:test@example.com' }, publicKey: pair.publicKey };
}

describe('web push encryption', () => {
  it('produces a message the browser can decrypt', async () => {
    const { ua, authSecret, keys } = await browserSubscription();
    const body = await encryptPayload(enc.encode('{"title":"Ranch"}'), keys);
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(await decrypt(body, ua, authSecret)).toBe('{"title":"Ranch"}');
  });
  it('rejects malformed keys', async () => {
    await expect(encryptPayload(enc.encode('x'), { p256dh: 'abc', auth: 'abc' })).rejects.toThrow();
  });
  it('round-trips base64url', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(33));
    expect(b64urlDecode(b64urlEncode(bytes))).toEqual(bytes);
  });
});

describe('VAPID', () => {
  it('signs a JWT for the push service origin', async () => {
    const { keys, publicKey } = await vapidKeys();
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, Date.UTC(2026, 10, 3));
    const match = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(match[4]).toBe(keys.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(match[2]!)));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: Date.UTC(2026, 10, 3) / 1000 + 43200, sub: 'mailto:test@example.com' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, b64urlDecode(match[3]!), enc.encode(`${match[1]}.${match[2]}`));
    expect(ok).toBe(true);
  });
});

describe('sending', () => {
  it('only calls the browsers’ push services', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/x')).toBe(true);
    expect(isPushEndpoint('https://wns2-by3p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(isPushEndpoint('https://evilpush.apple.com.example/x')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
  });
  it('maps push service answers and sets the protocol headers', async () => {
    const { keys: sub } = await browserSubscription();
    const { keys } = await vapidKeys();
    const calls: RequestInit[] = [];
    const answer = (status: number) => (async (_url: unknown, init?: RequestInit) => { calls.push(init!); return new Response(null, { status }); }) as typeof fetch;
    const message = { payload: { title: 'x' }, ttlSeconds: 3600, topic: 'ranch-refresh' };
    expect(await sendPush(sub, message, keys, answer(201))).toBe('sent');
    expect(await sendPush(sub, message, keys, answer(410))).toBe('gone');
    expect(await sendPush(sub, message, keys, answer(404))).toBe('gone');
    expect(await sendPush(sub, message, keys, answer(429))).toBe('retry');
    expect(await sendPush(sub, message, keys, answer(400))).toBe('failed');
    expect(await sendPush({ ...sub, endpoint: 'https://evil.example/x' }, message, keys, answer(201))).toBe('refused');
    const headers = calls[0]!.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers.TTL).toBe('3600');
    expect(headers.Topic).toBe('ranch-refresh');
    expect(calls).toHaveLength(5);
  });
});

describe('notification text', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const trial = (form: string, name: string, hours: number) => ({
    id: form, kind: 'trial_expiry' as const, form_id: form,
    trial_expires_at: new Date(now.getTime() + hours * 3_600_000).toISOString(), names: { en: name, ja: `${name}JA` },
  });
  it('names one trial and says when it ends', () => {
    const [note] = buildNotifications([trial('garchomp', 'Garchomp', 24)], 'en', now);
    expect(note!.title).toBe('Garchomp’s trial is ending');
    expect(note!.body).toBe('It ends in 24 hours. Recruit it permanently or return it to the Ranch.');
  });
  it('groups several trials and the ranch refresh separately', () => {
    const notes = buildNotifications([{ id: 'r', kind: 'ranch_refresh', form_id: null, trial_expires_at: null, names: null }, trial('a', 'Garchomp', 20), trial('b', 'Torkoal', 22)], 'ja', now);
    expect(notes.map((n) => n.tag)).toEqual(['ranch-refresh', 'trials']);
    expect(notes[1]!.body).toContain('GarchompJA、TorkoalJA');
  });
  it('falls back to English for an unknown language', () => {
    expect(buildNotifications([trial('a', 'Garchomp', 2)], 'xx', now)[0]!.title).toBe('Garchomp’s trial is ending');
  });
  it('rounds to days past a day and a half', () => {
    expect(relativeTime(new Date(now.getTime() + 48 * 3_600_000), now, 'en')).toBe('in 2 days');
  });
});
