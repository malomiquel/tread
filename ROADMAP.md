# Tread roadmap

What has been done, and what is left before the app can be sold, in the
order that serves one promise. Tick a box when it is done; add a line when
something new comes up.

- `[x]` done and verified in code (typecheck, lint, unit tests, bundle)
- `[ ]` to do
- Items marked **📱** are written but still need checking on a real phone.

---

## Positioning

> **The running app that knows nothing about you.**
> A plan that adapts to how you feel, your own routes, your progress —
> no account, no social network, and your runs never leave your phone.

For regular and newer runners training for a 10K or a half, put off by
Strava's feed or by Runna's price, in France and Europe first, where privacy
is an argument people act on. Priced well below the big names.

Every item below is judged against that line: does it keep the promise, make
the coach worth paying for, or prove that people want it? What would break the
promise is listed at the end, under "Not doing".

---

## Done

### First launch
- [x] Welcome in steps: what the app does → why you run → where you are →
  how often (slider, 1–4 runs a week) → permissions, with a progress bar, a
  way back and a way to skip
- [x] Permissions explained before the system asks; Health no longer asked at
  launch; refusals lead to "Open settings"
- [x] Runner profile from the answers: starting weekly goal, or the plan form
  opened once and pre-filled (distance, rhythm, longest run, volume)
- [x] Development-only "Replay the welcome" row in settings

### Navigation
- [x] App opens on Plan, the first tab
- [x] Tab bar: Plan · Parcours · run disc · Historique · Profil (before the
  run on the left, after it on the right)
- [x] Every empty tab shares one pattern: a rule, "Get started", action cards
  of fixed height
- [x] Header actions are icon + word (`HeaderButton`), never an icon alone

### Running
- [x] Route toggle on the run screen (pick or drop the route on the map)
- [x] Location refused → alert with "Open settings"
- [x] "How did it feel?" sheet at the end of a run; "Validate" never blocked
- [x] Auto-pause (opt-in): pauses after 10 s standing still, resumes on
  setting off, announced by voice and haptics
- [x] Pace drift, splits and spoken markers follow the chosen unit

### History
- [x] Month banner (this month vs last), sticky month headers with totals
- [x] Each run's outline drawn from a 60-point sample, cached
- [x] Weather and session kind marks on each run
- [x] "Import" button in the header once there are runs

### Profile
- [x] Built from the same parts as History: week banner with goal, sections,
  record rows with icons, all-time tiles
- [x] Weekly goal editable from Profile and from Settings (same sheet)

### Routes
- [x] Draw, edit (drag, delete points, undo), rename, delete from the editor
- [x] GPX import and share; map previews; play from the list
- [x] Search by name or place (accents ignored), sort (newest, nearest, most
  run, distance, name), filter chips (loops, one way, three lengths, never run)

### Settings
- [x] Grouped like the phone's own: Training, While running, App, Data, About
- [x] Runner profile page (why, where, how often)
- [x] Language: automatic / Français / English
- [x] Units: automatic / kilometres / miles
- [x] Data page: import runs, import routes, export all, switch phones
- [x] About: version, privacy, plan method, data-source credits, "Contact us"
  when an address is configured
- [x] Privacy page describing every request the app makes

### Language
- [x] French and English everywhere: screens, alerts, notifications, voice,
  share card, iOS permission texts, Live Activity (follows the phone)
- [x] Typed `{ fr, en }` string tables; stored identifiers in English;
  migration 16 rewrote older French identifiers; old transfer files converted

### Units
- [x] Everything stored metric; km/mi, min/km–min/mi, m/ft, km/h–mph, °C/°F
  converted at display
- [x] Splits per mile, voice per mile, weekly goal steps by the unit,
  Live Activity labels passed from the app **📱** (needs a native rebuild)

### Data
- [x] Phone transfer carries routes too; the chosen route stays behind
- [x] Weather and routing endpoints configurable at build time
  (`TREAD_WEATHER_URL`, `TREAD_WEATHER_KEY`, `TREAD_ROUTING_URL`)
- [x] Support address configurable (`TREAD_SUPPORT_EMAIL`)

