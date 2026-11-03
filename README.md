# RanchRadar

**A roster tracker for Pokémon Champions.** Tab over from the game, see every Pokémon you own at a glance, and know instantly whether today's Roster Ranch recruit is one you already have.

[![CI](https://github.com/codyhinz/ranchradar/actions/workflows/ci.yml/badge.svg)](https://github.com/codyhinz/ranchradar/actions/workflows/ci.yml)
![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)

RanchRadar is a mobile-first web app you can install like a native one. It works offline, needs no account, and is built around one loop: glance at the game, flip to the app, check, flip back.

## Features

- **Search that answers the recruit question.** Type a few letters and each result shows how many you own, permanent and trial, right in the row.
- **One-tap adding.** Add a Pokémon as permanent or as a 7-day trial straight from search, or open the add sheet to set nature, cosmetic variant, notes, and exact trial time left.
- **Your whole box.** A sprite grid or a detailed list, with filters for status and type and sorting by name, Dex number, trial ending soon, recently added, or most copies.
- **Trial tracking.** Countdowns on every trial, expired trials flagged, and one tap to make one permanent or return it to the Ranch.
- **Box space.** Every copy counts against your box slots, with settings for Ranked rewards, the Starter Pack, and membership.
- **Season changes handled.** Pokémon that leave the current regulation stay in your roster, dimmed and tagged, and the next regulation takes over on its start date.
- **Duplicates and variants.** Every owned Pokémon is its own entry, so duplicates with different natures work naturally. Cosmetic variants like Alcremie flavors and Florges colors are tracked too.
- **Undo everywhere.** Every removal, bulk clear, and status change can be undone from the toast.
- **Backups.** Export your roster to a JSON file and import it on another device.
- **Accounts and sync.** Sign in with Google, Discord, or email and password from the account button in the header. Your roster syncs across devices, a guest roster can move into the account when you sign in, and when two devices change the same Pokémon you pick which version to keep.
- **Your data, your call.** Download everything an account stores, or delete the account and all of it, from the account sheet.
- **About and FAQ.** A page at `/about` explaining what RanchRadar is, how it works with the game, and answers to common questions.
- **Regulation pages.** Public pages for every season at `/regulations/`, listing its Roster Ranch Pokémon, Mega Evolutions and held items and what it added. Visitors who use the app see which ones they own.
- **Nine languages.** Interface text, Pokémon names, and search in English, Japanese, Korean, Traditional and Simplified Chinese, French, German, Spanish, and Italian.

## Tech stack

| Piece | Choice |
| --- | --- |
| App | React 18, TypeScript, Vite |
| Offline | Installable PWA (vite-plugin-pwa / Workbox), IndexedDB via `idb` |
| Backend | Supabase (Postgres, Auth, row-level security) |
| Hosting | Cloudflare Workers static assets |
| Email | Resend, as Supabase Auth's SMTP sender |
| Bot protection | Cloudflare Turnstile on email sign-in, sign-up and password reset |
| Monitoring | Sentry (crash reports), Cloudflare Web Analytics (cookie-free visit counts) |
| Backups | Weekly encrypted database dump to Cloudflare R2 (GitHub Actions) |
| Tests | Vitest, fake-indexeddb, SQL row-level security tests in CI |

The app is local-first: every write lands in IndexedDB first, so guests get the full app with no backend. A storage interface keeps screens unaware of whether data lives on the device or in the cloud.

## Getting started

You need Node.js 22 or newer.

```bash
git clone https://github.com/codyhinz/ranchradar.git
cd ranchradar
npm install
npm run dev
```

Open http://localhost:5173. Without any configuration the app runs in guest mode, which covers everything except accounts.

### Connecting Supabase (optional)

To try accounts, copy `.env.example` to `.env.local` and fill in your project's values from the Supabase dashboard:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co      # Project Settings → Data API
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...            # Project Settings → API Keys
```

Crash reports are optional too. Create a free Sentry project (platform: Browser JavaScript) and add its DSN; builds without one send nothing and don't include the SDK:

```bash
VITE_SENTRY_DSN=https://...@o0.ingest.us.sentry.io/0           # Sentry project → Settings → Client Keys (DSN)
```

If CAPTCHA protection is on in your Supabase project (Authentication → Attack Protection, provider Turnstile), email sign-in, sign-up and password reset need a Turnstile token, so add the widget's site key; add `localhost` to the widget's hostnames in Cloudflare too. Without CAPTCHA on, leave it unset:

```bash
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...                          # Cloudflare → Turnstile → widget site key (needed once CAPTCHA is on in Supabase)
```

Ads are off unless you set AdSense ids. The client id alone adds the `google-adsense-account` meta tag, `ads.txt`, the CSP entries and the AdSense script (enough for AdSense's site review) but shows no ads; a display ad unit's slot id turns the units on. A malformed id fails the build:

```bash
VITE_ADSENSE_CLIENT=ca-pub-1234567890123456                    # AdSense → Account → Account information (add ca- in front of the publisher ID)
VITE_ADSENSE_SLOT=1234567890                                   # AdSense → Ads → By ad unit → a display unit's id (only after approval)
```

Then apply the schema in `supabase/migrations/` to your project with `npx supabase link` and `npx supabase db push` (the CLI is pinned in `package.json`, so `npx` uses that version rather than the newest one), and under Authentication → URL Configuration add `http://localhost:5173/**` as a redirect URL. Restart `npm run dev` after editing `.env.local`.

For Google and Discord sign-in, turn each provider on under Authentication → Sign In / Providers and paste in its client ID and secret. In the Google Cloud console (an OAuth client of type Web application) and the Discord Developer Portal (OAuth2), set the redirect URL to `https://your-project-ref.supabase.co/auth/v1/callback`. The buttons always show, so enable both providers before deploying. For the button icons, save Google’s and Discord’s official marks from their brand kits as `public/icons/brands/google.svg` and `public/icons/brands/discord.svg`; without them the buttons show text only.

The publishable key is meant to be public. What protects each person's data is row-level security, defined in the migrations and tested in CI.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check the app and scripts |
| `npm run validate:data` | Check the regulation files and reference data |
| `npm run seed` | Rebuild `data/generated/` and sprites from the regulation files |

## Project layout

```
src/
  app/          hooks and logic: roster, auth, filters, preferences
  components/   screens, sheets, and UI pieces
  data/         storage interface, IndexedDB store, backups, Supabase client
data/
  regulations/  one hand-maintained JSON file per regulation (M-C.json, ...)
  generated/    output of `npm run seed`; don't edit by hand
supabase/
  migrations/   database schema and row-level security policies
  tests/        SQL tests proving users can't touch each other's rows
scripts/        seed, validation, and build helpers
public/         sprites, icons, and security headers (_headers)
```

## Updating for a new regulation

Each regulation is one JSON file in `data/regulations/`. Add the new file as soon as the list is announced. It stays dormant until its start date, then takes over automatically, and open apps are offered a refresh. Pokémon that leave the season stay in everyone's rosters.

The full steps are in [`data/README.md`](data/README.md). In short: copy the latest file, fill in the list from the official announcement, run `npm run seed` and `npm run validate:data`, and commit everything together. CI blocks any pull request with a bad regulation file or a renamed ID.

`forms` is the Roster Ranch list from the in-game Recruit → Roster Info screen. `items` and `megas` are every held item and Mega Stone allowed in battle, which can include Megas of Pokémon the Ranch never offers (Mega Floette needs the gift-only Eternal Floette); validation warns about those but lets them through.

The build turns each file into a public page at `/regulations/<id>/`, plus an index at `/regulations/` and a `sitemap.xml`. The pages are written into `regulations/` (gitignored) when Vite starts, so restart `npm run dev` after editing `data/` to see them change.

## Deployment

Cloudflare Workers Builds deploys `main` automatically, with a preview link for each pull request. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, `VITE_TURNSTILE_SITE_KEY`, `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT` and `VITE_VAPID_PUBLIC_KEY` under the Worker's **Settings → Builds → Variables and secrets**. They're read at build time, and the build also writes the project's exact Supabase and Sentry origins, plus AdSense's hosts when it's on, into the Content-Security-Policy in `public/_headers`.

Removed roster entries, teams and items are kept as tombstones for 30 days so every device can sync the removal, then a daily pg_cron job (`purge-soft-deleted`, 04:23 UTC) deletes them for real.

A scheduled GitHub Action pings Supabase every few days so the free-plan project never pauses. It needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repository secrets. GitHub turns off scheduled workflows after 60 days without repository activity, so re-enable them under **Actions** if the repo goes quiet.

### Backups

Supabase's free plan doesn't give you access to its own daily backups (they recommend exporting with `supabase db dump`), so `.github/workflows/backup.yml` makes one every Sunday. It dumps roles, schema and data with the Supabase CLI, encrypts the archive with a passphrase, and uploads it to a private R2 bucket as `weekly/ranchradar-YYYY-MM-DD.tar.gz.gpg`. The data includes account emails and password hashes, so the archive is never stored unencrypted.

To set it up:

1. In Cloudflare, create a private R2 bucket and add a lifecycle rule that deletes objects under `weekly/` after 90 days.
2. Create an R2 API token with **Object Read & Write** on that bucket only.
3. Add the repository secrets `SUPABASE_DB_URL` (Supabase → **Connect** → **Session pooler**, password percent-encoded; GitHub's runners can't reach the IPv6-only direct connection), `BACKUP_PASSPHRASE` (a long random passphrase, also saved in your password manager), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`.
4. Run the workflow once from **Actions → Database backup → Run workflow** and check the file appears in the bucket.

To restore, download a backup and decrypt it, then load it into an empty Supabase project:

```bash
gpg --decrypt ranchradar-YYYY-MM-DD.tar.gz.gpg | tar -xzf -
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_PROJECT_DB_URL"
```

Restore into a scratch project now and then to be sure the backups work.

### Reminders

Signed-in players can get a push notification when the Roster Ranch refreshes ("I just recruited", or the time left after a Quick Coupon) and before a trial ends (1 hour to 2 days before, 1 day by default). Trial reminders are scheduled by a database trigger from the synced roster; the app never writes them. A pg_cron job (`send-reminders`) calls the `send-reminders` Edge Function every minute while something is due. It claims due reminders once, encrypts each notification for the device (Web Push with VAPID, implemented on WebCrypto in `supabase/functions/_shared/webpush.ts`, no dependencies), only calls the browsers' own push services, and deletes subscriptions those services report as gone. Builds without `VITE_VAPID_PUBLIC_KEY` have no reminders.

To set it up:

1. Run `npm run vapid` once. Keep the private key out of the repo.
2. In Supabase → **Edge Functions → Secrets**, add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` plus a contact address) and `REMINDERS_CRON_SECRET` (a long random string, e.g. `openssl rand -hex 32`).
3. In the Supabase SQL editor, store the function's address and the same secret in Vault, where the cron job reads them:
   ```sql
   select vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
   select vault.create_secret('the same random string', 'reminders_cron_secret');
   ```
4. `npx supabase db push`, then `npx supabase functions deploy send-reminders` (JWT checking is off for it in `config.toml`; the shared secret guards it).
5. Add `VITE_VAPID_PUBLIC_KEY` (the public key) to Cloudflare's build variables and redeploy.

Generating new VAPID keys later means every device has to turn notifications on again. On iPhone and iPad, notifications only work once RanchRadar is added to the Home Screen.

## Roadmap

- **Done:** the local-first app, accounts with Google, Discord and email sign-in, cloud sync with guest merge and a conflict prompt, account deletion and data export, an age check, email delivery, bot protection, crash reporting, and weekly database backups, public regulation pages, and ad slots that stay off until AdSense approves the site, and ranch refresh and trial reminders by push notification.
- **Now:** a public launch and AdSense approval.
- **Later:** Pokémon HOME tracking, item and team tracking, a Champions news feed, and importing your box from screenshots.

## Contributing

Bug reports and data corrections are welcome as GitHub issues. A wrong or missing Pokémon in a regulation is the most useful kind, so please include where you saw the correct list.

## License

Copyright (C) 2026 codyhinz

RanchRadar is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3 of the License.

RanchRadar is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified version as a website, you must publish your changes under the same license.

The license covers the code only, not the RanchRadar name or logo. Forks must use a different name.

## Credits

- Pokémon data from [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) (MIT), via [`@pkmn/dex`](https://github.com/pkmn/ps).
- Multilingual names and sprites from [PokeAPI](https://github.com/PokeAPI/pokeapi) and its [sprite repository](https://github.com/PokeAPI/sprites).
- Fonts: [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/) and [Zilla Slab](https://github.com/mozilla/zilla-slab), both under the SIL Open Font License.

## Disclaimer

RanchRadar is an unofficial fan project and is not affiliated with, endorsed by, or sponsored by Nintendo, Game Freak, Creatures, or The Pokémon Company. Pokémon and all related names and images are trademarks of their respective owners.