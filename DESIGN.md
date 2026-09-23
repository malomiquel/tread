# Tread design system

How Tread looks, and why. Every value here is the one in the code; when they
disagree, the code is right and this file is out of date.

- Tokens: `src/lib/theme.ts`, `src/lib/layout.ts`
- Strings: `src/lib/i18n.ts` (see [Language](#language))
- Components: `src/components/`

---

## Principles

1. **Say it in words.** An action is an icon *and* a word, never an icon on
   its own. A bare arrow meant "import" to whoever drew it and "download" to
   everybody else.
2. **One shape per idea.** A banner, a section heading, an empty page, a
   settings block: each exists once, as a component, and every screen uses it.
   Two screens that look alike must be built from the same parts.
3. **Colour marks what matters.** The page is neutral. Blue marks what is
   yours, what is active and what to do next. Blue is never decoration.
4. **Quiet type.** One bold heading per block at most. Figures are semibold,
   running text is regular. If everything is bold, nothing is.
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
| `sunken` | `#f4f4f4` | `#18181a` | Settings blocks, pressed rows |
| `hairline` | `#e6e6e6` | `#2b2b2e` | Rules, card borders, inactive ticks |
| `text` | `#101010` | `#f2f2f3` | Headings, names, figures |
| `muted` | text at 62 % | text at 62 % | Body text, secondary figures |
| `subtle` | text at 42 % | text at 44 % | Captions, units, group labels, chevrons |
| `accent` | `#00348f` | `#6fa8ff` | Primary action, selection, banners, active tab |
| `accentText` | `#ffffff` | `#04101f` | Text and icons **on** `accent` |
| `accentSoft` | accent at 12 % | accent at 18 % | Icon tiles, chips, secondary buttons, totals |
| `warning` | `#9a5b06` | `#d69a3e` | Run in progress, race-day chip, eased plan |
| `danger` | `#b3261e` | `#f08078` | Destructive actions only |
| `dangerSoft` | danger at 10 % | danger at 16 % | Border of a destructive button |
| `track` | = accent | = accent | The GPS line on every map |
| `scrim` | black at 40 % | black at 60 % | Behind sheets and dialogs |

**Literal colours.** Native navigation bars and SVG cannot read a dynamic
colour. For those only, `literalColors` gives the raw pair (`track`,
`background`, `text`), picked with `useColorScheme()`.

**Rules**
- Text on `accent` is always `accentText`, never white. In dark mode the
  accent is light, so its text is dark.
- `accentSoft` + `accent` is the pairing for anything tinted: an icon tile, a
  chip, a secondary header button, a total tile.
- Translucent white (`rgba(255,255,255,0.16–0.22)`) is only used **inside a
  blue banner**, for its tags and progress track.

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
| Page title | 32 | bold | −0.6 | text |
| Page subtitle | 15 | regular | 0 | subtle |
| Section heading | 21 | bold | −0.3 | text |
| Section aside (total) | 15 | semibold | 0 | accent |
| Card title | 21 | bold | −0.3 | text / accentText |
| Row name | 18.5 | semibold | −0.2 | text |
| Setting label | 16.5 | medium | 0 | text |
| Body | 15–15.5 | regular | 0 | muted |
| Caption, detail | 13–14.5 | regular | 0 | subtle |
| Group label | 11.5–13 | medium/semibold, UPPERCASE | 1.0–1.4 | subtle |
| Banner figure | 34 (+16 unit) | semibold | −0.8 | accentText |
| Metric | 32 (22 compact, 86 large) | semibold (large: bold) | −0.9 | text |
| Metric label | 11.5, UPPERCASE | semibold | 1.3 | subtle |
| Button | 18 | semibold (primary: bold) | 0.3 | — |
| Tab label | 11 | semibold | 0 | accent / subtle |

**Rules**
- Every number that can change uses `fontVariant: ["tabular-nums"]`, so digits
  don't jitter as a run ticks.
- A unit sits beside its figure, smaller and in `subtle`: `8,42 km`.
- Uppercase is for labels only (group labels, metric labels, banner label),
  always with letter-spacing.

---

## Spacing and layout

| Constant | Value | Where |
|---|---|---|
| Gutter | **20** | Horizontal margin of every page |
| Settings inset | 16 outer + 14 inner | `SettingsGroup` |
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
| 8 | Setting icon tile, chips |
| 12 | Action cards, record icon tile, choices |
| 14 | Settings blocks, total tiles |
| 16 | Summary banner |
| 18 | Header buttons (pill, height 36), sheets |
| 20 | Picker sheets over the map |
| height / 2 | Every round control, the tab bar pill |

### Elevation

- **Nothing on the page floats.** Sections are separated by hairline rules,
  not shadows.
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
- An icon that stands for a thing sits in a **tile**: `accentSoft` background,
  `accent` icon (settings 30 px / radius 8, records 40 px / radius 12).
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
| `SummaryBanner` + `BannerTag` | The one figure a page leads with, on blue: the month in History, the week in Profile. Tags for a comparison or an invitation. |
| `SectionHeader` | A block's heading: bold name left, accent total right. Can be sticky. |
| `EmptyState` | Every empty tab: a rule, "Get started", then action cards of fixed height (one primary, blue). |
| `SettingsGroup` + `SettingRow` | Every settings screen: rounded `sunken` block, icon tile, label, value right, chevron when it leads somewhere, footer for the one explanation. |

### Controls

| Component | Use it for |
|---|---|
| `Button` | Full-width actions in sheets and forms. `primary`, `secondary`, `danger`. Min height 50, radius 6. |
| `HoldButton` | Steppers that repeat while held (goal, pace). |
| `StepSlider` | A choice among a few ordered stops (1–4 runs a week). Snaps, ticks with a haptic, works with VoiceOver. |
| `SwipeToDelete` | Deleting a row in a list. Never the only way: the item's own page has a delete too. |
| `RunButtonText` | Any sentence that mentions the run button. |

### Content

| Component | Use it for |
|---|---|
| `Metric` | A labelled figure: label uppercase above, value, unit. `compact` over the map, `large` for the run's distance. |
| `RunShape` | A run's outline in a tile, from a 60-point sample, cached. |
| `RunMap`, `TrackOverlay` | The map and the track drawn on it. |
| `ShareCard` | The picture a run leaves as. |

### Sheets and dialogs

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

### The run screen

The map is the screen. Everything else floats over it in glass: the way out
top-left, the toggles (SESSION, ROUTE, VOICE) in a column on the right, the
panel at the bottom with the figures and the controls. Toggles show state by
colour (`accent` on, `text` off), never by fading.

### The welcome

One idea per page: what the app does → why you run → where you are → how
often (slider) → permissions. A progress bar of four segments, a way back, a
way to skip. "Continue" is disabled until the page is answered.

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

---

## Language

- The interface speaks **French and English**; the code only English.
- No displayed string is written inline. It lives in a
  `defineStrings({ fr, en })` table beside the code that shows it, read with
  `useStrings(table)`. The English side is typed against the French one.
- Numbers go through `decimal()` (`5,21` / `5.21`), dates through
  `intlLocale()`.
- A displayed name is computed from an identifier (`sessionName`, `kindName`,
  `zoneName`), never read from a stored string.

### Voice and tone

- Second person, informal French (*tu*), plain English.
- Short. A card detail fits two lines; a lede fits two lines.
- Say what happens, not what the button is: "Une sortie libre, avec une
  séance ou un parcours si tu veux", not "Démarrer une course libre".
- No exclamation marks, no emoji in the interface.
- Units are metric: km, m, /km, km/h, °.

---

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