### Quality
- [x] Pace rounding fixed (4'59"6 showed as 4'00")
- [x] `DESIGN.md` design system, loaded by `CLAUDE.md` in every session
- [x] 396 unit tests; typecheck, lint, expo-doctor 21/21, iOS bundle

### Earlier work
- [x] Weather before/after runs, forecasts on plan sessions, on the share card
- [x] Heart rate and zones from Health
- [x] Weekly goal, session reminders
- [x] Map replay, share as picture or GIF
- [x] Tag-driven Android APK releases, versions from the commit history

### Features shipped
- [x] **Route records**: a run counts for its route once it covers 90 % of
  it; best time shown in the list, and on each run "new best", "first time"
  or the gap to the best
- [x] **Ghost runner** 📱: on a route with a record, the best run replayed
  by active time as a hollow dot on the map, the gap in seconds on the status
  line beside the distance left, and after each kilometre by voice
- [x] **Custom sessions**: an editor (steps repeated ×N, blocks by effort,
  distance or time, figures by steps rather than typed), in the session
  picker under "My sessions" with a pencil to edit; migration 19; carried by
  transfer under the same id; the fixed catalogue is down to two classics
  (30/30 and 5 × 1000 m) plus a VMA test (half-Cooper, 6 min all out, the
  estimated VMA shown on the run, tips in the session sheet); older ones still named on past runs
- [x] **Shoe tracking**: Settings › Shoes (pairs in use and retired, distance
  already covered, limit 700 km by default, one default pair); every finished
  run counts for the default pair, changeable on the run's "Details"; "due for
  replacing" from 90 %; migration 20; carried by transfer
- [x] **Predicted race times** in Profile (5K, 10K, half, marathon): the
  fastest projection from the best efforts of the last 12 weeks, with the
  plans' endurance curve and weekly volume; a mile only reaches 10K
- [x] **Home-screen widget (iOS)** 📱: small (week and goal) and medium (plus
  the next session), in the app's language and units, refreshed at launch,
  after a run and when the app goes to the background; needs a native rebuild
- [x] **Home-screen widget (Android)** 📱: the same snapshot as iOS, drawn
  with react-native-android-widget; the week at 2×2, the next session beside
  it once widened; light and dark palettes; redrawn by the app and every
  30 min by a headless task; needs a native rebuild
- [x] **Android widget preview image** for the launcher's widget picker (`assets/images/widget-preview.png`) 📱
- [x] **Streaks**: weeks in a row on the weekly goal (or with a run, without
  a goal), as a tag on Profile's banner, and the longest in the records
- [x] **Recaps**: a month or a year on one picture the size of the run card
  (distance, runs and days, a bar per week or month, time, climb, longest,
  change on the period before); from History's month banner and Profile's
  year; steps back through past periods
- [x] **Privacy zones**: shared pictures and GIFs hide the track within
  200 m / 500 m / 1 km of the start and finish (Settings › Sharing, 200 m by
  default); figures stay the whole run's
- [x] **Best efforts**: fastest 400 m, 1 km, 1 mile, 5K, 10K, half and
  marathon found inside every run (interpolated, pauses excluded), with
  records in Profile and a "Record" mark on the run; older and imported runs
  worked out in the background
- [x] **Edit a run**: "Edit run" on a run's page: cut the start or the end
  by time (5 s steps, faster while held, the map shows what is kept), correct
  the distance; totals, records and laps recomputed, the Health copy replaced
- [x] **Add a run by hand**: History › "Add" (enter by hand or import GPX),
  and a card on the empty History: day, start time, distance, time and name
  by steps; no map, "entered by hand" on its page; counts for the default pair
- [x] **Charts on a run**: pace and heart rate (from Health, when a watch
  recorded it) against distance, lined up with the elevation profile
- [x] **Lap button** during a run, for track and hill repeats: under pause
  and stop, the lap said aloud, the lap under way on the status line, a
  "Laps" section on the run with the fastest one marked; carried by transfer
- [x] **Activity types and tags**: run, trail, treadmill, walk, hike (one per
  run, chosen on its "Details" and when entering a run by hand); tags race,
  long run, workout, easy run, recovery as chips; type and race shown in
  History; migration 21; carried by transfer
- [x] **Notes and photos** on a run 📱: a note under "Details", up to six
  photos copied into the app (the library keeps its own), shown full screen,
  removed with the run; migration 22; the note travels by transfer, the photos
  do not; expo-image-picker needs a native rebuild
- [x] **Grade-adjusted pace**: Minetti's cost of running on a slope, over
  stretches of 50 m or more, descents floored at 80 %; shown on a run beside
  the pace when it climbed 20 m or more and the two differ by 3 s or more
- [x] **Training calendar**: History › List / Calendar; months back to the
  first run, a dot per day sized by distance, week totals, tap a day to open
  its run
- [x] **Goals in time or climb**: the weekly goal sheet offers Distance /
  Time / Climb (each keeps its own figure); the week, the run screen, the
  streaks, Settings and the home widget follow it. **Year on year**: Profile
  › "In 2026" against last year at the same date
- [x] **Personal heatmap**: Profile › "Map of all your runs": every track
  sampled to ~150 points, translucent lines whose overlaps darken; opens on
  where most runs are; All / This year
- [x] **Route guidance** 📱: on a chosen route, the status line shows the
  distance left, the next turn within 200 m ("À gauche dans 80 m") and "Off
  route" after 10 s more than 40 m away; turns spoken 60 m ahead, leaving and
  finding the route again said aloud (leaving also buzzes twice); the run
  finishes by itself at the end of the route once 90 % of it is covered
  (not while a session is still under way)

---

## To do, in order

### 1. Keep the promise: nothing lost, nothing leaked
A private app that loses your history with your phone is not trusted twice,
and one that sends your position to others is not private.
- [x] **Automatic backup** without a Tread account, through the phone's own
  backup: iOS keeps everything in Documents (iCloud and computer backups);
  Android rules keep the database and route pictures in the Google backup
  (under its 25 MB cap, past which it would keep nothing) and the photos too
  on a direct phone-to-phone transfer; the database is checkpointed each time
  the app goes to the background; Settings › Data says where the copy is 📱
- [x] **Safety copy in the runner's own cloud** 📱: the "Switch phones" file
  written by the app after every run, on leaving the app and at launch, only
  when something changed — to iCloud Drive › Tread on iPhone, to a folder the
  runner picks once (Google Drive…) on Android; the 7 newest kept; Settings ›
  Data shows how fresh it is, makes one now, brings the newest back (merged,
  nothing duplicated); an empty app finding a copy offers it back once (a
  reinstall, a new iPhone). No Tread account, no server. The iCloud side
  needs the paid Apple account to run on a phone (see RELEASE.md)
- [x] **Automatic import of watch runs** from Apple Health 📱: Settings ›
  Data › "Runs from your watch" (off until asked, asks Health for workouts);
  running workouts other apps wrote (Apple Watch, Garmin through Health…),
  with their track, read by anchor at launch and on each return to the app;
  the app's own copies skipped, a run recorded by the phone at the same time
  kept once; indoor workouts become treadmill runs; "Imported from Apple
  Health · Apple Watch" on the run; editing or deleting it never touches the
  watch's workout; migration 24
- [x] **Health Connect** on Android 📱: the same jobs as Apple Health through
  one module — runs written with their route, distance and energy; weight and
  heart rate read back; runs from other apps (Samsung Health, Garmin, Google
  Fit, Fitbit…) imported by "Runs from your watch"; the store named per
  platform everywhere; Android 8 (API 26) minimum
- [ ] **Coarse positions to third parties**: weather and routing requests
  sent with coordinates rounded to about a kilometre, never a doorstep
- [ ] **App Store privacy label "Data Not Collected"**, checked against every
  request the app makes; no analytics or crash SDK (crashes through Apple's
  opt-in reports only)
- [ ] Privacy policy hosted at a public URL, written in plain words: what
  stays on the phone (everything) and the few requests that leave it
- [ ] Open-Meteo commercial subscription → `TREAD_WEATHER_URL` / `TREAD_WEATHER_KEY`
- [ ] Own routing server (OSRM or a provider) → `TREAD_ROUTING_URL`

### 2. The coach worth paying for
The reason to pay is a plan that fits the runner, not more charts.
- [ ] **Weather-aware plan**: offer to move a session when heavy rain is due
- [ ] **Custom voice cues**: every X minutes or X km, heart rate, time left
  in the session
- [ ] **Training load** from heart rate: relative effort per run, fitness and
  freshness over weeks, feeding the plan's easing
- [ ] Offer to update the weekly goal when the runner profile changes
- [ ] Target-pace stepper in miles: step per mile rather than 5 s/km
- [ ] "Fastest kilometre" record in miles: now covered by best efforts (1
  mile); drop or rename the old record

### 3. Prove it before scaling it
- [ ] Full pass on device, light and dark: welcome, slider, History, Profile,
  Settings, empty tabs, English, miles 📱
- [ ] Auto-pause outdoors: stops at a light, resumes on setting off, no false
  pauses in a tunnel or under trees 📱
- [ ] Native rebuild for the Live Activity unit fields, the translated
  permission texts (`locales/`) and `expo-localization` 📱
- [ ] Large text (iOS Dynamic Type): check fixed heights (empty-state cards,
  rows); cap `maxFontSizeMultiplier` where it breaks
- [ ] End-to-end tests (Maestro) for the main flows: welcome, start → finish
  a run, create a plan; add `testID`s
- [ ] **TestFlight beta with 20–30 runners** (friends, a club): ask "how
  would you feel if Tread disappeared tomorrow?" — aim for 40 % "very
  disappointed" before paying for launch; retention read from TestFlight and
  App Store Connect's opt-in figures, never from our own tracking

### 4. Launch and price
- [ ] **Tread Pro**: the core free (recording, history, simple routes); plans,
  guidance and ghost, heatmap, recaps, custom sessions and predictions in Pro.
  Annual subscription around 19,99 €/year with a free trial, or a one-time
  "pay once, keep it" price — decide from the beta. StoreKit / Play Billing
  directly (expo-iap) rather than a third party that would see every purchase
- [ ] Store listings in French and English, led by the positioning line
- [ ] Screenshots with realistic runs, in both languages, light and dark
- [ ] Terms of use / legal notice; trader status (EU DSA) and a business
  (micro-entreprise to start, a company to sell under another name)
- [ ] Support mailbox → `TREAD_SUPPORT_EMAIL`
- [x] Release setup in the repository: `eas.json`, `npm run release:ios` /
  `release:android` (local EAS builds, versions from git), export compliance
  declared, [RELEASE.md](RELEASE.md) with the steps and the TestFlight texts
- [ ] App Store Connect and Play Console setup, TestFlight / internal testing
  (accounts to pay for, then RELEASE.md)
- [ ] First tagged release built with the production configuration

### 5. Later: deepen, once people pay
- [ ] **End-to-end encrypted backup**, if testers ask to move between iPhone
  and Android or to use several devices: encrypted on the phone with a key
  only the runner holds (a recovery phrase), stored as unreadable blobs
  (S3 / Cloudflare R2), so the server knows nothing and holds no health data
  in the clear; a lost phrase cannot be recovered, by anyone. A Pro feature
  that keeps the promise. Never a central database in the clear with accounts
- [ ] **Watch app**: Apple Watch first, then Wear OS
- [ ] **Live heart rate** from a Bluetooth chest strap, with zone alerts
- [ ] **Offline maps** for routes without signal
- [ ] **Treadmill mode**: no GPS, distance from the pedometer, corrected at
  the end
- [ ] **Siri Shortcuts / App Intents**: "Start a run in Tread"
- [ ] **Safety**: share your live position with one person you choose, for
  the length of a run, directly and only then; alert after a long unexpected
  stop
- [ ] **Cadence chart**: needs steps recorded minute by minute during the run
- [ ] Live Activity labels in the app's chosen language, not the phone's
- [ ] More languages (the `{ fr, en }` tables are ready to take a third)

---

## Not doing
What would break the promise, kept here so it is not proposed again.
- **Accounts, a social feed, kudos, leaderboards**: the promise is that the
  app needs nothing from you and nobody watches
- **Ads, analytics or attribution SDKs**, and selling or sharing data
- **Automatic Strava upload**: it needs an account elsewhere and sends every
  run away; a runner who wants it has the GPX export, one run at a time
