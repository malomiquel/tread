# Tread design system

How Tread looks, and why. Every value here is the one in the code; when they
disagree, the code is right and this file is out of date.

- Colours: `packages/core/src/palette.ts`, the one source. The phone reads
  them through `apps/mobile/src/lib/theme.ts`; the web app and the landing
  page as CSS variables (`paletteCss()`, `accentSoft` → `--accent-soft`)
- Other tokens: `apps/mobile/src/lib/theme.ts`, `apps/mobile/src/lib/layout.ts`
- Strings: `packages/core/src/i18n.ts` (see [Language](#language))
- Components: `apps/mobile/src/components/`

---

## Principles

1. **Say it in words.** An action is an icon *and* a word, never an icon on
   its own. A bare arrow meant "import" to whoever drew it and "download" to
   everybody else.
2. **One shape per idea.** A banner, a section heading, an empty page, a
   settings block: each exists once, as a component, and every screen uses it.
   Two screens that look alike must be built from the same parts.
3. **One stage per page.** The page is neutral, its lead figure is not: it
   stands on the cobalt stage (`SummaryBanner`), very large, with the
   figures that go with it in glass, as the landing page stages the phone.
   Elsewhere blue still marks what is yours, active or next, never decoration.
4. **Loud figures, quiet words.** Headings and figures are bold and tight,
   the way the landing page sets them; running text stays regular and
   muted. Blocks of a page sit in rounded panels (`Panel`), not on rules.
5. **Nothing moves by itself.** Heights are reserved: a sentence that might
   wrap takes two lines' room whether it needs them or not, so switching tabs
   never shifts content.
6. **The run comes first.** One tap from anywhere starts a run: the disc in
   the middle of the tab bar.

---

## Colour

Every colour is a token with a light and a dark value. On iOS the token
resolves per appearance at draw time (`DynamicColorIOS`); on Android it is
read once at launch.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#ffffff` | `#0b0b0c` | Page, sheets, opaque rows |
| `sunken` | `#f4f4f4` | `#18181a` | Settings blocks, pressed rows, icon tiles, run shapes |
| `hairline` | `#e6e6e6` | `#2b2b2e` | Rules, card borders, inactive ticks |
| `text` | `#101010` | `#f2f2f3` | Headings, names, figures |
| `muted` | text at 62 % | text at 62 % | Body text, secondary figures |
| `subtle` | text at 42 % | text at 44 % | Captions, units, group labels, chevrons |
| `accent` | `#00348f` | `#6fa8ff` | Primary action, selection, banners, active tab |
| `accentText` | `#ffffff` | `#04101f` | Text and icons **on** `accent` |
| `accentSoft` | accent at 12 % | accent at 18 % | Chips, a chosen filter, secondary header buttons |
| `warning` | `#9a5b06` | `#d69a3e` | Run in progress, race-day chip, eased plan |
| `danger` | `#b3261e` | `#f08078` | Destructive actions only |
| `dangerSoft` | danger at 10 % | danger at 16 % | Border of a destructive button |
| `track` | = accent | = accent | The GPS line on every map |
| `scrim` | black at 40 % | black at 60 % | Behind sheets and dialogs |
| `stage` | `#00348f` | `#00348f` | The lead figure's panel, as on the landing page |
| `stageGlow` | `#6fa8ff` | `#6fa8ff` | The light on the stage, a unit beside the lead figure |
| `onStage` | `#ffffff` | `#ffffff` | Text and icons on the stage |
| `glass`, `glassRule` | ink at 32 %, white at 16 % | same | Figures set on the stage, and their rules |

**Literal colours.** Native navigation bars and SVG cannot read a dynamic
colour. For those only, `literalColors` gives the raw pair (`track`,
`background`, `text`), picked with `useColorScheme()`.

**Rules**
- Text on `accent` is always `accentText`, never white. In dark mode the
  accent is light, so its text is dark.
- `accentSoft` + `accent` is the pairing for anything tinted: a chip, a chosen
  filter, a secondary header button. Never for decoration: an icon tile, a
  total or a past week's bar is neutral. Tinting every tile is what makes a
  page look generated.
- In a chart, past values are `hairline` and the one still under way is
  `accent`.
- Translucent white (`rgba(255,255,255,0.16–0.22)`) and `glass` are only
  used **on the stage**, for its tags, progress track and figures.
- The stage is the one place where blue fills a surface. A page has at most
  one; while a run records, the screen has none.
- Cards are the exception: a card is a printed object, not a surface of the
  page. Its paper, metal, night ground and sheen are its own (`CardSurface`),
  and a rare card's stage does not count as the page's.

---

## Typography

One family: **Barlow Condensed**, loaded at launch before anything is drawn.
A condensed face reads smaller than its size, so sizes run larger than system
defaults.

| Token | Face |
|---|---|
| `font.regular` | 400: running text |
| `font.medium` | 500: setting labels, tags |
| `font.semibold` | 600: figures, names, buttons, labels |
| `font.bold` | 700: page titles, section headings, card titles |
| `font.extrabold` | 800: the brand name on the share card only |

### Scale

| Role | Size | Face | Tracking | Colour |
|---|---|---|---|---|
| Page title | 38 | bold | −1.2 | text |
| Page subtitle | 15 | regular | 0 | subtle |
| Section heading | 24 | bold | −0.6 | text |
| Section aside (total) | 15 | semibold | 0 | accent |
| Card title | 21 | bold | −0.3 | text / accentText |
| Row name | 18.5 | semibold | −0.2 | text |
| Setting label | 16.5 | medium | 0 | text |
| Body | 15–15.5 | regular | 0 | muted |
| Caption, detail | 13–14.5 | regular | 0 | subtle |
| Group label | 11.5–13 | medium/semibold, UPPERCASE | 1.0–1.4 | subtle |
| Banner label, empty-state label | 15 | medium / semibold | 0 | accentText 80 % / muted |
| Banner figure | 38 (+17 unit in `stageGlow`) | bold | −1.1 | onStage |
| Metric | 32 (22 compact, 86 large) | semibold (large: bold) | −0.9 | text |
| Metric label | 11.5, UPPERCASE | semibold | 1.3 | subtle |
| Button | 18 | semibold (primary: bold) | 0.3 | — |
| Tab label | 11 | semibold | 0 | accent / subtle |

**Rules**
- Every number that can change uses `fontVariant: ["tabular-nums"]`, so digits
  don't jitter as a run ticks.
- A unit sits beside its figure, smaller and in `subtle`: `8,42 km`.
- Uppercase is for labels only (settings group labels, metric labels),
  always with letter-spacing.

---

## Spacing and layout

| Constant | Value | Where |
|---|---|---|
| Gutter | **20** | Horizontal margin of every page |
| Panel inset | 12 outer, content on the 20 gutter | `Panel`, `SettingsGroup`, `SummaryBanner` |
| `TAB_BAR_HEIGHT` | 62 | Floating tab bar |
| `CONTROL_SIZE` | 42 | Round controls over the map |
| `CONTROLS_TOP` | 60 | Map controls from the top |
| `useTabBarBottom()` | `max(inset − 18, 8)` | Bar tucks into the home indicator |
| `useTabBarSpace()` | bar bottom + 62 + 10 | Bottom padding every tab must leave |

- Page header: `paddingTop 10`, `paddingBottom 14`.
- Section heading: `paddingTop 20`, `paddingBottom 8`.
- Card and row padding: 12–16 vertical, 14–16 inside cards.
- Gaps between stacked cards: 10–12.

### Radii

| Radius | Use |
|---|---|
| 6 | `Button` (a small radius reads as a control) |
| 8 | Chips |
| 12 | Action cards, record icon tile, choices |
| 20 | Panels, settings blocks, the summary banner |
| 16 | Summary banner |
| 18 | Header buttons (pill, height 36), sheets |
| 20 | Picker sheets over the map |
| height / 2 | Every round control, the tab bar pill |

### Elevation

- **Nothing on the page floats.** Sections are rounded `sunken` panels set
  12 points in from the edge (radius 20), separated by space, never by
  shadows. Rows inside a panel keep their hairlines.
- `floatingShadow` exists only for what floats over a map: map controls, the
  run panel, picker sheets, the slider thumb.
- **Glass** (`GlassPanel`) is for surfaces over live content: the tab bar,
  the run panel, map controls. Liquid Glass on iOS 26, a blur on older iOS, an
  opaque panel with a hairline on Android. Glass is **moved, never faded**: a
  native material at partial opacity stops compositing.

---

## Iconography

- **Ionicons** (`@expo/vector-icons/Ionicons`), outline style by default
  (`*-outline`). Filled only for the active state or on a blue surface.
- Sizes: 17–19 in tiles, 20–22 in cards and tabs, 24 for primary controls.
- An icon that stands for a thing sits in a **tile**: `sunken` background,
  `muted` icon (records 40 px / radius 12). In a settings block, already
  `sunken`, the icon stands bare in a 24 px column, `muted`, size 19.
- The **run disc**: `accent` circle, white `play` nudged 2–3 px right (a
  triangle centred geometrically looks off-centre). While a run records it
  turns `warning` with `radio-button-on`. In running text, write `▶`:
  `RunButtonText` draws the real disc in its place.

---

## Components

### Structure

| Component | Use it for |
|---|---|
| `FloatingTabBar` | The bar: Plan · Parcours · **run disc** · Historique · Profil. Five equal slots, before the run on the left, after it on the right. |
| `HeaderButton` | The action beside a page title. Icon + word. `primary` (filled) for the page's main action (New route); soft for secondary (Import, Settings). |
| `SummaryBanner` + `BannerTag` | The one figure a page leads with, on the cobalt stage (the same in both appearances, lit from the top right): compact: label in capitals, the figure at 38, and on the same row, at its right, the figures that go with it, small (`figures`); a goal's track under them, 3 high. The month in History, the week in Profile. Tags for a comparison or an invitation, in words only: no flame, no trend arrow. |
| `Panel` | A block of a page: `sunken`, radius 20, 12 in from the edge. Its content keeps the page's 20-point gutter (`PANEL_PADDING` inside). Rows on it pass `onPanel`. |
| `Figures` | A row of figures split by rules, two to a row past two: value bold, unit small, label in capitals. `stage` on the stage (a rule above, no ground), `glass` with a glass ground, `page` on a panel. |
| `SectionHeader` | A block's heading: bold name left, accent total right. Can be sticky. |
| `EmptyState` | Every empty tab: a rule, "Get started", then action cards of fixed height (one primary, blue). |
| `NoMatch` | A list narrowed to nothing: one sentence saying so, and "Show all". Never the empty state: a filter that matches nothing is not an empty list. |
| `LoadError` | A page whose data could not be read: what happened in a sentence, that nothing is lost, and "Try again". Never the empty state: a history that failed to load is not an empty history. A failed reload keeps what was already on screen. |
| `SettingsGroup` + `SettingRow` | Every settings screen: rounded `sunken` block, bare icon, label, value right, chevron when it leads somewhere, footer for the one explanation. |

### Controls

| Component | Use it for |
|---|---|
| `PressableScale` | Anything that is a button rather than a row: `Button`, `HeaderButton`, the empty state's cards, a pressable banner. Gives under the finger (scale 0.96, 90 ms down, 160 ms up) instead of fading. Rows in a list keep the `sunken` background. |
| `Button` | Full-width actions in sheets and forms. `primary`, `secondary`, `danger`. Min height 50, radius 6. |
| `HoldButton` | Steppers that repeat while held (goal, pace). |
| `Chip` + `ChipRow` | The row under a list's title: the sort (always tinted, opens a `ChoiceSheet`) and filters (neutral with a hairline, `accentSoft` + `accent` when on). Height 36, radius 8; the row scrolls sideways from the gutter. A chip that opens a choice (`menu`) ends in a chevron. |
| `MonthPicker` | Every date the app asks for (a plan's race, a race on a route): the month with arrows, then its days as rows of seven from Monday, the chosen one filled in `accent`, those out of reach greyed rather than hidden. |
| `Segmented` | Two or three ways of seeing the same thing (History: list or calendar). The one showing is filled on the `sunken` track. `compact`: as wide as its words and 36 high, to share a row with a chip. |
| `StepSlider` | A choice among a few ordered stops (1–4 runs a week). Snaps, ticks with a haptic, works with VoiceOver. |
| `DropdownMenu` | A round ⋯ button whose menu drops just under it: the actions on the thing a page shows. |
| `SwipeToDelete` | Deleting a row in a list. Never the only way: the item's own page has a delete too. |
| `RunButtonText` | Any sentence that mentions the run button. |

### Content

| Component | Use it for |
|---|---|
| `RecordRow` | A figure worth keeping: tile, name and detail, figure right. With `onPress` it leads somewhere and ends in a chevron (Profile's Performance block, the performance pages). |
| `Metric` | A labelled figure: label uppercase above, value, unit. `compact` over the map, `large` for the run's distance. |
| `TrainingCalendar` | The history as months of Monday-first weeks: a dot per day sized by distance, today outlined, each week's total at the end of its row. With every type shown, a day with a ride gets an `accent` ring of fixed size: the ride is there, but it sizes no dot and counts in no week. |
| `RunShape` | A run's outline in a tile, from a 60-point sample, cached. |
| `RunMap`, `TrackOverlay` | The map and the track drawn on it. On the run screen it can turn the way the runner goes, as a satnav does (see [The run screen](#the-run-screen)). |
| `ShareCard` + `ShareRunSheet` | The picture a run leaves as, story-shaped (9:16): the distance large, date and place, time, pace, gain and steps, TREAD in the corner. The sheet lays every kind side by side, swiped through like photos with dots under them, and sends the one in view: Map (the map photographed, the track on it), Photo (one of the run's photos or any picked, the outline drawn white over it), Blue (the stage, the outline large), Transparent in white and in blue (no ground at all, to lay over a photo in a story), the same two as a small sticker (outline, distance, time and pace in the middle), and GIF (the track drawn as it was run). Transparent ones are previewed on checks and keep their alpha. |
| `RecapCard` | A month or a year as a picture, story-shaped like the run's, swiped through on the recap page with dots under it, the one in view shared: Blue (the stage, the bars, four figures), Card (a collector's card on a night table, printed like the run cards: a year legendary, a month rare), Poster (paper and black ink, the distance as large as the paper allows, figures as ruled rows), Bars (the shape of the period first, tall, the peak lit), and Transparent in white and in blue (in the bottom corner, to lay over a photo). |
| `CardSurface` | What every card is printed on, the one place the app is made to look printed (its paper and metal colours, contours and sheen live in `@tread/core/cardLook`, shared with the web): a metal edge, the ground, the light from the top right, contour lines engraved from the card's seed, and from rare up a holographic sheen that slides against the tilt. Five tiers: common on ivory under matte silver; notable on cool white under blue steel, lit faintly, its contours blue and a fine blue second frame; rare on the stage under polished silver, with the sheen; exceptional on night under platinum, the sheen stronger; legendary the same with a second frame inside the edge and the strongest sheen. The tier is also a word and diamonds (◆◇◇◇), never colour alone. |
| `RunCard` | The card a run leaves in the collection (`@tread/core/card`), 300 × 420: the distance at 54 in the corner, its unit in the tier's light; the outline large across the card (`Depth`), fading into the foot; name, date · time · pace, traits in the tier's light, four stats from 1 to 99, then the tier and TREAD. Printed the same whatever the appearance, since it is shared as is. |
| `MiniCard` + `MiniCardRow` | A run's card at thumbnail size (118 × 165, radius 12), on the same `CardSurface`: number, outline, name, tier word. In a grid of three or a row that scrolls sideways from the gutter. |
| `MetaCardView` + `MiniMetaCard` | The great cards (`@tread/core/metaCard`): a week held, a block of four, a race, laid out as a run's card. A race shows its outline large; a week or a block its runs' outlines as a plate four to a row, or one alone large. At the foot, three figures: runs, time, and rare cards (weeks for a block). A race is legendary. |
| `CardBack` | The back of every card: the stage under silver, engraved, a second frame, TREAD and the number. `small` for a card in miniature. |
| `TiltCard` + `Depth` | Every card held on its own leans with the phone (gravity, on the UI thread, 9° at most, settling flat at whatever angle it is held): its outline (`Depth`) floats a few points above the paper, the contours drift the other way, and the light runs along the metal edge. From rare up the holographic sheen slides with it. Never with reduce motion. |
| `CampaignMap` | A plan read as chapters (one per phase): a path of its sessions (filled dot run, dash passed, ring next, quiet dot ahead) with its guardians as tiles on it, then the guardians as rows, each opening its session. |
| `LineChart` | A series against distance on a run's page (altitude, pace, heart rate): line over a soft fill, the two extremes named. |
| `RideDashboard` | The same place on a ride: the speed of the moment large, the average beside its unit, the top speed under it. No verdict and no gauge: a ride has no pace to hold. Paused, a `warning` chip says so in the room kept for it. |
| `RunDashboard` | The run screen while recording, over the map: a verdict chip (on pace, too slow, too fast, free), the pace of the moment large, the target beside its unit, a gauge read like a speedometer (too slow left, too fast right) whose marker springs around the tolerance band, and the block under way with what is left and what comes next. Off pace, the chip, the marker and the figure turn `warning` together. |
| `RunDashboard` on a trail session | A trail session is run by effort, not pace: no gauge, no verdict. The chip says the effort of the block under way ("Effort 7/10 · Z4 Threshold") in the calm colour, with `pulse`; the block card keeps its time left. Pause still wins the chip. |
| `IgnTiles` + `IgnCredit` | The IGN topo map, when chosen in Settings › Maps: a tile layer over the platform map, never instead of it, so a missing tile shows the street map rather than a hole. Outside France it is not drawn, and the credit becomes "IGN map: France only". While IGN is shown, "© IGN" sits bottom-left over every map, riding with the controls. Offline, only tiles on the phone are read. |

### Home screen

- `TreadHome` (medium/small): the week and the next session, written by the app.
- `TreadStart` (small/medium): the same week as `TreadHome`, with a "Run" pill
  filled in `accent` at the foot. A tap anywhere opens `tread://record?start=1`,
  which begins the run at once, after the usual location check.

### Sheets and dialogs

- `ChoiceSheet`: one answer out of a short list (a run's pair of shoes, its
  type): the chosen one ticked, a tap chooses and closes.
- `RunDetails`: on a run's page, what the runner says about it that the phone
  could not measure, as a settings block of rows.
- `OfflineMapSheet`: keeping a route's IGN map on the phone. Says what it
  costs before anything is fetched (tiles · about N MB), shows a progress bar
  and "Stop" while it runs (it carries on if the sheet closes), then "Kept on
  this phone" with a red "Delete the map" link. Zooms 11–16 for small areas,
  11–15 otherwise; refused past 3,000 tiles, and outside France.

- **Sheets** (`FeelSheet`, `WeeklyGoalSheet`, `RoutePicker`, `SessionPicker`,
  `SessionDetail`): a centred card, max width 380, over `scrim`. Tapping
  outside closes; a tap inside does not.
- **Destructive or irreversible**: the system `Alert`, never a custom dialog.
  An irreversible choice should look like every other one on the phone.
- **Permissions**: explained in the app **before** the system asks; a refusal
  always offers "Open settings".

---

## Page patterns

### A tab page

```
Title                          [HeaderButton]
Subtitle: count · total
┌──────────── SummaryBanner ────────────┐
│ LABEL                                  │
│ 34 km                                  │
│ detail line            [BannerTag]     │
└────────────────────────────────────────┘
Section heading                     aside
  rows / chart / tiles…
Section heading                     aside
  …
```

- Title and header button share one row; the subtitle only appears once
  there is something to count.
- Lists are rows separated by hairlines, indented past their leading tile so
  the tiles read as one column. No floating cards in a list.
- The page leaves `useTabBarSpace()` (+60 in lists) at the bottom.
- A list that grows (the routes) gets a search field (`sunken`, height 40)
  and a row of chips under the title, shown once there are two items: the
  sort first, tinted, opening a `ChoiceSheet`; then filters that tint when on.
  "3 of 12" appears while narrowed; an empty result says so and offers "Show
  all" (`NoMatch`).
- History has one row of controls under the title, never two: on the left
  a single `menu` chip, "All outings", that opens a `ChoiceSheet` of the
  types it holds (Run, Trail, Treadmill, Walk, Hike, Ride) with a count
  each, shown once it holds two types and tinted while narrowed; on the
  right a `compact` `Segmented`, List / Calendar. One type at a time. It
  narrows the list and the calendar alike; the month banner stays the
  runner's month. Month totals add up the runs shown, or the rides when the
  filter is Ride.
- **A tab is an overview, not an archive.** A list longer than a few rows
  gets its own page: the tab shows its headline in one `RecordRow` with a
  chevron (Profile: Records → longest run, Best efforts → 5K, Predicted
  times → 10K), and the page shows the rest. Profile reads, top to bottom:
  week banner, collection, progress, performance, all time. The collection
  sits straight under the week: a `MiniCardRow` of the newest cards, then a
  panel of rows (cards to turn over when there are some, the whole
  collection). All time ends on a row leading to the map of every
  run. See [The card game](#the-card-game) for the Collection page itself.

### An empty tab

```
Title
────────────────────────────────────────  (rule)
GET STARTED
┌ ▶  Primary action           (blue)    ┐
┌ ⇩  Secondary action               ›   ┐
note (optional, may contain ▶)
```

Same position on every tab: card titles are one line, card details always
take two. Keep each detail under about 60 characters.

### Settings

Blocks by subject (Training, While running, App, Data, About). One row = one
icon, one label, its current value. Explanations go in the block footer, not
under each row. Rows that lead somewhere have a chevron; rows that are a
choice have a tick; rows that act have a switch.

Settings › App › Maps holds the map background (Apple or IGN, ticked rows)
and the offline maps kept, each with its size; deleting one asks through the
system Alert, as does "Delete everything".

### The run screen

At rest the map is the screen. Once a run records, `RunDashboard` slides in
over it from the right: the question mid-run is "am I on pace", not "where
am I". A `Segmented` control at the top, centred and level with the way
out, switches between Pace and Map; the map kept following underneath.
Every run starts on Pace. The panel stays in both views, giving
the average rather than the current pace while the dashboard shows it large.

At rest, the same place at the top holds a `Segmented` Run / Ride, kept
from one outing to the next. A ride is the same screen read in speed:
`RideDashboard` instead of `RunDashboard`, Speed / Map, `km/h` in the panel,
no SESSION toggle (sessions and target paces are a runner's). Choosing a
session from the plan switches back to Run.

Rides are listed in History with the runs, as a "Ride" chip and a speed
where a run shows its pace, but they count in none of a runner's figures:
totals, month banner, week, goal, streak, records, best efforts,
predictions, plan, widget and recap are all made of runs alone. A ride wears
no shoes.

While a run is paused, "Paused" or "Auto-paused" leads the status line in
`warning`, whatever else the line says, and both dashboards show the same
word in their chip. The weather keeps the right end of the status line while
running (sky icon and degrees); at rest it has its own line, whose room is
kept even before it answers.

Afterwards, a run's page reads its stops back from the track (every resume
opens a segment, `@tread/core/pauses`; a gap under 3 s is the GPS, not a
stop). The duration stays time moving; when there were stops, a second row
gives the total time and the pace with stops (the speed, on a ride), and a
block lists each stop: where, after how long, and for how long, under a
title with their count and total.

On the map, the screen is the map. Everything else floats over it in glass: the way out
top-left, the toggles (SESSION, ROUTE, VOICE) in a column on the right
— SESSION and ROUTE only before the start, since a choice made mid-run
would change the map but not what the run follows — the
panel at the bottom with the figures and the controls. Toggles show state by
colour (`accent` on, `text` off) and, for the ones that open a choice, a dot
in the corner when one is set; never by fading.

Following a route, the map turns the way the runner goes, as a satnav
does: tilted, the street ahead above them, the runner an arrow in the
track's colour pointing up the screen. The direction is the compass (the
GPS course only on a phone without one), and the camera eases towards it
every frame rather than jumping. A round `navigate` control above the
locate one switches between this and north up (`accent` while the map
turns); without a route the map starts north up. A map dragged by hand
stops following, turned or not, until the locate button brings it back.

While running, the controls take the panel's full width under a row of four
figures, sized for a thumb mid-stride: **pause** in the middle, a filled
disc of 72, the largest thing on the panel; **lap** (flag and word) and
**finish** (stop and word, red ring and text) either side as pills of height
56. Finish still asks before it ends the run.
Once a lap is pressed the status line follows the lap under way, in
`accent`, as a session's line does; a session's line wins over it. On a chosen route the
line follows the route: distance left, the next turn within 200 m, "Off
route" in `warning`; a session's or a lap's line wins over it.

### The card game

Every run leaves a card, dealt from what happened (`@tread/core/card`), and
every past run has one already: nothing is stored, the history is dealt
again wherever cards are shown.

- **Turning a card over.** After a run, the top of its page holds a stage
  row, "Your card is waiting", with a card back beside it. It opens the
  card stage (`/card`, full screen): the card face down, turned by a tap (a
  rotation, moved never faded, Medium or Heavy impact), then what it earned
  said one line at a time with a selection tick, each trait with the rarity
  points it is worth, then the slots it filled. The great cards it completed
  follow it, each turned in turn. Cards of runs not yet seen (an import, a
  new phone, the first opening) are offered from Profile and the Collection
  banner, the finest eight at most.
- **The Collection page**: the banner (cards, rare ones, sets), the row to
  the rules, the great cards in a row, the rarest in a row, every card in a grid of
  three with rarity chips, then the sets. A card opens on the stage face up,
  to hold and tilt, share, or open its run.
- **The rules** (`/card-rules`), linked from the top of the Collection: rarity and its points, every trait with what earns it and its worth, the four stats, the great cards. The points and thresholds are read from `@tread/core/card`, never written into the page.
- **History** says a rare or exceptional card in the row, in words, as a
  chip: tinted for rare, filled for exceptional.
- **The campaign**: in Plan, a `Segmented` Sessions / Campaign under the
  next session, and the chapter under way in one `accent` line whichever is
  shown. A session passed over is passed, never failed.

### A pushed page's actions

What can be done to the thing a page shows — a run: save as a route, edit,
add to Health, export, delete — sits behind one round ⋯ button beside that
thing's title, next to its share button: a `DropdownMenu` that drops from
the button, aligned to its right edge, an icon and a word per row, the
destructive one last, set apart and in red. Never a row of buttons at the
foot of the page (four abreast, their words break), never the phone's action
sheet (it rises far from the finger and reads as a warning).
A saved route's page follows the same rule: its ⋯ in the header holds
"Race plan", "Offline map" and, last and in red, "Delete".

### A race plan

A race run on a route, from the route's ⋯ › Race plan. The route's name,
then the stage: the goal time large, with the average pace, the distance
and the gain beside it. Under it a panel with the goal on a stepper (15 s
a step, held to repeat), what the runner's recent outings say about the
course ("From your runs: 52:30 (51:40 to 54:10)") and a verdict in one
line, its room kept: ambitious in `warning`, realistic, cautious. Then the
course's profile, its climbs as rows (length, grade, where, the seconds
they cost), and a row per kilometre (or mile): pace, grade and the clock
at its end, `trending-up` or `trending-down` where it climbs or drops.
"Run this plan" at the foot chooses the route and opens the run screen.

The goal is spread for an even effort: about 3 % slower per 1 % of climb,
1.7 % faster per 1 % of descent, nothing more past 5 % down
(`@tread/core/raceDay`). The profile is asked of Open-Meteo once and kept
on the phone, so the plan holds on a race morning without signal; without
one the plan is an even pace and says so.

During the race the dashboard's target is the plan's pace for the
kilometre under way, and the voice measures against it. The status line,
when no turn is close, says the climb coming ("Climb in 200 m · 600 m at
4 %") or under way ("Climbing · 300 m to go · 18 s allowed"), otherwise
the distance left and the gap to the plan ("12 s ahead of your plan"),
which takes the room of the gap to the record.

A race has a day. Under the goal's panel, a settings row "Race day" opens
`RaceDateSheet` (a `MonthPicker` and the start on a stepper, 15 min a
step, "Remove the date" in red when one is set). The stage's detail counts
down ("In 12 days", "Tomorrow", "Today"). The row's footer gives the
forecast for the start once it is within sixteen days, and when it is warm
how much to allow on the goal (0.3 % per degree felt above 12 °C, up to
10 %, after Ely et al. 2007): a word to the runner, never a change made to
the plan behind their back.

A race's ⋯ holds "Change the date", "Edit the course" (the route's
editor; a redrawn course has its profile asked for again), "Remove from my
races" (the date goes, the course and goal stay) and, last and in red,
"Delete" (course, plan and date, through the system Alert). A race row in
"Upcoming races" swipes off the list the same way it is removed.

A loop can be run several times: a 10K on a 5 km loop is two laps. On a
loop, the race day block holds a "Laps of the loop" row with a stepper
(1 to 20), and the route picker on the run screen shows the same stepper
under the list once a loop is chosen. The loop is laid end to end as many
times as asked (`repeatLine`, `repeatProfile`), so the distance, the
plan, the turns, the distance left and the finish all count every lap. A
new lap is said aloud ("Lap 2 of 3", "Last lap") and leads the status
line ("Lap 2/3 · Route · 4.2 km left"). Changing the laps keeps the goal's
time per lap. A run of several laps does not count as a run of the route:
it sets no record on it and runs against no ghost, so a lap's best stays a
lap's.

Official races are added from the Routes tab: a soft "Race" header button
beside "New" opens a `ChoiceSheet`, "Import the course GPX" (often on the
organiser's website) or one of the runner's routes, then the race plan
opens with its date asked first. The empty tab offers it as a third card,
"Plan a race". Races still to run sit above the routes, under "Upcoming
races", soonest first, one `RecordRow` each (flag, name, day and start ·
distance, "12 days to go"), kept through their whole day.

### The welcome

One idea per page: what the app does → why you run → where you are → how
often (slider) → permissions. A progress bar of four segments, a way back, a
way to skip. "Continue" is disabled until the page is answered.

### Setting up a plan

The welcome's shape: one question per page — race → date → rhythm and days →
fitness today (longest run, weekly volume) → target time and paces — then a
**recap** of every answer as settings rows, each opening its page again, with
the plan's size ("14 weeks · 42 sessions, then the race") and "Create the
plan" at the end. Nothing is made before the recap.

Under twenty minutes of running without stopping (down to "Never run"), the
fitness page says so in one line: the plan starts on run-walk, a minute's
running at a time, with no intervals and no pace. Such sessions show "by
feel" where others show their pace, and on the run screen a walking block
reads "Walk" rather than a verdict on the pace.

### Setting up a trail plan

The same shape, with Trail as a sixth answer to "Which race?". A trail is
described rather than picked: a Course page asks distance and elevation gain
(steppers), and says what they add up to — "Long trail · 72 effort km",
distance plus a kilometre per 100 m of gain, ITRA's measure — which sets the
plan's size and its weeks. The date comes after it. From a long trail on,
the rhythm proposes Saturday and Sunday so back-to-back weekends fall on
two days in a row. "Where are you today" asks only the longest run: no
volume, which only bends road paces. The time page becomes a goal page:
Finish (default, with the estimated time in one line) or A target time,
which sizes the long runs and sets no pace. The recap adds a Course row and
a Goal row, and no paces.

When the long run cannot get near what the race asks, a `warning` line says
so on the fitness page and the recap. Under half of it, or for a long trail
from run-walk, or an ultra on one day a week, the line says why and "Create
the plan" stays disabled.

A trail session reads in effort wherever a road one reads in pace: "effort
7/10" in plan rows and the next-session card, "effort 7/10 · Z4 Threshold"
on the session sheet. Slope sessions have their own kinds and icons:
Hill repeats and Uphill tempo `trending-up`, Power hiking `footsteps`,
Downhill `trending-down`.

---

## Motion

| Duration | Use |
|---|---|
| 170–180 ms | Swipe-back completion, snap back |
| 240 ms | Tab bar slide (`Easing.out(cubic)`) |
| 280 ms | Run panel changing height |
| 300 ms | Run screen furniture arriving from its edges |
| spring (damping 22, stiffness 260) | Slider thumb settling on a stop |

- Animate **transform**, not opacity, on anything native (maps, glass): an
  animated opacity is what left screens blank.
- A pressed button scales to 0.96 (`PressableScale`); it never fades. A
  pressed row turns `sunken`.
- Tabs switch without a transition.
- Things arrive from the edge they belong to; they don't fade in.

## Haptics

| Call | When |
|---|---|
| `selectionAsync()` | Changing tab, a slider stop, any picker-like choice |
| `impactAsync(Light)` | Pause |
| `impactAsync(Medium)` | Start, resume, stop, the run disc |
| Vibration motor (not Taptic) | Kilometres and blocks during a run, felt through a pocket |

A haptic only fires when something happened: tapping the tab you are already
on does nothing and buzzes nothing.

## Sound

The cards alone make a sound; a run, a record or a button does not. Four
short sounds, made for them with ElevenLabs, trimmed and levelled, shipped
in the app (`apps/mobile/assets/sounds`, played by `lib/sounds.ts`), in the
manner of a card game: a card flipped onto a table, a pop for each line it
says, a shimmer for a rare or exceptional card, an impact and a swell for a
legendary one. They mix with the runner's music, follow the silent switch,
and go off with Settings › App › Card sounds.

---

## Language

- The interface speaks **French and English**; the code only English.
- No displayed string is written inline. It lives in a
  `defineStrings({ fr, en })` table beside the code that shows it, read with
  `useStrings(table)`. The English side is typed against the French one.
- Numbers go through `decimal()` (`5,21` / `5.21`), dates through
  `intlLocale()`.
- Units are never written by hand: a figure goes through its formatter
  (`formatDistance`, `formatPace`, `formatElevation`, `formatSpeed`,
  `formatTemperature`), which converts from the stored metric value, and its
  label comes from `distanceUnit()`, `paceUnit()`, `elevationUnit()` or
  `speedUnit()`. Only track distances and race names stay metric.
- A displayed name is computed from an identifier (`sessionName`, `kindName`,
  `zoneName`), never read from a stored string.

### Voice and tone

- Second person, informal French (*tu*), plain English.
- Short. A card detail fits two lines; a lede fits two lines.
- Say what happens, not what the button is: "Une sortie libre, avec une
  séance ou un parcours si tu veux", not "Démarrer une course libre".
- No exclamation marks, no emoji in the interface.
- Units are metric: km, m, /km, km/h, °.
- Effort is out of 10 ("effort 7/10"), with the heart-rate zone beside it
  where there is room. Elevation gain is "D+" in French, "gain" in English.

---

## On the web

The web app (`apps/web`) and the landing page (`apps/landing`) are built for
a large screen, not from the phone's components, but in the same language:
the palette's CSS variables, Barlow Condensed, the type scale above, a 20 px
gutter, the same radii (6 for a button, 12 for a card, 16 for the banner,
18 for a header pill) and hairline rules rather than shadows. A pressed
button scales to 0.96. Both serve every word from a `defineStrings` table,
and the landing page ships no JavaScript.

The web app is the phone's tabs laid out for a large screen, built from its
own components (`apps/web/src/components`) with the phone's names:
`SummaryBanner` (the cobalt stage, one per page), `Figures`, `SectionHeader`,
`EmptyState`, `NoMatch`, `RecordRow`, `ChoiceMenu` (a chip that opens a
list), `Segmented`, `RunShape`, `LineChart`, `TrackMap`. The cards are the
phone's, dealt in the browser with the same rules (`@tread/core/card`,
`@tread/core/metaCard`) so the runner's own hours are read, and printed
from the same look (`@tread/core/cardLook`): `CardSurface` (CSS gradients
and SVG contours), `RunCard` and `MiniCard`, `MetaCardView` and
`MiniMetaCard`, `TiltCard` (a card leans under the mouse, never under a
finger nor with reduce motion), and `CardViewer`, a card held up alone over
the scrim with the way to its outing. Profile shows the newest cards under
the week and leads to the Collection and its rules; an outing's page shows
its card beside its details, and the great cards it completed. Blocks sit in
rounded `sunken` panels (`.panel`, radius 20). The four tabs (Plan,
Routes, History, Profile) sit in the header on a large screen and float in a
glass bar at the foot, as on the phone, below 720 px; Settings is a header
pill. An outing's page puts the map and its charts in a wide column and the
details, zones, splits and laps beside it, stacked at a phone's width. The
account pages (sign in, sign up, password) are one centred column of 400.
Every action has a word; a form keeps what was typed when it fails. Routes are drawn and imported on the web too, where a mouse is easier than a
finger: "New route" opens the editor (click to place points, the line asks
the phone's walking router, a point dragged moves, undo, back to the start,
clear; distance, gain and loss and the elevation profile as it grows), and
"Import a GPX" takes files picked or dropped anywhere on the page. A
route's page gives its gain and profile, "Edit" and a red "Delete". Gain
and profile come from Open-Meteo's elevation service, routes carrying no
altitude of their own. What is made or deleted here reaches the phone at
its next sync (`/api/routes`).

The landing page shares a language, not a layout. Every section uses the
same parts — a two-tone headline (the second line in the accent), one
object staged, panels of radius 28 set 12 px in from the window, glass for
figures (`Specs`, radius 20) — but each composes them its own way through
`Showcase`: side by side, stacked and centred, or the object across the top.
Grounds alternate between the page itself, day `sunken`, night and cobalt.

## Accessibility

- Every icon-only control has an `accessibilityLabel`; every custom control
  has a role (`button`, `switch`, `radio`, `adjustable`).
- State is carried by colour **and** shape or text (a tick, a word), never by
  colour alone.
- Touch targets are at least 36 pt, with `hitSlop` to reach 44.
- The run disc drawn inside text is read aloud as "Courir" / "Run".
- The slider accepts increment/decrement from VoiceOver.

---

## Checklist for a new screen

- [ ] Built from existing components before writing new styles
- [ ] Page gutter 20, header `paddingTop 10` / `paddingBottom 14`
- [ ] Colours from `colors`, never a hex in a screen
- [ ] One bold heading per block; figures semibold, `tabular-nums`
- [ ] Every action has a word, every icon-only control a label
- [ ] Empty state uses `EmptyState`
- [ ] Every string in a `{ fr, en }` table
- [ ] Checked in light and dark
- [ ] Nothing shifts height between states
