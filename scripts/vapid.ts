/**
 * Generates the VAPID key pair push services use to know reminders really come from RanchRadar.
 * Run once: `npm run vapid`. The public key goes in Cloudflare (VITE_VAPID_PUBLIC_KEY) and in
 * Supabase (VAPID_PUBLIC_KEY); the private key only in Supabase (VAPID_PRIVATE_KEY). Generating
 * new keys later means every device has to turn notifications on again.
 */
import { b64urlEncode } from '../supabase/functions/_shared/webpush';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
console.log('\nKeep the private key secret: it goes only into Supabase → Edge Functions → Secrets.');
