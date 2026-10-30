# Data

- `regulations/*.json` — hand-maintained, one file per regulation. Never delete or rename one; old seasons stay as history.
- `generated/*` — written by `npm run seed`. Don't edit by hand.
- `id-registry.json` — every form and item id ever shipped. Append-only; validation fails if one disappears.
- `pool.json` — ids left out of the out-of-season pool that search offers.
- `../supabase/migrations/*_reference_data.sql` — Supabase's copy of all of the above, written by `npm run seed` whenever it changes. Validation fails if the newest one doesn't match `data/`.

## Adding or updating a regulation

1. Copy the latest file in `regulations/` to a new one (e.g. `M-D.json`) and set its id, name, dates (UTC), and `expected_forms` from the official announcement.
2. List ids in Showdown's naming, lowercased with dashes: `Ninetales-Alola` → `ninetales-alola`, `Garchompite Z` → `garchompite-z`.
3. Put every allowed Mega Stone in both `items` and `megas`; its base Pokémon must be in `forms`.
4. Run `npm run seed`, then `npm run validate:data`.
5. Keep `"status": "draft"` until the list is complete, then switch to `"final"` so the count is enforced.
6. Commit the regulation file and everything `seed` changed in one pull request, including any new `supabase/migrations/*_reference_data.sql`.
7. Once it's merged, run `npx supabase db push` so the database has the new Pokémon before anyone syncs them.

## How a season change goes live

- The app picks up every file in `regulations/` on its own; nothing in `src/` needs editing.
- The regulation in effect is the latest one whose `starts_at` has passed. Ship the new file as soon as
  the list is announced: it stays dormant until its start date, then takes over.
- An open app notices the start date within a minute and offers a Refresh. Installed apps also check for
  a new build every hour and whenever they come back into view, so a late-shipped file still reaches them.
- Pokémon that leave the season stay in rosters and backups. They're dimmed and tagged "Not in M-D",
  and the roster filter can hide them. Search only offers the current season's Pokémon.
- If the old season ends before the new file ships, the old one keeps applying until it does.
