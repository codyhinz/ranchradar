# RanchRadar — Technical Reference

How RanchRadar is built, as of the commit noted below. The [README](../README.md) covers setup, deployment and secrets; this file covers how the pieces fit together and the rules that keep them working. Update it in the same commit as any change it describes.

**Current as of:** Nov 4, 2026 — Stat spreads shipped. 27 test files / 192 tests passing; typecheck and `validate:data` clean (3 expected Floettite warnings); RLS tests pass on Postgres 16.

---

## 1. What it is

A mobile-first, installable PWA for Pokémon Champions players: a quick list of every Pokémon they own, so the daily Roster Ranch recruit can be checked against it without opening a second copy of the game. Local-first: the full app works for guests with no backend. Accounts (Google, Discord, email + password) add cloud sync, reminders, and later Teams.

Live at `ranchradar.dev`. Public repo `codyhinz/ranchradar`, AGPL-3.0-only, © codyhinz. The license covers code only, not the name or logo.

### Feature status

| Area | Status |
| --- | --- |
| Roster (search, add, grid/list, filters, sorts, trials, box space, undo, backups) | Shipped |
| Cosmetic variants (Alcremie, Florges, Furfrou, Squawkabilly, Maushold, Polteageist) | Shipped |
| Stat spreads (stat points per copy, Lv 50 stats under the copy's nature; guest + synced) | Shipped |
| Season handling (dormant files, auto switch-over, out-of-season dimming) | Shipped |
| Accounts + roster sync, guest merge, conflict prompt | Shipped |
| Account export / deletion, age check (13+) | Shipped |
| Public regulation pages, `/about`, `/privacy`, `/terms`, sitemap | Shipped |
| Push reminders (ranch refresh, trial ending) | Shipped |
| Items tab (held items, berries, Mega Stones with pictures; cards/list, sorts, Mark several bought; guest + synced) | Shipped |
| Ads (AdSense) | Wired, off until approval (`VITE_ADSENSE_SLOT`) |
| Teams (Pokémon, held item, optional moves/abilities; account-only) | **Next** — tables exist, no client yet |
| Pokémon HOME tracking, news feed, Discord delivery, screenshot import | Later — some tables reserved |

---

## 2. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| UI | React 18.3, TypeScript 5.6, Vite 7 | No router library; tabs are hash-routed |
| Offline | vite-plugin-pwa 1.3 / Workbox 7.4 | `registerType: 'prompt'`; push handling imported from `public/push-sw.js` |
| Device storage | IndexedDB via `idb` 8 | `localStorage` only for small UI preferences |
| Backend | Supabase: Postgres 17, Auth, RLS, Edge Functions (Deno), pg_cron, pg_net, Vault | Free plan |
| Hosting | Cloudflare Workers static assets (`wrangler.json`, `dist/`, `404-page`) | Workers Builds deploys `main`, previews per PR |
| Auth email | Resend as Supabase SMTP | |
| Bot check | Cloudflare Turnstile on email sign-in / sign-up / reset | |
| Monitoring | Sentry (`@sentry/browser`, lazy-loaded), Cloudflare Web Analytics | |
| Tests | Vitest 5, fake-indexeddb, SQL RLS tests on Postgres 16 in CI | |
| Data tooling | `@pkmn/dex` (Showdown data), PokeAPI CSVs (pinned commit), `sharp` for sprites | Dev-only |
| Runtime | Node 22+ | |

Runtime dependencies are deliberately few: React, `idb`, `supabase-js`, Sentry, two fonts (Atkinson Hyperlegible Next, Zilla Slab).

---

## 3. Repository map

```
src/
  main.tsx, App.tsx      entry + top-level shell (state wiring, sheets, toasts)
  app/                   hooks and non-UI logic
  components/            one file per UI piece
  data/                  storage interface, IndexedDB, sync, backups, Supabase client
  catalog.ts             Pokémon/form lookups, regulations, search
  itemCatalog.ts         item lookups (lazy-loaded with the Items tab)
  i18n.ts                all UI text, 9 languages
  styles.css             single stylesheet, CSS variables
  legal/, regulations/   scripts + CSS for the static pages
data/
  regulations/*.json     hand-edited seasons (M-A, M-B, M-C)
  variants.json, pool.json, id-registry.json
  generated/             written by `npm run seed` — never hand-edit
supabase/
  migrations/            timestamped SQL, never edited once shipped
  functions/             send-reminders + _shared (webpush, messages)
  tests/                 auth_stub.sql, rls_test.sql
scripts/                 seed, validate, vapid + lib/ (data, headers, adsense, pages, referenceSql)
public/                  sprites/, icons/, brand/, _headers, push-sw.js, robots.txt
*.html                   index (app), about, privacy, terms, 404
.github/workflows/       ci, backup (weekly), keep-alive
docs/                    this file
```

---

## 4. Front end

### App shell

`App.tsx` (~420 lines) owns top-level state: auth, the open DB, the current owner's roster and item stores, preferences, the search query, which sheet/dialog is open, the toast, and a one-minute `now` tick that keeps trial countdowns current. `ItemsTab` is `lazy()`-loaded so item data only downloads when that tab opens.

**Owner resolution** is the key switch: `owner = userId` when signed in, `null` for guest, `undefined` while auth is still loading. Stores aren't created for `undefined`, so a guest roster never flashes before an account's.

### Tabs

`src/app/tabs.ts`: `TABS = ['roster', 'items']`, default `roster`, driven by `location.hash` (`#items`). The tab bar only renders when there are two or more tabs. Teams and News join `TABS` when they ship.

### Components (src/components/)

| Component | Role |
| --- | --- |
| `Header` | Ranch-sign masthead (sunset art + real text), account button |
| `TabBar` | Game-art icons (Torkoal for Roster, Focus Sash for Items), plus a Miltank link to the static `/regulations/` pages; full-width bar on phones, floating dock from 48rem. The static pages mount the same bar from `src/legal/tabBar.ts` (all links, English labels) |
| `ResultRow` | Search result: ownership summary, season legality, three add buttons |
| `RosterList` | Grid/list of owned forms, filters/sorts, box usage, bulk select, expired-trial actions |
| `FormSheet` | One form's copies: edit, make permanent, return to Ranch, remove (with undo) |
| `AddSheet` / `EntryFields` | Add with nature, variant, stat points, notes, exact trial time left |
| `StatPoints` | Folding stat points editor: summary + used/66, six −/+ rows (hold to fill or empty, or type), meter and Lv 50 stat per row with nature ▲/▼; `spreadSummary()` for cards and the conflict prompt |
| `BulkAddSheet` | First-time setup grid: tap = chosen status, long-press = the other; nothing saves until Add |
| `NaturePicker`, `VariantPicker` | Downward lists; natures sortable by stat or A–Z |
| `ItemsTab` | Item checklist: picture cards (default) or list, All/Missing/Bought, sort by category / A–Z / recently bought, category counts, Mega Stones show and search by their Pokémon |
| `ItemBulkSheet` | Mark several bought: this season's items grouped by category, tap to pick, one save and one Undo |
| `SettingsDialog` | Language, theme, box space, backup, reminders, report a problem |
| `NotificationSettings` | Per-device push toggle, ranch refresh ("I just recruited" / time left), trial lead time |
| `AccountSheet` | Google / Discord / email + password, reset, export, delete account |
| `GuestOffer`, `ConflictPrompt`, `AgeCheck` | Sign-in flows (see §6) |
| `Toast` | Undo, mascot moods |
| `UpdatePrompt` | New build ready → Refresh (always reloads, via `app/swUpdate.ts`); checks hourly and on visibility |
| `Dialog` | Native `<dialog>` modal with slide animation |
| `ErrorBoundary` | Reports to Sentry, offers reload |
| `AdSlot`, `Sprite`, `TypeTags`, `StopSign`, `Mascot` | Small pieces |
| `usePressAndHold`, `reveal.ts` | Long-press detection; scroll-into-view within a container only |

### Hooks and logic (src/app/)

| File | Role |
| --- | --- |
| `useRoster.ts` | Opens IndexedDB, builds the owner's `RosterStore`, live entry list; purges local tombstones older than 24h on launch; requests persistent storage |
| `useItems.ts` | Owner's `ItemStore` and owned items (`item_id → updated_at`, for "recently bought") |
| `useAuth.ts` | `AuthState` (`unavailable` / `loading` / `signedOut` / `signedIn`), password-recovery flag, OAuth redirect errors |
| `useAccountSync.ts` | When to sync, guest offer, conflict list (§6) |
| `useAgeCheck.ts` | One-time 13+ question per account (`profiles.age_confirmed_at`) |
| `useNotifications.ts` / `push.ts` | Push support detection, subscribe/unsubscribe, ranch + trial reminder settings |
| `preferences.ts` | `localStorage` prefs with in-memory fallback |
| `rosterFilters.ts` | Status / type / season filters and sorts |
| `box.ts` | Box capacity: 30 base, 50 with Ranked rewards, +50 Starter Pack, +1,000 membership |
| `ads.ts`, `turnstile.ts`, `errorTracking.ts`, `feedback.ts`, `accountData.ts`, `authErrors.ts`, `signInMethod.ts`, `signInHint.ts` | Integrations and helpers |

`localStorage` keys (all prefixed `ranchradar:`): `name-locale`, `theme`, `roster-view`, `roster-sort`, `item-view`, `item-sort`, `nature-sort`, `box`, `sign-in-method`.

### Catalog and search

`catalog.ts` loads `data/generated/forms.json`, names and variants. Key sets:

- `catalog` — forms legal in the current regulation (what search offers by default).
- `addableCatalog` — legal forms plus the out-of-season pool (`available.json`: fully evolved / non-evolving, battle-only and cosmetic forms excluded).
- `currentRegulation = regulationAt(now)` — latest regulation whose `starts_at` has passed.
- `baseStatsOf(formId)` — base HP/Atk/Def/SpA/SpD/Spe from `forms.json` (`stats`), for the Lv 50 numbers in the stat points editor.

Search normalizes text (case, accents, kana) per locale. Sprites are Pokémon HOME renders served from `/sprites/<id>.webp` and `/sprites/variants/`; `Sprite.tsx` is the only place URLs are built, falling back variant → form → plain tile. Item pictures live at `/sprites/items/<id>.webp` (`itemSpriteUrl` / `ItemSprite`, plain tile if missing).

### i18n

All UI text goes through `t(key, vars)` in `i18n.ts`. English (`en`) is the full dictionary and defines `MessageKey`; the other eight (`ja`, `ko`, `zh-Hant`, `zh-Hans`, `fr`, `de`, `es`, `it`) are typed `Record<MessageKey, string>`, so a missing key in any language fails `typecheck`. `t()` still falls back to English at runtime as a safety net. `MESSAGE_KEYS` lists every key; the test checks placeholders match English for every key in every language. One language setting drives UI text, Pokémon/item/nature/type names and search.

### Styling

Single `styles.css` (~1,100 lines). Torkoal theme tokens on `:root`: `--smoke`, `--surface`, `--coal`, `--muted`, `--ember`, `--ember-strong`, `--hay`, `--hay-ink`, `--wood`, `--rail`, `--danger`, `--focus`, `--shadow`, `--lift`, `--glow`, `--page-bg`, `--grain`, fonts `--font-sign` / `--font-body`, radii, `--bottom-chrome` (safe-area). Dark values are defined twice: under `prefers-color-scheme: dark` and for the explicit dark theme. New colors must be new variables with both light and dark values.

---

## 5. Data layer (src/data/)

### The storage contract

`storage.ts` is the only interface the UI uses:

- **`RosterStore`** — `list`, `get`, `add`, `addMany`, `update`, `remove`, `removeMany`, `restore`, `importEntries`, `purgeDeleted`, `subscribe`, `refresh`.
- **`ItemStore`** — `list`, `setOwned(itemId, owned)`, `setOwnedMany(itemIds, owned)` (one transaction, one notification, returns how many changed), `subscribe`, `refresh`.
- **`StorageError`** codes: `not_found`, `invalid`, `row_cap_reached`.

Both are implemented only by local stores (`local/localRosterStore.ts`, `local/localItemStore.ts`). There is no "cloud store": signed-in stores are the same local stores with `syncEnabled: true`, which also queues every write into the outbox. Sync runs separately. This is what keeps screens unaware of where data lives.

### Types (types.ts)

Shapes mirror the Supabase tables so rows move unchanged. `SyncFields` = `version`, `created_at`, `updated_at`, `deleted_at`. `RosterEntry`: `id` (device UUID), `user_id` (null = guest), `form_id`, `status` (`trial` | `permanent`), `trial_expires_at`, `nature`, `variant`, `spread` (`StatSpread | null`, see below), `notes` (≤500), `source` (`manual` | `import` | `home`). `OwnedItem` uses `owner` (`''` for guest, since IndexedDB keys can't be null) + `item_id`. `SyncTable = 'roster_entries' | 'owned_items'`. Constants: `TRIAL_DAYS = 7`, `MAX_ROSTER_ENTRIES = 2000`.

### IndexedDB schema (local/db.ts)

Database `ranchradar`, version = number of migration steps (currently **3**). Steps are append-only and replay from any old version.

| Store | Key | Notes |
| --- | --- | --- |
| `roster_entries` | `id` | index `by_form`; guest and every account that signed in on this device coexist, separated by `user_id` |
| `owned_items` | `[owner, item_id]` | added in v3 |
| `outbox` | `[table, rowId]` | rows waiting to upload; item rowIds are `${owner}\|${item_id}` |
| `meta` | `key` | sync cursors `sync:<table>:cursor:<userId>`, `guestUpload:declined:<userId>` |

Outbox items carry `isNew` (insert vs. versioned update), and optionally `held: 'duplicate_id' | 'conflict'` with `theirs` (server copy), or `refetch: true` after the user keeps the server's copy. The row itself is read at upload time, so the latest local edit always wins.

`blocking()` closes the connection when another tab opens a newer DB version; the update prompt then reloads.

### Stat spreads (spread.ts)

Pokémon Champions replaces EVs with stat points (SP): up to 32 per stat and 66 in total, each point +1 to the Level 50 stat; IVs don't exist (every stat acts as 31). `spread` is `{hp, atk, def, spa, spd, spe}`, always all six keys in that order (Postgres's own jsonb key order, so device and server copies compare equal). No points recorded is `null`, never six zeros.

- `readSpread(value)` — reads untrusted input (server rows, backup files) into the canonical form; anything unreadable becomes `null`. `fromServer` in the sync engine runs every pulled spread through it.
- `compactSpread` / `isValidSpread` — the store compacts six zeros to `null` and refuses anything over the caps (`StorageError('invalid')`).
- `battleStats(base, spread, nature)` — HP = base + SP + 75 (Shedinja stays 1); others = ⌊(base + SP + 20) × nature⌋, computed in integers.
- `NATURE_EFFECTS` lives here and is shared with `NaturePicker`.

### Backups (backup.ts)

Versioned JSON (`app: 'ranchradar'`, `format: 1`), max 2 MB, live entries only, no `user_id` or server version. Rows carry `spread`; files from before stat points simply lack it (read as `null`), and a spread that doesn't add up is dropped without skipping the row. Import merges by id: new rows added, existing rows keep whichever `updated_at` is newer, nothing deleted. Account export (`accountData.ts`) wraps the same format plus the server's `export_my_data()` result, so it also imports as a backup.

### Ownership (ownership.ts)

`summarizeByForm` groups live entries per form: total, permanent, trial, expired trials, soonest active expiry, variants, last added. Drives search rows, the roster grid and sorts.

---

## 6. Sync

### Principles

- Every write lands in IndexedDB first; the network is never in the write path.
- Client-generated UUIDs, so inserts need no id remapping.
- **Server owns `version`.** `app.touch_row()` sets it to 1 on insert and +1 on every update, and pins `created_at` / `user_id`. Devices never bump it; a row's local `version` is the last one the server confirmed.
- Soft deletes via `deleted_at`, so removals propagate. Tombstones purge after 30 days on the server, 24 hours locally (once uploaded).
- Pulls use the server's `updated_at`, never device clocks, with a 2-minute overlap to catch slow commits.

### Roster sync pass (sync/syncEngine.ts)

One pass at a time per DB (`syncRoster` dedupes concurrent calls), in order:

1. **Inserts** (`guestUpload.uploadPendingInserts`) — batches of 100. A `23505` duplicate holds the row as `duplicate_id` (only possible from a restored backup).
2. **Prepare duplicates** — fetch the server copy. Not found: re-id and insert as new. Same content: adopt the server's. Different: keep held for the prompt.
3. **Refetch chosen** — rows where the user kept "theirs" get one more fetch in case it changed again.
4. **Push updates** — 4 in parallel, each `update … where id = ? and version = base`. Zero rows matched → fetch: gone on server (removal done, or re-queue as insert), same content (settle), or different (hold as `conflict`). `settle()` keeps any edit made mid-request queued against the newly confirmed version.
5. **Pull** — pages of 1,000 changed since the cursor. Skips rows still in the outbox, rows already at or above that version, tombstones never seen, and ids belonging to the guest roster.

Results: `sent`, `received`, `conflicts`, `status` (`done` / `offline` / `full` / `error`). A dropped connection (supabase-js error with no Postgres code) is treated as `offline`; `row_cap_reached` becomes `full`.

### Item sync (sync/itemSync.ts)

An owned item is a yes/no, so no conflict prompt: each change is an upsert of `(user_id, item_id, deleted_at)` on `onConflict: user_id,item_id`, batches of 200, last write the server receives wins. Pull works like the roster's. Items sync after the roster in the same `useAccountSync` loop, skipped only if the roster pass was offline.

### When sync runs (app/useAccountSync.ts)

On sign-in; 1.5 s after the last local change (debounced); on `online`; on `visibilitychange` to visible; every 60 s while visible. A change landing mid-sync triggers one more loop. Store refreshes caused by a pull are flagged so they don't schedule another upload.

### Guest → account

`claimGuestRoster` runs in one IndexedDB transaction: every live guest row takes the account's `user_id` and joins the outbox as an insert; guest tombstones are dropped; the guest's owned items merge into the account's. It refuses (`row_cap_reached`) if the result would exceed 2,000. Upload then happens normally and can fail/retry freely. The offer appears once per account on sign-in when a guest roster exists; "Keep separate" is remembered in `meta`; dismissing (Esc) asks again next sign-in.

### Conflicts

`ConflictPrompt` shows held rows one at a time, oldest first, with differing fields marked. `kind: 'changed'` (edited on another device) or `'duplicate'` (restored backup already in account). Keep mine → re-queued against the server's version. Keep theirs → server copy applied locally and refetched next pass. "Decide later" holds for the visit.

### Sign-out and deletion

Signing out switches to the guest roster; the account's copy stays on the device. After account deletion, `forgetAccount` removes that account's rows, items, outbox entries and `meta` keys from the device, leaving the guest and other accounts untouched. Signing out also removes the device's push subscription.

---

## 7. Backend (Supabase)

### Schemas

- `public` — reference + user tables exposed through the Data API.
- `app` — helper/trigger functions (not callable by clients except via triggers).
- `private` — server-only (Discord webhook URLs, news deliveries); no client access.

### Reference tables (public read, service-role write)

`regulations`, `forms`, `form_names`, `form_variants`, `variant_names`, `items` (`held` | `berry` | `mega_stone`, with `mega_base_form`), `item_names`, `regulation_forms`, `regulation_items`, `regulation_megas` (FK to `regulation_items`), `natures`, `news_items` (reserved), view `current_regulation`. Loaded by generated `*_reference_data.sql` migrations (upserts, safe to re-run).

### User tables

| Table | Key | Client rights | Cap | Status |
| --- | --- | --- | --- | --- |
| `profiles` | `user_id` | select; update `locale`, `terms_accepted_at`, `age_confirmed_at`, `trial_reminder_minutes` | — | In use |
| `roster_entries` | `id` (+ unique `id,user_id`); `spread` checked by `app.is_stat_spread()` | select/insert/update | 2,000 live | In use |
| `owned_items` | `(user_id, item_id)` | select/insert/update | — | In use |
| `teams` | `id` | select/insert/update | 200 | Schema only |
| `team_slots` | `id`; unique live `(team_id, position)` 1–6 | select/insert/update | 1,200 | Schema only |
| `home_forms` | `(user_id, form_id)` | select/insert/update | — | Reserved |
| `push_subscriptions` | `id`, unique `endpoint` | select/insert/update/delete (write via RPC) | 10 | In use |
| `reminders` | `id` | select; insert ranch refresh only (≤22h05m ahead); delete unsent | 500 ranch refreshes | In use |
| `discord_webhooks` (+ `private.discord_webhook_secrets`) | `id` | select/delete; update `label`, `enabled` | 5 | Reserved |

All synced tables get the `touch` trigger and a `(user_id, updated_at)` index. No client `DELETE` on synced tables; hard deletes happen only in the purge job and account deletion. `team_slots` uses composite FKs `(team_id, user_id)` and `(roster_entry_id, user_id)` so a slot can only reference the same user's team and Pokémon. Legality, duplicate held items and unowned items are app warnings, not constraints, so drafts save.

**Stat spreads (`20261105000000_stat_spreads.sql`):** `app.is_stat_spread(jsonb)` (immutable, CASE-ordered so no cast runs on the wrong type) requires exactly the six keys, whole numbers 0–32, total 1–66. Added as `roster_entries_spread_shape` `NOT VALID`, so a stray old row can't block the deploy; the app's next write to such a row fixes it.

**Teams note:** `team_slots` currently has `held_item_id` but no move or ability columns. Shipping Teams (with optional moves/abilities) needs a new migration adding them, plus a new `SyncTable`, IndexedDB step and sync module.

### Hardening (Oct 29 review, `20261030040000_hardening.sql`)

Size checks on every user-writable text/JSON (`spread` ≤2 KB, locale ≤16, push endpoint https ≤1 KB, keys bounded). Row caps take a per-user advisory lock so concurrent inserts can't race past them. Column-limited `UPDATE` grants. All default Supabase privileges revoked from `anon`/`authenticated` (TRUNCATE/TRIGGER/REFERENCES bypass RLS), and future tables get nothing by default: **every new migration must grant exactly what it needs.**

### RPCs

| Function | Who | Security | Purpose |
| --- | --- | --- | --- |
| `delete_my_account()` | authenticated | definer, uses `auth.uid()` only | Deletes the auth user; everything cascades |
| `export_my_data()` | authenticated | invoker (RLS applies) | All the caller's rows as JSON, minus push keys and webhook URLs |
| `save_push_subscription(endpoint, p256dh, auth, locale)` | authenticated | definer | Upsert by endpoint; the signed-in account takes over a shared browser |
| `set_ranch_reminder(fire_at)` | authenticated | invoker | Replaces the single pending ranch reminder |
| `claim_due_reminders(limit)` | service_role | definer | `FOR UPDATE SKIP LOCKED`, marks sent, drops >6h-stale, groups by account with subscriptions and localized names |
| `drop_push_subscriptions(ids)` | service_role | definer | Removes endpoints reported gone |

### Scheduled jobs (pg_cron; skipped with a notice on plain Postgres in CI)

- `purge-soft-deleted` — daily 04:23 UTC: tombstones older than 30 days (slots, teams, roster with slot unlinking, HOME forms, items) and sent reminders older than 7 days.
- `send-reminders` — every minute, but only makes the `pg_net` HTTP call when something is due. URL and shared secret come from Vault (`project_url`, `reminders_cron_secret`).

### Reminders pipeline

Trial reminders are never written by the app. Trigger `trial_reminder` on `roster_entries` (re)schedules one reminder per live trial at `trial_expires_at − profiles.trial_reminder_minutes` (60 / 360 / 1440 default / 2880, null = off), only when status, expiry or deletion changes; it skips trials ending sooner than the lead and avoids re-sending for the same time. Changing the lead time reschedules all of the account's trials. Ranch refresh reminders are set by the user: "I just recruited" (now + 22h) or a Quick Coupon time-left entry.

Edge Function `send-reminders` (Deno, JWT verification off, guarded by constant-time `x-cron-secret` check, 404 otherwise) claims due reminders, builds localized notifications per subscription (`_shared/messages.ts`), and sends Web Push with VAPID implemented directly on WebCrypto (`_shared/webpush.ts`, no dependencies). TTL 4h for ranch refresh, 24h for trials. Endpoints are restricted to FCM, Mozilla, Apple and Windows push hosts (`app.is_push_endpoint`, checked in the DB and again before sending). 404/410 responses drop the subscription. `public/push-sw.js` shows notifications as plain text and only opens same-origin URLs. iOS requires the app installed to the Home Screen.

### Auth

Supabase Auth with Google, Discord, and email + password (implicit flow, so confirmation/reset links work across browsers). Turnstile token required on email flows when CAPTCHA is on. `profiles` row created by trigger on `auth.users` insert. Age check runs once per account after first sign-in; "under 13" deletes the account. Sign-in method shown in the account sheet is derived from the session token's AMR, identities, and a remembered OAuth choice.

---

## 8. Reference data pipeline

1. **Hand-edit** `data/regulations/<id>.json`: `id`, `name`, `starts_at`/`ends_at` (UTC), `status` (`draft` → `final`), `expected_forms`, `forms` (Roster Ranch list), `items` (every allowed held item, including Mega Stones), `megas` (allowed Mega Stones, also in `items`). Ids are Showdown names lowercased with dashes.
2. **`npm run seed`** resolves ids through `@pkmn/dex` and PokeAPI CSVs (pinned commit `2ee1c42…`), writes `data/generated/*` (`forms` with base `stats`, `form-names`, `items`, `item-names`, `nature-names`, `type-names`, `variants`, `available`), builds sprites with `sharp` (Pokémon: HOME renders; items: PokeAPI sprites pinned at `1b3b7c0…`, Scarlet/Violet render → Dream World art → classic 30px icon scaled by a whole number, into `public/sprites/items/`), appends new ids to `id-registry.json`, and writes a new `supabase/migrations/<ts>_reference_data.sql` if anything changed. Any unresolved id stops the run.
3. **`npm run validate:data`** (offline, in CI): schema/date/slug checks, final counts match `expected_forms`, no registry id disappears (no renames), newest reference migration exactly matches `data/`, every form has six base stats. Megas whose base form isn't recruitable (Floettite / Eternal Floette) are warnings, not errors.
4. Commit everything together; after merge, `npx supabase db push` so the DB knows new forms before anyone syncs them.

Current data: 3 regulations (M-A 213 forms / 110 items / 59 megas, M-B 235 / 141 / 75, M-C 261 / 159 / 81; M-C ends Dec 2, 2026 01:59:59 UTC), 672 forms in the catalog, 670 in the addable pool, 159 items.

**Season switch-over:** the app picks up every regulation file automatically; the latest with a passed `starts_at` applies, and the previous one keeps applying if a new file is late. Open apps notice within a minute and offer Refresh; installed apps also check for a new build hourly and on visibility. Out-of-season Pokémon stay in rosters, dimmed and tagged, and can be filtered out; search only offers the current season (plus the pool for adding).

---

## 9. Build and static pages

`vite.config.ts` adds custom plugins:

- **securityHeaders** — fills `{{SUPABASE}}`, `{{SENTRY}}` and AdSense hosts into the CSP in `dist/_headers` at build time.
- **adsense** — with `VITE_ADSENSE_CLIENT`: meta tag + `ads.txt`; malformed ids fail the build. Units only render with `VITE_ADSENSE_SLOT`, never in search results or sheets.
- **legalPages** — dev/preview rewrite of `/about`, `/privacy`, `/terms` to their `.html` (Cloudflare does this in production).
- **Regulation pages** — static HTML for `/regulations/` and `/regulations/<id>/` written to the gitignored `regulations/` folder at config load (restart dev after editing `data/`); each bundles `src/regulations/page.ts`, which marks what the visitor owns from their local roster. Held items and berries are chips with their icon from `/sprites/items/` (same path as `itemSpriteUrl`); a test checks every linked icon exists.
- **sitemap** — `/`, every regulation page, legal pages.
- **VitePWA** — precaches app, fonts and every sprite that has ever been in a regulation; pool-only sprites are runtime-cached (`CacheFirst`, 1,000 max). `navigateFallback` to `index.html`, with legal and regulation pages denylisted. `__APP_VERSION__` = 7-char commit SHA or `dev`.

**Security headers** (`public/_headers`): strict CSP (`default-src 'self'`, only Cloudflare beacon + Turnstile scripts, `style-src-attr 'unsafe-inline'` for React style attributes, `frame-ancestors 'none'`), `nosniff`, strict referrer, restrictive Permissions-Policy, `X-Frame-Options: DENY`.

### Build-time environment

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`, `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT`, `VITE_VAPID_PUBLIC_KEY` — all optional; each feature turns itself off when its variable is missing (no Supabase = guest-only build). Typed in `src/vite-env.d.ts`; `.env.example` lists them all for local `.env.local` setup (keep the two in sync). Set in Cloudflare → Worker → Settings → Builds → Variables.

Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `REMINDERS_CRON_SECRET`. Vault: `project_url`, `reminders_cron_secret`. GitHub secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (keep-alive); `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`, `R2_*` (backup).

---

## 10. CI and operations

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | PRs, pushes to `main` | **app:** `npm ci` → typecheck → validate:data → test → build (Node 22). **database:** Postgres 16 service, applies `auth_stub.sql`, every migration in order, then `rls_test.sql` |
| `backup.yml` | Sundays 08:41 UTC + manual | Supabase CLI dumps roles/schema/data via session pooler, sanity-checks for `roster_entries`, GPG AES-256 encrypts, uploads to private R2 `weekly/`, verifies size; 90-day lifecycle on the bucket |
| `keep-alive.yml` | Every 3 days 09:17 UTC + manual | Reads one `regulations` row so the free plan never pauses |

GitHub disables scheduled workflows after 60 days of repo inactivity.

**RLS tests** cover: insert/update versioning and stale writes, cross-user read/insert/update/link attempts, client writes to reference data, hard deletes, private schema access, variant FK, size limits, stat spread shape, caps, column grants, TRUNCATE, anon access, export/delete isolation, and reminders.

**Unit tests** (Vitest, node env, fake-indexeddb): local stores, sync engine, guest upload, stat spreads (caps, canonical order, Lv 50 math), spread summaries, owned items, backups, forget account, catalog/item catalog, filters, tabs, i18n placeholders (every key), auth errors, sign-in method, feedback scrubbing, entry fields, and build helpers (headers, adsense, regulation pages, reference SQL, webpush, push SW, validate).

---

## 11. Conventions and invariants

- **Local-first.** Every write hits IndexedDB first. Screens only talk to `RosterStore` / `ItemStore`.
- **Server owns `version`.** Never bump it on the device. Updates are conditional on the base version.
- **Soft deletes** for anything that syncs. No client hard deletes.
- **IndexedDB migrations** are append-only steps in `db.ts`; never edit a shipped step.
- **SQL migrations** are new timestamped files; never edit an old one. Grant privileges explicitly. Add RLS tests for new tables.
- **Reference data** only changes through `data/` + `npm run seed`. Never hand-edit `data/generated/` or reference migrations. `id-registry.json` is append-only; ids are never renamed.
- **New UI text** = new i18n keys in all 9 languages, English first (typecheck fails if one is missing).
- **New colors** = CSS variables with light and dark values.
- **Hover states** live in one `@media (hover: hover) and (pointer: fine)` block at the end of `styles.css`, so touch screens never get sticky hovers; new clickable pieces get a rule there.
- **Tests** sit beside the file (`*.test.ts`) or in `src/data/__tests__/`.
- **Privacy:** Sentry and feedback never include roster data, notes or typed text; URLs lose query and hash.
- **Before shipping:** `npm run typecheck && npm test && npm run validate:data`.
- **Docs:** update this file in the same commit when architecture, schema, sync, or feature status changes.

### Adding a new synced feature (pattern from Items)

1. SQL migration: table with `SyncFields`, `user_id` FK cascade, `touch` trigger, `(user_id, updated_at)` index, cap if needed, RLS `own_select/insert/update`, explicit grants, add to `purge_soft_deleted()` and `export_my_data()`. Extend `rls_test.sql`.
2. `types.ts`: row type, add to `SyncTable`.
3. `db.ts`: new migration step for the store.
4. `storage.ts`: interface; `local/`: implementation that writes row + outbox in one transaction.
5. `sync/`: sync module; wire into `useAccountSync`, `claimGuestRoster` (if guests have it), `forgetAccount`.
6. UI, i18n keys in all languages, tests beside each piece.

---

## 12. Known gaps and housekeeping

- **Teams schema lacks moves/abilities** (see §7).
- **Reserved, unused:** `home_forms`, `discord_webhooks` + `private.*`, `news_items`, `source: 'home' | 'import'`.
- **M-C ends Dec 2, 2026** — the next regulation file (M-D) should ship as soon as it's announced.
