-- Reminders: a push when the Roster Ranch refreshes, and before a trial ends.
--
-- Ranch refresh reminders are set by the user ("I just recruited", or the time left after a Quick
-- Coupon). Trial reminders are never written by the app: a trigger keeps one per live trial, at
-- the lead time the user picked (1 day before by default). A Supabase Edge Function,
-- send-reminders, is called every minute by pg_cron while something is due, claims what's due and
-- sends it to every push subscription the account has.

-- ---------------------------------------------------------------------------
-- 1. Settings and subscription details
-- ---------------------------------------------------------------------------

-- Minutes before a trial ends to remind; null turns trial reminders off. Account-wide.
alter table public.profiles
  add column trial_reminder_minutes integer default 1440
    check (trial_reminder_minutes is null or trial_reminder_minutes in (60, 360, 1440, 2880));
grant update (trial_reminder_minutes) on public.profiles to authenticated;

-- The language this device shows RanchRadar in, so its notifications match.
alter table public.push_subscriptions
  add column locale     text not null default 'en' check (char_length(locale) between 1 and 16),
  add column updated_at timestamptz not null default now();

-- Only the browsers' real push services. The sender checks this again before every request, so
-- a row can never make the server call an address of the user's choosing.
create or replace function app.is_push_endpoint(endpoint text) returns boolean
language sql immutable set search_path = '' as $$
  select endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
$$;
alter table public.push_subscriptions
  add constraint push_subscriptions_known_service check (app.is_push_endpoint(endpoint)) not valid;

