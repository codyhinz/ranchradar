-- RanchRadar initial schema
-- Reference data is public and read-only to clients (written by the seed/CI with the service role).
-- User data follows one sync pattern: client-generated ids, server-managed version/updated_at,
-- soft deletes via deleted_at, row-level security on every table.

create schema if not exists app;      -- internal helper functions
create schema if not exists private;  -- server-only data (never exposed to clients)
revoke all on schema private from public;
grant usage on schema app to anon, authenticated;  -- triggers call helpers here

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Server owns version, updated_at, created_at (after insert) and user_id (after insert).
-- Conflict detection: clients update with `where id = $1 and version = $base`;
-- zero rows updated means another device changed it first -> show the conflict prompt.
create or replace function app.touch_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.version    := 1;
    new.created_at := coalesce(new.created_at, now());  -- keeps offline creation time
    new.updated_at := now();
  else
    new.version    := old.version + 1;
    new.created_at := old.created_at;
    new.user_id    := old.user_id;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Caps live (non-deleted) rows per user. Usage: execute function app.enforce_row_cap('2000')
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
  execute format('select count(*) from %I.%I where user_id = $1 and deleted_at is null',
                 tg_table_schema, tg_table_name)
    into live using new.user_id;
  if live >= cap then
    raise exception 'row_cap_reached: % allows at most % rows per user', tg_table_name, cap
      using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Reference data (stable text ids, e.g. 'ninetales-alola'; never renamed once shipped)
-- ---------------------------------------------------------------------------

create table public.regulations (
  id         text primary key,                 -- 'M-C'
  name       text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  check (ends_at > starts_at)
);

create table public.forms (
  id          text primary key,                -- 'ninetales-alola'
  species_id  text not null,                   -- 'ninetales'
  dex_number  int  not null check (dex_number > 0),
  types       text[] not null check (array_length(types, 1) between 1 and 2),
  sprite_key  text not null
);

create table public.form_names (
  form_id  text not null references public.forms(id),
  locale   text not null,                      -- 'en', 'ja', 'es', ...
  name     text not null,
  primary key (form_id, locale)
);

create table public.items (
  id               text primary key,          -- 'focus-sash', 'garchompite-z'
  category         text not null check (category in ('held', 'berry', 'mega_stone')),
  mega_target      text,                       -- Mega form name the stone produces
  mega_base_form   text references public.forms(id),
  sprite_key       text not null,
  check ((category = 'mega_stone') = (mega_base_form is not null))
);

create table public.item_names (
  item_id  text not null references public.items(id),
  locale   text not null,
  name     text not null,
  primary key (item_id, locale)
);

create table public.regulation_forms (
  regulation_id text not null references public.regulations(id),
  form_id       text not null references public.forms(id),
  primary key (regulation_id, form_id)
);

create table public.regulation_items (
  regulation_id text not null references public.regulations(id),
  item_id       text not null references public.items(id),
  primary key (regulation_id, item_id)
);

-- Allowed Mega Evolutions; the stone must also be in that season's regulation_items.
create table public.regulation_megas (
  regulation_id text not null,
  item_id       text not null,
  primary key (regulation_id, item_id),
  foreign key (regulation_id, item_id)
    references public.regulation_items(regulation_id, item_id)
);

create table public.natures (
  id text primary key                           -- 'adamant'
);
insert into public.natures (id) values
  ('hardy'),('lonely'),('brave'),('adamant'),('naughty'),
  ('bold'),('docile'),('relaxed'),('impish'),('lax'),
  ('timid'),('hasty'),('serious'),('jolly'),('naive'),
  ('modest'),('mild'),('quiet'),('bashful'),('rash'),
  ('calm'),('gentle'),('sassy'),('careful'),('quirky');

create view public.current_regulation with (security_invoker = true) as
  select * from public.regulations
  where now() >= starts_at and now() < ends_at;

create table public.news_items (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  url           text not null unique,
  title         text not null,
  published_at  timestamptz not null,
  is_regulation boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User data
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  locale             text not null default 'en',
  terms_accepted_at  timestamptz,
  age_confirmed_at   timestamptz,               -- user confirmed they are 13+
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create or replace function app.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.create_profile();

create table public.roster_entries (
  id                uuid primary key,          -- generated on the device
  user_id           uuid not null references auth.users(id) on delete cascade,
  form_id           text not null references public.forms(id),
  status            text not null check (status in ('trial', 'permanent')),
  trial_expires_at  timestamptz,
  nature            text references public.natures(id),
  spread            jsonb,                      -- reserved for stat spreads
  notes             text check (char_length(notes) <= 500),
  source            text not null default 'manual' check (source in ('manual', 'import', 'home')),
  version           int  not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (id, user_id),                         -- target for team_slots' composite FK
  check (status = 'trial' or trial_expires_at is null)
);

-- Presence per form ("have at least one in HOME"), not individual Pokémon.
create table public.home_forms (
  user_id     uuid not null references auth.users(id) on delete cascade,
  form_id     text not null references public.forms(id),
  in_home     boolean not null,                 -- false = user answered "not in HOME"
  version     int  not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, form_id)
);

