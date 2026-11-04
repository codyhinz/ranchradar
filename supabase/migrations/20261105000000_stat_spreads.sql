-- Stat spreads: roster_entries.spread now holds a copy's stat points (Pokémon Champions' SP).
-- Shape: {"hp", "atk", "def", "spa", "spd", "spe"}, each a whole number 0–32, adding up to 1–66.
-- No points recorded is null, never six zeros. The app checks the same rules (src/data/spread.ts);
-- this keeps any other client from storing something the app can't read.

-- CASE so each step only runs once the ones before it passed (no casts on the wrong type).
create or replace function app.is_stat_spread(spread jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(spread) is distinct from 'object' then false
    when (select array_agg(k order by k) from jsonb_object_keys(spread) k)
      is distinct from array['atk', 'def', 'hp', 'spa', 'spd', 'spe'] then false
    when exists (
      select 1 from jsonb_each(spread) e
      where jsonb_typeof(e.value) <> 'number' or e.value::text !~ '^[0-9]{1,2}$'
    ) then false
    else (
      select bool_and((e.value::text)::int <= 32) and sum((e.value::text)::int) between 1 and 66
      from jsonb_each(spread) e
    )
  end
$$;

-- The app has only ever written null here, but "not valid" means a stray row from before can't
-- block the deploy; it's checked (and fixed by the app's next write to it) on its next update.
alter table public.roster_entries
  add constraint roster_entries_spread_shape check (spread is null or app.is_stat_spread(spread)) not valid;

comment on column public.roster_entries.spread is
  'Stat points per stat: {hp, atk, def, spa, spd, spe}, 0–32 each, 1–66 in total; null when none recorded.';
