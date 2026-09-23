# Tread roadmap

What has been done, and what is left before the app can be sold. Tick a box
when it is done; add a line when something new comes up.

- `[x]` done and verified in code (typecheck, lint, unit tests, bundle)
- `[ ]` to do
- Items marked **📱** are written but still need checking on a real phone.

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
- [x] 354 unit tests; typecheck, lint, expo-doctor 21/21, iOS bundle

### Earlier work
- [x] Weather before/after runs, forecasts on plan sessions, on the share card
- [x] Heart rate and zones from Health
- [x] Weekly goal, session reminders
- [x] Map replay, share as picture or GIF
- [x] Tag-driven Android APK releases, versions from the commit history

---

## To do

### Code, to check on a phone 📱
- [ ] Full pass on device, light and dark: welcome, slider, History, Profile,
  Settings, empty tabs, English, miles
- [ ] Auto-pause outdoors: stops at a light, resumes on setting off, no false
  pauses in a tunnel or under trees
- [ ] Native rebuild (`npx expo prebuild`) for the Live Activity unit fields,
  the translated permission texts (`locales/`) and `expo-localization`
- [ ] Large text (iOS Dynamic Type): check fixed heights (empty-state cards,
  rows); cap `maxFontSizeMultiplier` where it breaks

### Code, still to write
- [ ] Health Connect on Android (Apple Health only today)
- [ ] Automatic backup: iCloud on iOS, Auto Backup rules on Android
- [ ] End-to-end tests (Maestro) for the main flows: welcome, start → finish
  a run, create a plan; add `testID`s
- [ ] Live Activity labels in the app's chosen language, not the phone's
- [ ] Target-pace stepper in miles: step per mile rather than 5 s/km
- [ ] "Fastest kilometre" record in miles: now covered by best efforts (1
  mile); drop or rename the old record
- [ ] Offer to update the weekly goal when the runner profile changes
- [ ] More languages (the `{ fr, en }` tables are ready to take a third)

### Feature ideas, by priority

High value, moderate effort
- [x] **Route records**: a run counts for its route once it covers 90 % of
  it; best time shown in the list, and on each run "new best", "first time"
  or the gap to the best
- [ ] **Ghost runner**: your best run on a route, moving on the map as you
  run it
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
- [ ] **Android widget preview image** for the launcher's widget picker
- [x] **Streaks**: weeks in a row on the weekly goal (or with a run, without
  a goal), as a tag on Profile's banner, and the longest in the records
- [ ] **Recaps**: a monthly and yearly recap to share, like the run card
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
- [ ] **Cadence chart**: needs steps recorded minute by minute during the run
  (only the average is kept today, and the pedometer's history is short)
- [x] **Lap button** during a run, for track and hill repeats: under pause
  and stop, the lap said aloud, the lap under way on the status line, a
  "Laps" section on the run with the fastest one marked; carried by transfer
- [ ] **Activity types and tags**: walk, hike, trail, treadmill; race, long
  run, workout
- [ ] **Notes and photos** on a run
- [ ] **Grade-adjusted pace** (the flat equivalent, for trail)
- [ ] **Training calendar**: the log week by week, beside the list
- [ ] **Goals in time or climb**, not only distance; year-on-year comparison
- [ ] **Personal heatmap**: every run on one map

High value, large effort
- [ ] **Strava upload** after each run (OAuth, activity upload API)
- [ ] **Watch app**: Apple Watch first, then Wear OS
- [ ] **Live heart rate** from a Bluetooth chest strap, with zone alerts
- [ ] **Automatic import of watch runs** from Apple Health (then Garmin),
  instead of GPX files
- [ ] **Route guidance**: off-route alert, turn cues, distance left
- [ ] **Offline maps** for routes without signal
- [ ] **Training load**: relative effort from heart rate; fitness and
  freshness curves

Comfort and safety
- [ ] **Treadmill mode**: no GPS, distance from the pedometer, corrected at
  the end
- [ ] **Custom voice cues**: every X minutes or X km, heart rate, time left
  in the session
- [ ] **Weather-aware plan**: offer to move a session when heavy rain is due
- [ ] **Siri Shortcuts / App Intents**: "Start a run in Tread"
- [ ] **Safety**: share live location with someone during a run; alert after
  a long unexpected stop

### Before selling (not code)
- [ ] Open-Meteo commercial subscription → set `TREAD_WEATHER_URL` / `TREAD_WEATHER_KEY`
- [ ] Own routing server (OSRM or a provider) → set `TREAD_ROUTING_URL`
- [ ] Support mailbox → set `TREAD_SUPPORT_EMAIL`
- [ ] Privacy policy hosted at a public URL (required by both stores)
- [ ] Terms of use / legal notice
- [ ] Business model: paid app, subscription or freemium (RevenueCat if subscription)
- [ ] Store listings in French and English: description, keywords, category
- [ ] Screenshots with realistic runs, in both languages, light and dark
- [ ] App Store Connect and Play Console setup, TestFlight / internal testing
- [ ] First tagged release built with the production configuration
