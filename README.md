# Tread

A running app with live GPS recording: distance, duration, current and average
pace, elevation gain, your route on a map, per-kilometre splits, personal
records, the weather you ran in, routes drawn before they are run, and local
history. A finished run draws
itself back on its map and leaves as a picture, a GIF or a GPX; the whole app
moves to a new phone in one file. Expo SDK 57, React Native, TypeScript.

## Trying it in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code. The run itself works — GPS, map, database, programme,
weather, GPX in and out, and the transfer by file. What is missing is
everything that needs a native module Expo Go does not carry: background
location, Apple Health, the Live Activity, reminders, the picture and GIF
exports, and the direct transfer over wifi. Each of those says so where it
would have been, rather than failing.

That list is why Expo Go is for a quick look rather than for running with.

## Building the real thing

Every native module is configured in `app.json`, so both of these need
nothing but the toolchain.

```bash
npx expo run:ios --device      # Xcode, and an iPhone plugged in
npx expo run:android           # Android Studio, or a device in debug mode
```

No EAS, no account, no queue — and nothing EAS would add that a Mac does not
already do. What EAS cannot help with either is Apple's price: TestFlight and
installing on somebody else's iPhone need the Developer Program whatever
builds the app. Signed with a free Apple ID, a build stops opening after
seven days and has to be installed again.

Android has a third way, which is the one that produces something to keep:
push a `v*` tag and the repository builds a signed APK and publishes it as a
release. `workflow_dispatch` on the same workflow builds one without creating
a release, for when you only want to try something.

## Checking it without a device

```bash
npm test          # every pure library, no phone involved
npm run typecheck
npx expo lint
npx expo-doctor
```

The same three the CI runs on every push, called through the same scripts —
a pipeline that checks something subtly different from what you run is a
pipeline that eventually disagrees with you.

## Architecture

