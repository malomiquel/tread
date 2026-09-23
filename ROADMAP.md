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
- [x] 302 unit tests; typecheck, lint, expo-doctor 21/21, iOS bundle

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
- [ ] "Fastest kilometre" record in miles: store and show a fastest mile
- [ ] Offer to update the weekly goal when the runner profile changes
- [ ] More languages (the `{ fr, en }` tables are ready to take a third)

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
