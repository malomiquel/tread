# Tread roadmap

What has been done, and what is left before the app can be sold, in the
order that serves one promise.

- **Done** is kept here, by area. `[x]` means done and verified in code
  (typecheck, lint, unit tests, bundle); **📱** marks what still needs
  checking on a real phone.
- **To do** lives on GitHub: one [issue](https://github.com/malomiquel/tread/issues)
  per item, grouped by stage in [milestones](https://github.com/malomiquel/tread/milestones),
  labelled by area (`area: plan`, `area: privacy`…) and by what it waits on
  (`needs device`, `native rebuild`, `needs paid account`, `pro`). The list
  below names each stage and links to it. When something is finished, its
  issue is closed and a line is added under Done.

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
- [x] **Pace dashboard while running** ([#39](https://github.com/malomiquel/tread/issues/39)):
  a verdict chip, the pace of the moment large, a gauge read like a
  speedometer, the block under way; Pace / Map at the top; a pause shown on
  the status line and the dashboard; the weather while running
- [x] **Cycling** ([#37](https://github.com/malomiquel/tread/issues/37)): Run / Ride on the run screen, remembered; a ride reads in
  speed (dashboard, panel, its page, splits, chart, share card), says its
  distance and speed every 5 km, has no session, cadence or best efforts,
  wears no shoes, and counts in none of a runner's totals or records; route
  records and ghosts per sport; written to Health as cycling (distance
  cycling, energy from METs by speed), rides brought in from Health and
  Health Connect, GPX `<type>cycling</type>` both ways

### History
- [x] Month banner (this month vs last), sticky month headers with totals
- [x] Each run's outline drawn from a 60-point sample, cached
- [x] Weather and session kind marks on each run
- [x] "Import" button in the header once there are runs

### Plan
- [x] Plan setup in steps (race, date, rhythm and days, fitness today, target
  time) with a recap of every answer before the plan is made, each line
  opening its step again
- [x] **Beginners start on run-walk** ([#38](https://github.com/malomiquel/tread/issues/38)):
  under twenty minutes of running without stopping, the plan starts from a
  minute's running at a time on the couch to 5K ladder, by feel, no pace
- [x] A skipped session can be put back in the plan; plan dates through the
  locale; a past race says how long ago it was

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
- [x] 417 unit tests; typecheck, lint, expo-doctor 21/21, iOS bundle
- [x] **UX review of every screen** ([#40](https://github.com/malomiquel/tread/issues/40)):
  a double tap no longer starts two runs, a failed save keeps the run and
  finish retryable, a short run can be kept going; a failed read shows
  `LoadError` ("Try again") instead of an empty page; a drifted database is
  repaired at launch; editors guard unsaved changes; a just-finished run
  closes with Done; the welcome keeps its answers and has a way back
- [x] GitHub: issues, milestones and labels (`.github/labels.json`, synced
  by a workflow), issue forms and a pull request template

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

Each stage is a milestone on GitHub; each item, an issue in it. Open ones
first, in the order below.

1. **[Keep the promise](https://github.com/malomiquel/tread/milestone/1)**:
   nothing lost, nothing leaked. A private app that loses your history with
   your phone is not trusted twice, and one that sends your position to
   others is not private. Backup, the safety copy in the runner's own cloud
   and the Health imports are done; left: the privacy label and policy, and
   the weather and routing services of our own.
2. **[The coach worth paying for](https://github.com/malomiquel/tread/milestone/2)**:
   the reason to pay is a plan that fits the runner, not more charts.
   Weather-aware plan, custom voice cues, training load from heart rate.
3. **[Prove it before scaling it](https://github.com/malomiquel/tread/milestone/3)**:
   every main flow checked on a phone, end-to-end tests, then a TestFlight
   beta with 20 to 30 runners.
4. **[Launch and price](https://github.com/malomiquel/tread/milestone/4)**:
   Tread Pro, store listings, legal, the first production release.
5. **[Later](https://github.com/malomiquel/tread/milestone/5)**: deepen,
   once people pay. Encrypted backup, watch app, live heart rate, offline
   maps, ride totals of their own.

---

## Not doing
What would break the promise, kept here so it is not proposed again.
- **Accounts, a social feed, kudos, leaderboards**: the promise is that the
  app needs nothing from you and nobody watches
- **Ads, analytics or attribution SDKs**, and selling or sharing data
- **Automatic Strava upload**: it needs an account elsewhere and sends every
  run away; a runner who wants it has the GPX export, one run at a time
