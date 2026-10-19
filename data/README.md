# Data

- `regulations/*.json` — hand-maintained, one file per regulation. Never delete or rename one; old seasons stay as history.
- `generated/*` — written by `npm run seed`. Don't edit by hand.
- `id-registry.json` — every form and item id ever shipped. Append-only; validation fails if one disappears.

## Adding or updating a regulation

1. Copy the latest file in `regulations/` to a new one (e.g. `M-D.json`) and set its id, name, dates (UTC), and `expected_forms` from the official announcement.
2. List ids in Showdown's naming, lowercased with dashes: `Ninetales-Alola` → `ninetales-alola`, `Garchompite Z` → `garchompite-z`.
3. Put every allowed Mega Stone in both `items` and `megas`; its base Pokémon must be in `forms`.
4. Run `npm run seed`, then `npm run validate:data`.
5. Keep `"status": "draft"` until the list is complete, then switch to `"final"` so the count is enforced.
6. Commit the regulation file and everything `seed` changed in one pull request.
