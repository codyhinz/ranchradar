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
- **Nine languages.** Interface text, Pokémon names, and search in English, Japanese, Korean, Traditional and Simplified Chinese, French, German, Spanish, and Italian.
- **Accounts (in progress).** Sign in with Google, Discord, or email and password from the account button in the header; cloud sync across devices is being built.

## Tech stack

| Piece | Choice |
| --- | --- |
| App | React 18, TypeScript, Vite |
| Offline | Installable PWA (vite-plugin-pwa / Workbox), IndexedDB via `idb` |
| Backend | Supabase (Postgres, Auth, row-level security) |
| Hosting | Cloudflare Workers static assets |
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

Then apply the schema in `supabase/migrations/` to your project, and under Authentication → URL Configuration add `http://localhost:5173/**` as a redirect URL. Restart `npm run dev` after editing `.env.local`.

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

## Deployment

Cloudflare Workers Builds deploys `main` automatically, with a preview link for each pull request. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SENTRY_DSN` under the Worker's **Settings → Builds → Variables and secrets**. They're read at build time, and the build also writes the project's exact Supabase and Sentry origins into the Content-Security-Policy in `public/_headers`.

A scheduled GitHub Action pings Supabase every few days so the free-plan project never pauses. It needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repository secrets.

## Roadmap

- **Now:** accounts and cloud sync across devices, with guest data merged on sign-in and a side-by-side prompt for conflicting edits. Google and Discord sign-in.
- **Next:** launch readiness (account deletion, backups, privacy policy and terms), then a public launch.
- **Later:** trial reminders, Pokémon HOME tracking, item and team tracking, regulation pages, a Champions news feed, and importing your box from screenshots.

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