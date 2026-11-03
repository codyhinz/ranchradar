// send-reminders: called every minute by pg_cron while a reminder is due (see the reminders
// migration). Claims what's due, sends one notification per kind to each of the account's
// devices, and deletes subscriptions the push service says are gone.
//
// Secrets (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT and REMINDERS_CRON_SECRET. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase. JWT checking is off for this function (config.toml); the shared secret
// in x-cron-secret is what lets a request in.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { sendPush, type PushResult, type VapidKeys } from '../_shared/webpush.ts';
import { buildNotifications, type DueReminder } from '../_shared/messages.ts';

interface Subscription { id: string; endpoint: string; p256dh: string; auth: string; locale: string }
interface Account { user_id: string; reminders: DueReminder[]; subscriptions: Subscription[] }

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing secret ${name}`);
  return value;
}

/** Constant-time comparison, so the secret can't be guessed a character at a time. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !sameSecret(req.headers.get('x-cron-secret') ?? '', env('REMINDERS_CRON_SECRET'))) {
    return new Response('not found', { status: 404 });
  }
  const keys: VapidKeys = { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') };
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  const { data, error } = await db.rpc('claim_due_reminders', { p_limit: 500 });
  if (error) {
    console.error('claim_due_reminders failed', error.message);
    return new Response('claim failed', { status: 500 });
  }
  const accounts = (data ?? []) as Account[];
  const counts: Record<PushResult, number> = { sent: 0, gone: 0, retry: 0, failed: 0, refused: 0 };
  const gone: string[] = [];
  const now = new Date();

  await Promise.all(accounts.flatMap((account) => account.subscriptions.map(async (sub) => {
    for (const note of buildNotifications(account.reminders, sub.locale, now)) {
      let result: PushResult;
      try {
        result = await sendPush(sub, {
          payload: { title: note.title, body: note.body, tag: note.tag, url: note.url },
          // A ranch refresh is stale after a few hours; a trial warning is useful until the trial ends.
          ttlSeconds: note.kind === 'ranch_refresh' ? 4 * 3600 : 24 * 3600,
          topic: note.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
          urgency: 'normal',
        }, keys);
      } catch (err) {
        console.error('push failed', err instanceof Error ? err.message : String(err));
        result = 'failed';
      }
      counts[result]++;
      if (result === 'gone' || result === 'refused') { gone.push(sub.id); break; }
    }
  })));

  if (gone.length) {
    const { error: dropError } = await db.rpc('drop_push_subscriptions', { p_ids: [...new Set(gone)] });
    if (dropError) console.error('drop_push_subscriptions failed', dropError.message);
  }
  console.log(JSON.stringify({ accounts: accounts.length, ...counts }));
  return Response.json({ accounts: accounts.length, ...counts });
});
