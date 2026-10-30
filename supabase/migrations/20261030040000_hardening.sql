-- Security hardening from the Oct 29, 2026 review. Sign-up is open and the publishable key reaches
-- the database API directly, so every limit the app enforces has to hold in the database too.

-- ---------------------------------------------------------------------------
-- 1. Size limits on anything a user can write, so no one can fill the free plan's storage
-- ---------------------------------------------------------------------------

alter table public.roster_entries
  add constraint roster_entries_spread_size check (spread is null or octet_length(spread::text) <= 2048);

alter table public.profiles
  add constraint profiles_locale_size check (char_length(locale) between 1 and 16);

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_https check (endpoint like 'https://%' and char_length(endpoint) <= 1024),
  add constraint push_subscriptions_key_size check (char_length(p256dh) <= 256 and char_length(auth) <= 64);

alter table public.discord_webhooks
  add constraint discord_webhooks_reason_size check (disabled_reason is null or char_length(disabled_reason) <= 200);

-- ---------------------------------------------------------------------------
-- 2. Row caps that can't be raced, and caps for the tables that had none
-- ---------------------------------------------------------------------------

-- Same as before, plus a per-user lock: two inserts at once used to both see room under the cap.
create or replace function app.enforce_row_cap() returns trigger
language plpgsql as $$
declare
  cap   int := tg_argv[0]::int;
  live  int;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.deleted_at is null then
    return new;  -- already counted
  end if;
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.user_id::text, 0));
  execute format('select count(*) from %I.%I where user_id = $1 and deleted_at is null',
                 tg_table_schema, tg_table_name)
    into live using new.user_id;
  if live >= cap then
    raise exception 'row_cap_reached: % allows at most % rows per user', tg_table_name, cap
      using errcode = 'P0001';
  end if;
  return new;
end $$;

-- For tables without soft deletes: every row counts.
create or replace function app.enforce_plain_cap() returns trigger
language plpgsql as $$
declare
  cap   int := tg_argv[0]::int;
  total int;
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.user_id::text, 0));
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into total using new.user_id;
  if total >= cap then
    raise exception 'row_cap_reached: % allows at most % rows per user', tg_table_name, cap
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger cap before insert on public.reminders
  for each row execute function app.enforce_plain_cap('500');
create trigger cap before insert on public.push_subscriptions
  for each row execute function app.enforce_plain_cap('10');

-- ---------------------------------------------------------------------------
-- 3. Users change only the columns that are theirs to change
-- ---------------------------------------------------------------------------

revoke update on public.profiles from authenticated;
grant update (locale, terms_accepted_at, age_confirmed_at) on public.profiles to authenticated;

-- The server turns a webhook off when Discord reports it deleted; the owner can rename it or
-- switch it off, but can't switch a server-disabled one back on.
revoke update on public.discord_webhooks from authenticated;
grant update (label, enabled) on public.discord_webhooks to authenticated;
drop policy own_update on public.discord_webhooks;
create policy own_update on public.discord_webhooks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (disabled_reason is null or not enabled));

-- ---------------------------------------------------------------------------
-- 4. Explicit privileges. Supabase grants anon and authenticated every privilege on new tables
--    in public by default; row-level security still guards rows, but TRUNCATE, TRIGGER and
--    REFERENCES skip it. Take everything back, grant exactly what each role needs, and stop
--    future tables from getting the defaults, so each migration grants what it means to.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

-- Reference data: read-only for everyone
grant select on public.regulations, public.forms, public.form_names, public.items,
  public.item_names, public.regulation_forms, public.regulation_items,
  public.regulation_megas, public.natures, public.news_items, public.current_regulation,
  public.form_variants, public.variant_names
  to anon, authenticated;

-- Synced user tables: no DELETE (deletes are soft; hard deletes are server-only)
grant select, insert, update on public.roster_entries, public.home_forms,
  public.owned_items, public.teams, public.team_slots to authenticated;

grant select on public.profiles to authenticated;  -- update is column-limited above
grant update (locale, terms_accepted_at, age_confirmed_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.push_subscriptions, public.reminders to authenticated;
grant select, delete on public.discord_webhooks to authenticated;  -- update is column-limited above
grant update (label, enabled) on public.discord_webhooks to authenticated;