```
src/lib/geo.ts        distance, filtering, pace, splits, elevation   pure, tested
src/lib/tracker.ts    the tracker: GPS, pauses, flushing to disk     external store
src/lib/db.ts         local SQLite, migrations, crash recovery
src/lib/location.ts   initial fix and one-off recentring
src/lib/format.ts     duration, pace, distance for display
src/lib/weather.ts    conditions now, at a run's hour, days ahead     pure, tested
src/lib/heart.ts      heart rate: weighted average, peak, zones       pure, tested
src/lib/replay.ts     drawing a finished run back at its own pace     pure, tested
src/lib/route.ts      routes drawn before they are run               pure, tested
src/lib/gif.ts        frames in, one animated GIF out                 pure, tested
src/lib/raster.ts     drawing a line into pixels, by hand            pure, tested
src/lib/reminders.ts  when a planned session is announced             pure, tested
src/lib/transfer.ts   the whole app as one file, for a new phone      pure, tested
src/lib/handover.ts   the same, served over the wifi to a QR scan     pure, tested
src/lib/stats.ts      weeks, records, the weekly goal                 pure, tested
src/app/(tabs)/       Plan, History, Routes, Profile
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

**The shared animation is photographed once, then drawn into.** A GIF over a
video because it plays by itself, inline, wherever somebody pastes it — no
player, nothing to tap. The first version captured the screen and decoded a
PNG for every one of its forty frames: the two most expensive things a phone
can be asked for, done forty times, which took most of a minute and showed
every step of it. Now the card is photographed once, without its track, and
each frame is those same pixels with a little more route drawn into them by
hand — the line only ever grows, so a frame costs the few hundred dabs of
colour it adds and a palette pass, nothing else.

Drawing the line ourselves means it and the map must agree about where a
coordinate falls, so the region handed to the map is fitted to the card's
shape first: a map asked for a picture of a differently shaped region widens
one axis in silence, and the line would land somewhere else. The line is dimmed
across the band where the card's gradient darkens the picture, since that
gradient is already in the photograph and a route reaching into the text would
otherwise cross it at full strength. The palette is quantised once, from the
finished frame, the only one holding every colour the animation will ever show;
per-frame palettes cost the same work thirty times and make the map flicker
between shades as the line grows.

**A replay lasts the same twelve seconds whatever the run.** Drawing a
finished track back at the speed it was run is only worth doing if the speed
survives the compression, and a duration that scaled with the run would be
exactly what flattens it: every replay would advance at the same apparent rate
and no hill would ever show. At a fixed total, one second of animation is the
same number of seconds of running whatever the outing, so the only thing that
slows the line down is the runner having slowed down. Pauses are skipped — and
so is any gap over twenty seconds, which is a lost signal rather than a rest —
because a replay that sits still for eleven minutes at a level crossing is one
nobody watches to the end. The track is thinned to six hundred points first,
keeping both ends and every segment boundary: a polyline rebuilt from five
thousand fixes twenty-five times a second stutters, and a lost boundary would
draw a line straight across a pause.

**A drawn route keeps the taps, not just the line.** Tapping a map builds a
route leg by leg, each leg asked of OpenStreetMap's walking router — keyless,
like the weather, because an app on other people's phones cannot keep a
secret. Both lists are stored: what the finger put down, and the paths the
streets actually take between them. Keeping only the drawn line would make
every mistake unpickable, since undo has to take back a decision rather than
a few hundred points of pavement. The router is a convenience and not a
dependency: the straight line is drawn the instant a finger lands and
replaced when the answer comes, so a route can still be drawn on a train with
no signal, wrong about the streets and right about the intention.

Routes go out as GPX and come back the same way — as a `<trk>` rather than
the `<rte>` the format intends for a plan, because watches and websites read
tracks everywhere and routes unevenly. What makes it a route rather than a run
is what is missing: no time on any point, so a reader that insists on seeing a
run finds one of no duration, which is visibly not a run rather than quietly a
wrong one.

A route imported from GPX has no taps in it — a file is a few hundred points
and no decisions — so handles are invented along it at even intervals, and the
geometry between them is kept exactly as the file has it. That gives an
imported route the same shape as a drawn one, which is what lets it be dragged
about and cut like any other; the line itself is never simplified, because
what was imported is what will be run.

**The heart rate is read, never measured.** A watch is already recording one
every few seconds into Health, so the app asks for it afterwards instead of
holding a sensor open during the run. It is asked for again on every visit to
a run that has none, because the three things it depends on each arrive at
their own pace: the watch syncs when it likes, permission can be granted weeks
later, and an imported run was never asked at all. Zones are cut against
220 − age, which is a rule of thumb — the screen says as much under them.

**A new phone gets the whole app, two ways.** Everything travels as one
versioned, compressed file: runs, tracks, programme, exertions, weather, heart
and settings. It goes over the local network — the sending phone serves it and
shows a QR code, the receiving one scans and downloads, and neither leaves the
app — or through the share sheet, by AirDrop, Quick Share, Bluetooth, a message
or a cable. The second way exists because the first cannot be relied on: cafés
and hotels routinely stop their clients talking to one another, and an iPhone
and an Android are rarely on the same Wi-Fi at all.

The server is up for two minutes at most, stops the moment its screen is left,
and serves a folder holding one file whose name is a hundred-and-thirteen-bit
token. The scanner refuses anything but a private address and that exact file
shape, because a QR code is a url a stranger could have printed. Android needs
cleartext http enabled for it, since the phone on the other side has no
certificate to offer; that is the `expo-build-properties` line in `app.json`.

Both ways share the same rules: the reader refuses a file from a newer version
rather than guessing at it, the screen says what the file holds before anything
is written, and the import is idempotent — a run is recognised by the moment it
started, so the same transfer taken twice adds nothing.

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

- **Expo Go**: the run works, half the app does not — see the top of this
  file for which half and why.
- **No sync**: runs stay on the phone. Moving to another one is a direct
  transfer, see above; the database layer is isolated in one file, ready for
  Supabase if that ever changes.
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
