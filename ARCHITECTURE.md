# Architecture

Tread is a pnpm monorepo: the phone app, the web app, the landing page and
the code they share.

```
apps/
  mobile/     The Expo app (iOS, Android). Everything that needs the phone:
              GPS, SQLite, Health, widgets, the Live Activity, notifications.
  web/        Next.js. Tread in the browser: history, an outing with its map,
              the plan, routes, profile, behind a Tread account. Also the
              server: Better Auth (/api/auth) and the sync (/api/sync).
              Port 3020.
  landing/    Astro. The public page, static, in French and English. Port 3021.
packages/
  core/       @tread/core: what Tread knows without a phone. The maths of a
              run (geo, pace, splits, efforts, predictions, plans), GPX in and
              out, units and formatting, the two languages (i18n) and the
              colours (palette).
  db/         @tread/db: the server database. The Prisma schema (accounts
              and what the phone sends), its migrations and the client.
              Server only: the phone app never imports it.
```

## Decisions

Taken on 2026-11-18, when the single Expo project (until then in
`~/Desktop/Projets/expo/tread`) became this monorepo, in
`~/Desktop/Projets/monorepo/tread`, history kept.

### pnpm workspaces, no Turborepo

The repository already used pnpm; `pnpm-workspace.yaml` and `pnpm -r` /
`pnpm --filter` are all two apps and one package need. Turborepo would bring
a task cache and parallel runs: worth adding the day typecheck and tests get
slow enough to wait on, not before.

`nodeLinker: hoisted` stays (it moved from `.npmrc` into
`pnpm-workspace.yaml`): Metro, CocoaPods and Gradle find packages by walking
up from the app, and expect one flat `node_modules` at the root.

### A separate Next.js app for the web

Not Expo web. The phone app is built around what a browser does not have —
`react-native-maps`, HealthKit, background location, SQLite on the device —
and around a phone's layout. A web version of it would mean a web stand-in
for every one of those and a page laid out for a thumb. The web app is
written for a large screen instead, and shares everything that is not UI
through `@tread/core`.

### Accounts and sync: Supabase, Prisma, Better Auth

Decided on 2026-11-19, replacing "no backend yet". The phone stays
local-first: SQLite on the device is the source, the app works signed out,
and the safety copy still goes to the runner's own cloud. Signed in, it also
sends its history to a Tread account, which the web app reads.

- **Postgres on Supabase** (project `tread`, eu-west-3), used as a plain
  database: no Supabase Auth, no Data API. Every table has row level
  security switched on and no policy, so the anon and authenticated roles
  read nothing; only the web app's server, connecting as the owner, does.
- **Prisma 7** in `packages/db`: `schema.prisma`, migrations, and the client
  with the `pg` driver adapter. Both connect as `tread_app`, a role made for
  this server alone, which owns its tables: the app through the transaction
  pooler (`DATABASE_URL`, port 6543), migrations through the session pooler
  (`DIRECT_URL`, port 5432; the direct host is IPv6 only). TLS is verified
  against Supabase's own root authority, bundled in `packages/db/src/supabaseCa.ts`.
- **Better Auth**, e-mail and password, with its Prisma adapter, mounted in
  the web app at `/api/auth`. The phone signs in through the same endpoints
  with `@better-auth/expo`, its session in the keychain (`expo-secure-store`).
  An address must be confirmed before it signs in; links are e-mailed through
  Resend, or printed in the server's log in development.

**What travels is the file the app already writes.** The phone posts the
same `Transfer` that "Switch phones" and the safety copy hold
(`@tread/core/transfer`, zipped and base64) to `/api/sync`, after every run,
a few seconds after launch and when the app goes to the background, if its
data fingerprint moved. Only the runs new or changed since they were last
sent go, at most about 5,000 fixes per request (`@tread/core/sync`): the
phone keeps each sent run's signature (`accountSyncedRuns`), so a long
history is neither packed on every launch nor larger than the server takes.
The rest of the state (plan, routes, shoes, settings) goes with each request.
The safety copy, which holds everything, is written run by run to a file and
zipped by a small native module (`apps/mobile/modules/zip-file`, Swift and
Kotlin) off the JavaScript thread; without it (Expo Go) it falls back to
JSZip.
The browser can upload that file too, or GPX files. One format, one reader
(`apps/web/src/lib/server/ingest.ts`), whichever door it comes in by.

