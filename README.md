# Tread

A running app with live GPS recording: distance, duration, current and average
pace, elevation gain, your route on a map, per-kilometre splits, personal
records, the weather you ran in, and local history. Expo SDK 57, React Native,
TypeScript.

## Running it on your phone

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. Everything works: GPS, map, local database.
One limitation only, the screen has to stay awake while you run, and the app
takes care of that. GPS stops with the screen inside Expo Go; that is a system
constraint, not an app one.

## Getting locked-screen tracking

Expo Go does not offer background location. That needs a development build, a
version of the app bundling the native modules. With no Xcode on this machine,
it gets made in the cloud:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

Install the result on your phone, then `npx expo start` as before. The app
detects background availability on its own and switches over. Everything is
already configured in `app.json`: iOS background mode, permission prompts, and
the Android foreground service.

## Checking it without a device

```bash
npm test          # GPS maths, 14 tests
npm run typecheck
npx expo lint
npx expo-doctor
```

## Architecture

```
src/lib/geo.ts        distance, filtering, pace, splits, elevation   pure, tested
src/lib/tracker.ts    the tracker: GPS, pauses, flushing to disk     external store
src/lib/db.ts         local SQLite, migrations, crash recovery
src/lib/location.ts   initial fix and one-off recentring
src/lib/format.ts     duration, pace, distance for display
src/lib/weather.ts    conditions now, at a run's hour, days ahead     pure, tested
src/lib/heart.ts      heart rate: weighted average, peak, zones       pure, tested
src/lib/reminders.ts  when a planned session is announced             pure, tested
src/lib/stats.ts      weeks, records, the weekly goal                 pure, tested
src/app/(tabs)/       Run, Progress, History
src/app/run/[id]      one run in detail
src/app/settings/     settings, one page per subject
src/components/       RunMap, Metric, Button
```

## Decisions that matter

**GPS lies, so it gets filtered.** A fix whose accuracy exceeds 30 m is
dropped, which is typical of an indoor start. A fix implying more than
43 km/h is a GPS jump, not a runner. Movement under 1.5 m is jitter while
standing still. Without those three rules a 5 km run reads as 5.8 km and the
track zigzags through buildings.

**A pause cuts the track.** Every resume opens a new segment. Distance never
joins two segments, otherwise the 200 m you walked to the traffic light would
count. The map draws one polyline per segment, and splits work in active time,
so a pause during kilometre 3 does not stretch kilometre 3.

**Markers are interpolated.** A kilometre boundary falls between two fixes.
Rounding to the nearest one shifts every split by several seconds, so the
crossing is interpolated inside the leg that spans it.

**Current pace reads 30 seconds.** Fix to fix it leaps from 4'10 to 6'30 on
every update. Over 30 seconds it stays readable while still reacting to a
genuine change of rhythm within about ten seconds.

**Elevation is smoothed before it is measured.** Altitude is the least
reliable figure the GPS gives us. A moving average absorbs the wobble of a
stationary device, then hysteresis only banks a climb past a 4 m threshold.
Smoothing understates a short hill slightly, which beats inventing hundreds of
metres of climb on flat ground.

**Nothing is lost.** The run is created in the database at the start, and
points are written in batches of twenty. If the system kills the app at
kilometre 8, the points are on disk: the next launch rebuilds the run and
closes it with its real totals.

**Two GPS layers, one stream.** In a build, the background task receives fixes
even with the screen locked. Inside Expo Go a foreground subscription takes
over. Both call the same function, and the rest of the app never knows which
one is live.

**The weather costs nothing and gives nothing away.** Open-Meteo asks for no
account and no key, so there is no secret to ship inside an app that runs on
other people's phones. Coordinates are rounded to two decimals — a little over
a kilometre, which is finer than the model's own grid — because a run starts
at a front door and the full fix is that door. The reading is taken once the
run is already saved and never blocks it: no network means no weather, and
every screen that shows one is written to look complete without it. The plan's
forecast goes further and never prompts at all — it uses the fix the system
already has, because a permission dialog raised by a page of dates is one
nobody expects and most refuse.

**The heart rate is read, never measured.** A watch is already recording one
every few seconds into Health, so the app asks for it afterwards instead of
holding a sensor open during the run. It is asked for again on every visit to
a run that has none, because the three things it depends on each arrive at
their own pace: the watch syncs when it likes, permission can be granted weeks
later, and an imported run was never asked at all. Zones are cut against
220 − age, which is a rule of thumb — the screen says as much under them.

**A reminder is rewritten, never reconciled.** A plan reshapes itself
constantly: a missed week slides every date, a hard session lightens the next
one, a finished run ticks one off. Working out which of yesterday's pending
notifications are still right would cost more than asking again, so the whole
list is cancelled and rebuilt on every visit to the plan. Ten at a time,
because iOS keeps sixty-four and drops the rest in silence.

**Records are read in SQL.** Every run stores its own totals, including its
fastest kilometre computed at the finish. Answering a ranking question never
replays a single GPS point.

## Known limitations

- **Expo Go**: screen-on tracking only, see above.
- **No sync**: runs stay on the phone. The database layer is isolated in one
  file, ready for Supabase.
- **No heart rate of its own**: a phone cannot measure one. What a watch
  wrote into Apple Health is read back and shown with the run; without a
  watch there is nothing to read.
- **Android outside Expo Go**: Google Maps needs an API key in `app.json`.
- **The database file is still named `running.db`.** Renaming it would hide
  runs already recorded on a device, for a purely cosmetic gain nobody sees.

## Possible next steps

1. Auto-pause at traffic lights.
2. Apple Health import for runs recorded on a watch.
3. Supabase sync and backup.