-- A browser has one endpoint. Whoever is signed in on it now owns it, so the next account to sign
-- in on a shared device takes over its notifications instead of failing on the unique endpoint.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_locale text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale)
    values (uid, p_endpoint, p_p256dh, p_auth, coalesce(nullif(p_locale, ''), 'en'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        locale = excluded.locale, updated_at = now();
end $$;
revoke all on function public.save_push_subscription(text, text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Who can write reminders
-- ---------------------------------------------------------------------------

-- Users see their reminders, set their own ranch refresh (within the 22-hour window), and can
-- remove unsent ones. Trial reminders and sent_at are the server's.
drop policy own_all on public.reminders;
revoke all on public.reminders from authenticated;
grant select, insert, delete on public.reminders to authenticated;
create policy own_select on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_insert on public.reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'ranch_refresh' and sent_at is null
              and fire_at > now() and fire_at <= now() + interval '22 hours 5 minutes');
create policy own_delete on public.reminders for delete to authenticated
  using (user_id = (select auth.uid()) and sent_at is null);

-- Only ranch refreshes count toward the 500-row cap; trial reminders follow the roster's own cap,
-- and a full table must never stop a trial from syncing.
drop trigger cap on public.reminders;
create trigger cap before insert on public.reminders
  for each row when (new.kind = 'ranch_refresh') execute function app.enforce_plain_cap('500');

-- One ranch refresh at a time: setting a new one replaces the old. Returns when it fires.
create or replace function public.set_ranch_reminder(p_fire_at timestamptz) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.reminders
    where user_id = auth.uid() and kind = 'ranch_refresh' and sent_at is null;
  insert into public.reminders (user_id, kind, fire_at) values (auth.uid(), 'ranch_refresh', p_fire_at);
  return p_fire_at;
end $$;
revoke all on function public.set_ranch_reminder(timestamptz) from public;
grant execute on function public.set_ranch_reminder(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trial reminders follow the roster
-- ---------------------------------------------------------------------------

-- (Re)schedules the reminder for one entry. Nothing is set for a trial that ends sooner than the
-- lead time (it was just added with little time left), and a reminder already sent for this exact
-- time isn't repeated when the row syncs again.
create or replace function app.schedule_trial_reminder(e public.roster_entries) returns void
language plpgsql security definer set search_path = '' as $$
declare
  lead_minutes integer;
  fire timestamptz;
begin
  delete from public.reminders where roster_entry_id = e.id and sent_at is null;
  if e.user_id is null or e.deleted_at is not null or e.status <> 'trial' or e.trial_expires_at is null then
    return;
  end if;
  select trial_reminder_minutes into lead_minutes from public.profiles where user_id = e.user_id;
  if lead_minutes is null then
    return;
  end if;
  fire := e.trial_expires_at - make_interval(mins => lead_minutes);
  if fire <= now() then
    return;
  end if;
  if exists (select 1 from public.reminders where roster_entry_id = e.id and fire_at = fire) then
    return;
  end if;
  insert into public.reminders (user_id, kind, fire_at, roster_entry_id)
    values (e.user_id, 'trial_expiry', fire, e.id);
end $$;

create or replace function app.roster_trial_reminder() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and old.status is not distinct from new.status
     and old.trial_expires_at is not distinct from new.trial_expires_at
     and old.deleted_at is not distinct from new.deleted_at then
    return new;  -- notes, nature and the rest don't move the reminder
  end if;
  perform app.schedule_trial_reminder(new);
  return new;
end $$;

create trigger trial_reminder after insert or update on public.roster_entries
  for each row execute function app.roster_trial_reminder();

-- Changing the lead time reschedules every live trial on the account.
create or replace function app.profile_trial_reminders() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e public.roster_entries;
begin
  if old.trial_reminder_minutes is not distinct from new.trial_reminder_minutes then
    return new;
  end if;
  delete from public.reminders where user_id = new.user_id and kind = 'trial_expiry' and sent_at is null;
  for e in select * from public.roster_entries
           where user_id = new.user_id and status = 'trial' and deleted_at is null and trial_expires_at > now() loop
    perform app.schedule_trial_reminder(e);
  end loop;
  return new;
end $$;

create trigger trial_reminder_lead after update of trial_reminder_minutes on public.profiles
  for each row execute function app.profile_trial_reminders();

-- Trials already on accounts get their reminders now.
do $$
declare e public.roster_entries;
begin
  for e in select * from public.roster_entries
           where status = 'trial' and deleted_at is null and trial_expires_at > now() and user_id is not null loop
    perform app.schedule_trial_reminder(e);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The sender's side (service role only)
-- ---------------------------------------------------------------------------

-- Marks what's due as sent and returns it grouped by account, with the account's push
-- subscriptions and each trial Pokémon's name in every language. Reminders more than 6 hours
-- late (the sender was down) are marked sent but not returned: a stale "the ranch refreshed"
-- helps no one. SKIP LOCKED keeps two overlapping runs from sending the same reminder twice.
create or replace function public.claim_due_reminders(p_limit integer default 500) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  with due as (
    select r.id from public.reminders r
    where r.sent_at is null and r.fire_at <= now()
    order by r.fire_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.reminders r set sent_at = now()
    from due where r.id = due.id
    returning r.id, r.user_id, r.kind, r.fire_at, r.roster_entry_id
  ), fresh as (
    select c.*, e.form_id, e.trial_expires_at
    from claimed c
    left join public.roster_entries e on e.id = c.roster_entry_id
    where c.fire_at > now() - interval '6 hours'
      and (c.kind = 'ranch_refresh'
           or (e.status = 'trial' and e.deleted_at is null and e.trial_expires_at > now()))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.user_id,
           'reminders', u.reminders,
           'subscriptions', (select coalesce(jsonb_agg(jsonb_build_object(
                                'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh,
                                'auth', s.auth, 'locale', s.locale)), '[]'::jsonb)
                             from public.push_subscriptions s where s.user_id = u.user_id)
         )), '[]'::jsonb)
    into result
  from (
    select f.user_id, jsonb_agg(jsonb_build_object(
             'id', f.id, 'kind', f.kind, 'form_id', f.form_id, 'trial_expires_at', f.trial_expires_at,
             'names', (select jsonb_object_agg(n.locale, n.name) from public.form_names n where n.form_id = f.form_id)
           ) order by f.fire_at) as reminders
    from fresh f
    group by f.user_id
  ) u;
  return result;
end $$;
revoke all on function public.claim_due_reminders(integer) from public;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- Subscriptions the push service reports as gone (404 or 410).
create or replace function public.drop_push_subscriptions(p_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where id = any(p_ids);
$$;
revoke all on function public.drop_push_subscriptions(uuid[]) from public;
grant execute on function public.drop_push_subscriptions(uuid[]) to service_role;

-- Sent reminders are only history; the nightly purge clears them after a week.
create or replace function app.purge_soft_deleted() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.team_slots     where deleted_at < now() - interval '30 days';
  delete from public.teams          where deleted_at < now() - interval '30 days';
  update public.team_slots set roster_entry_id = null
    where roster_entry_id in (select id from public.roster_entries
                              where deleted_at < now() - interval '30 days');
  delete from public.roster_entries where deleted_at < now() - interval '30 days';
  delete from public.home_forms     where deleted_at < now() - interval '30 days';
  delete from public.owned_items    where deleted_at < now() - interval '30 days';
  delete from public.reminders      where sent_at < now() - interval '7 days';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Every minute, call the sender if anything is due
-- ---------------------------------------------------------------------------

-- The function's URL and shared secret live in Vault (see the README), never in the repo. The
-- job only makes a request when a reminder is due, so a quiet minute costs nothing. Plain
-- Postgres (CI) has neither pg_cron nor pg_net, so the schedule is skipped there.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron or pg_net is not available, so send-reminders is not scheduled here';
    return;
  end if;
  execute 'create extension if not exists pg_cron with schema pg_catalog';
  execute 'create extension if not exists pg_net with schema extensions';
  execute $sql$select cron.schedule('send-reminders', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000)
    where exists (select 1 from public.reminders where sent_at is null and fire_at <= now())
  $job$)$sql$;
end $$;