create table public.owned_items (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.items(id),
  version     int  not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, item_id)
);

create table public.teams (
  id             uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  format         text not null check (format in ('singles', 'doubles')),
  regulation_id  text references public.regulations(id),
  version        int  not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (id, user_id)
);

-- Duplicate held items, unowned items and legality are app warnings, not constraints,
-- so drafts can be saved while they're still being fixed.
create table public.team_slots (
  id               uuid primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  team_id          uuid not null,
  position         int  not null check (position between 1 and 6),
  roster_entry_id  uuid,
  held_item_id     text references public.items(id),
  version          int  not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  -- composite FKs guarantee the team and the Pokémon belong to the same user
  foreign key (team_id, user_id) references public.teams(id, user_id) on delete cascade,
  foreign key (roster_entry_id, user_id) references public.roster_entries(id, user_id)
);
create unique index team_slots_one_per_position
  on public.team_slots (team_id, position) where deleted_at is null;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create table public.reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             text not null check (kind in ('ranch_refresh', 'trial_expiry')),
  fire_at          timestamptz not null,
  roster_entry_id  uuid,
  sent_at          timestamptz,                 -- set by the sender job
  created_at       timestamptz not null default now(),
  foreign key (roster_entry_id, user_id)
    references public.roster_entries(id, user_id) on delete cascade,
  check ((kind = 'trial_expiry') = (roster_entry_id is not null))
);
create index reminders_due on public.reminders (fire_at) where sent_at is null;

-- Discord: metadata is visible to the owner; the URL itself lives in private.*
create table public.discord_webhooks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  label            text not null check (char_length(label) between 1 and 60),
  enabled          boolean not null default true,
  disabled_reason  text,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz                  -- unused by clients; lets the shared cap trigger run
);

create table private.discord_webhook_secrets (
  webhook_id  uuid primary key references public.discord_webhooks(id) on delete cascade,
  url         text not null
);

create table private.news_deliveries (
  news_item_id  uuid not null references public.news_items(id) on delete cascade,
  webhook_id    uuid not null references public.discord_webhooks(id) on delete cascade,
  delivered_at  timestamptz not null default now(),
  primary key (news_item_id, webhook_id)
);

-- ---------------------------------------------------------------------------
-- Sync triggers, caps and indexes
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['roster_entries','home_forms','owned_items','teams','team_slots'] loop
    execute format('create trigger touch before insert or update on public.%I
                    for each row execute function app.touch_row()', t);
    execute format('create index %I on public.%I (user_id, updated_at)', t || '_sync', t);
  end loop;
end $$;

create trigger cap before insert or update on public.roster_entries
  for each row execute function app.enforce_row_cap('2000');
create trigger cap before insert or update on public.teams
  for each row execute function app.enforce_row_cap('200');
create trigger cap before insert or update on public.team_slots
  for each row execute function app.enforce_row_cap('1200');
create trigger cap before insert or update on public.discord_webhooks
  for each row execute function app.enforce_row_cap('5');

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Reference tables: anyone can read, nobody but the service role can write.
do $$
declare t text;
begin
  foreach t in array array['regulations','forms','form_names','items','item_names',
                           'regulation_forms','regulation_items','regulation_megas',
                           'natures','news_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy read_all on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Synced user tables: owners read, insert and update; deletes are soft (an update).
-- Hard deletes happen only in the purge job and account deletion (service role).
do $$
declare t text;
begin
  foreach t in array array['roster_entries','home_forms','owned_items','teams','team_slots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_select on public.%I for select to authenticated
                    using (user_id = (select auth.uid()))', t);
    execute format('create policy own_insert on public.%I for insert to authenticated
                    with check (user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy own_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Push subscriptions and reminders: full control over your own rows.
do $$
declare t text;
begin
  foreach t in array array['push_subscriptions','reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_all on public.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Webhooks: owners can see, rename, toggle and remove; creation goes through a
-- server function so the URL is written straight into private.discord_webhook_secrets.
alter table public.discord_webhooks enable row level security;
create policy own_select on public.discord_webhooks for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_update on public.discord_webhooks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_delete on public.discord_webhooks for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------------

-- Purges rows soft-deleted more than 30 days ago. Scheduled in a later migration.
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
end $$;

revoke all on function app.purge_soft_deleted() from public;
revoke all on all tables in schema private from public;