An outing is known by when it started (`userId, startedAt` is unique). Sent
again, it is updated with what the phone now says about it (name, type,
rating, shoes); its track is stored once, apart from it (`track`), so a list
never loads one. Nothing is deleted for being missing from what arrives: a
reinstalled phone with an empty database would otherwise empty the account.
Deleting is said out loud instead: the phone keeps the start of every run it
deletes (`@tread/core/sync`) and sends the list with the next sync
(`deleted`), which the server deletes before reading the rest.

Best efforts and the outline drawn in a list are worked out on arrival and
stored with the outing, so the profile never reads tracks.

### Hosting

The web app runs on Vercel (project `tread-web`, root directory `apps/web`,
https://tread-web-omega.vercel.app). Its environment holds `DATABASE_URL`,
`DIRECT_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`; `.vercelignore`
keeps the phone app's native folders out of the upload. A release build of
the phone app talks to that address, a development build to localhost.

No e-mail is sent at sign-up for now: an account is usable as soon as it is
created. Password reset e-mails need `RESEND_API_KEY`; without it they are
not sent (a warning in the log).

### The web pages

Server components read the database, narrowed to the signed-in person, and
hand plain data to client components that format it. Formatting is done
where `<Locale>` has set the language and units every formatter in
`@tread/core` reads: module-wide values, as on the phone, set in render with
no Suspense boundary below, so one request cannot slip into another's. The
language comes from a cookie the settings write, else the browser; the units
from the phone's own setting, else the browser's region.

Maps are MapLibre GL 5 on OpenFreeMap's tiles: no key, no account. (MapLibre
6 loads its worker as a separate module, which Turbopack does not serve.)

### The landing page is its own Astro site

The landing page is the one part of Tread a search engine should read, and
the web app is the one part it should not (it reads private files, and will
sit behind an account). So they are two packages:

- `apps/landing`, Astro: static HTML with no client JavaScript at all, French
  at `/` and English at `/en/`, `hreflang` alternates, a sitemap and a
  `robots.txt` built from `SITE_URL`. It shares TypeScript only — strings
  through `defineStrings`, colours through `@tread/core/palette` — never a
  React Native component.
- `apps/web`, Next.js: marked `noindex`, every page but the account ones
  behind a session. Its address is given to the landing
  page as `PUBLIC_WEB_URL`, and the landing page's to it as
  `NEXT_PUBLIC_LANDING_URL` (both default to localhost in development).

`typecheck` runs `astro sync && astro-check` rather than `astro check`: the
latter offers to install `@astrojs/check` when it cannot see it from the
package, and waits on the answer. `@napi-rs/wasm-runtime` is listed in the
landing's devDependencies only because `@astrojs/check` loads it without
declaring it.

## @tread/core

- Plain TypeScript, no build: `exports` maps `@tread/core/<module>` to
  `src/<module>.ts`. Metro and Next (`transpilePackages`) compile it with the
  app that imports it; Node runs its tests with `--experimental-strip-types`.
- `palette` holds every colour as a light/dark pair. The phone turns each
  pair into a dynamic colour (`theme.ts`); the web and the landing page
  inject `paletteCss()` as CSS variables (`accentSoft` → `--accent-soft`).
- `i18n` and `units` import React as a namespace, not `useSyncExternalStore`
  by name: Next refuses a server component that imports a hook by name, and
  their tables are read on the server.
- Nothing native. A module that imports `react-native`, an `expo-*` package
  or a native module (`liveActivity.ts`, `theme.ts`, `db.ts`…) stays in
  `apps/mobile/src/lib`. `react` is allowed: `i18n` and `units` expose hooks.
- A module that only needs a type from the app reads a structural type
  instead (`stats.ts` sums any `RunFigures`), so the phone and the server
  add up the same way.

## Commands

From the root:

| Command | What it does |
|---|---|
| `pnpm start` | Metro for the phone app, port 8082 |
| `pnpm web` | The web app, http://localhost:3020 |
| `pnpm landing` | The landing page, http://localhost:3021 |
| `pnpm db:migrate` | A new Prisma migration, against `DIRECT_URL` (`packages/db/.env`), and the client regenerated |
| `pnpm db:deploy` | The migrations applied to the database (Supabase) |
| `npm run deploy:ios` | Release build on the plugged-in iPhone (`apps/mobile/scripts/deploy-ios.sh`) |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` | `expo lint` in the phone app |
| `pnpm test` | Every package's tests (core, db, web and mobile) |
