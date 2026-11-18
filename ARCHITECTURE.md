# Architecture

Tread is a pnpm monorepo: the phone app, the web app, the landing page and
the code they share.

```
apps/
  mobile/     The Expo app (iOS, Android). Everything that needs the phone:
              GPS, SQLite, Health, widgets, the Live Activity, notifications.
  web/        Next.js. The outings viewer, in the browser. Port 3020.
  landing/    Astro. The public page, static, in French and English. Port 3021.
packages/
  core/       @tread/core: what Tread knows without a phone. The maths of a
              run (geo, pace, splits, efforts, predictions, plans), GPX in and
              out, units and formatting, the two languages (i18n) and the
              colours (palette).
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

### No backend yet: the browser reads files

The phone stays local-first: SQLite on the device, a copy in the user's own
iCloud. The web app has no account and no server: it opens GPX files, or the
"All my runs" archive the app exports, and reads them in the browser. Nothing
is uploaded.

A Strava-like web app, where outings recorded on the phone appear on their
own, needs accounts and a sync between the phone's SQLite and a server
database. That is its own project, and the layout is ready for it: the
server would be a new `apps/api` (or route handlers in `apps/web`), and the
shapes it stores would come from `@tread/core`.

The landing page does not sell "no server" for that reason: the day the
phone and the browser share outings, there will be one. It sells what the
app does — the ghost, the voice, the plan, grade-adjusted pace, the
heatmap — instead.

### The landing page is its own Astro site

The landing page is the one part of Tread a search engine should read, and
the web app is the one part it should not (it reads private files, and will
sit behind an account). So they are two packages:

- `apps/landing`, Astro: static HTML with no client JavaScript at all, French
  at `/` and English at `/en/`, `hreflang` alternates, a sitemap and a
  `robots.txt` built from `SITE_URL`. It shares TypeScript only — strings
  through `defineStrings`, colours through `@tread/core/palette` — never a
  React Native component.
- `apps/web`, Next.js: marked `noindex`. Its address is given to the landing
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
- A module that only needs a type from the app (`stats.ts` reads `Run` from
  `db.ts`) stays in the app until that type moves to core.

## Commands

From the root:

| Command | What it does |
|---|---|
| `pnpm start` | Metro for the phone app, port 8082 |
| `pnpm web` | The web app, http://localhost:3020 |
| `pnpm landing` | The landing page, http://localhost:3021 |
| `npm run deploy:ios` | Release build on the plugged-in iPhone (`apps/mobile/scripts/deploy-ios.sh`) |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` | `expo lint` in the phone app |
| `pnpm test` | Every package's tests (core and mobile) |
