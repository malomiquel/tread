# Cards from real runs: a design study

A study, not a spec. It asks whether Tread should turn each outing into a
collectible card, in the manner of a trading card game, and how to do it
without breaking what the app promises. No code has been written for it.

- Status: built, November 2026 (the Album, then the next five: the reveal,
  great cards, duels and the campaign; see "What was built" at the end)
- Reads with: `ROADMAP.md` (positioning, "Not doing"), `DESIGN.md`
- Touches, if built: `packages/core` (a pure `card.ts`), the run page,
  Profile, `ShareCard`, `RunShape`

---

## The question

Tread wants features that make people move from another app. A card game
built from real runs is one idea: every run leaves a card, the card's
picture is the run's outline, its rarity comes from what actually happened
(a record, rain, a climb, a ghost beaten), and the cards are collected in
sets, compared, maybe pitted against a friend's.

Two constraints frame every answer below:

1. **The promise.** `ROADMAP.md` positions Tread as "the running app that
   knows nothing about you" and lists accounts, a social feed, kudos and
   leaderboards under "Not doing". A backend with accounts is being
   considered, but it is not built and the roadmap has not been changed.
   Anything here that needs accounts is marked as such, and is a decision to
   take, not an assumption.
2. **The runner's body.** A game that rewards running more, harder or in
   worse conditions will hurt someone. Rest, easy days and following the
   plan have to be worth as much as a heroic outing.

---

## 1. What exists

### Story and fiction: Zombies, Run!

An audio story told in missions of 30–50 minutes, with chases that make you
speed up. Over 400 missions across eleven seasons, a mission unlocked per
week for free players. Its creator reported high retention and two million
runners by 2015, with no figures published.

- **Works**: the reason to go out is the next episode, not a number. It
  works on a treadmill (chases turned off). It respects any level.
- **Wears**: it is content-bound. Someone has to write the next season, and
  once heard, a mission has little left to give.
- **For Tread**: a fiction costs a studio's writing. Tread's material is
  the runner's own history, which renews itself for free.

### Badges, trophies, challenges: Strava, Nike Run Club

Strava has monthly challenges, badges, segment crowns (KOM/QOM) and Local
Legends (most efforts on a segment over 90 days). Nike Run Club has
challenges whose trophies land in Achievements, next to streaks and personal
bests.

- **Works**: a trophy marks a moment the runner already cares about (a
  first half, a best 5K). Personal bests are the most durable reward there is.
- **Wears**: generic badges ("ran in March") are forgotten as soon as they
  are given. When Nike removed trophies and friend challenges in its 2016
  redesign, users complained loudly, which says collections matter once
  people hold them.
- **Harms**: coaches note that hunting segments every outing leaves runners
  training "neither hard nor easy", and that monthly challenges push daily
  activity whatever a readiness score says. Leaderboards invite cheating:
  Strava says it has removed 4.45 million activities with its leaderboard
  integrity tool, and riders logging car trips on segments is an old
  complaint. Local Legends and public streaks make some runners feel they
  cannot stop.

### Move-to-earn: STEPN and its clones

Run with an NFT sneaker, earn tokens. In 2022 the token lost most of its
value, monthly users far outnumbered daily ones (99,000 against 5,800 in one
report), and players spoofed GPS and ran bots to farm tokens.

- **Lesson**: when cards are worth money, people cheat and the economy
  collapses. Rewards must have no resale value, and cheating must pay
  nothing.

### Walking games: Pokémon GO

Eggs hatch after a distance walked; Adventure Sync counts steps from Health.
Distance covered faster than about 10.5 km/h is not counted, to stop play
from a car.

- **Works**: a collection that fills as you move, with no effort target.
- **For Tread**: a speed ceiling is an honest, simple anti-cheat rule. A
  runner's ceiling is far higher, but a ceiling there must be.

### Collecting places: CityStrides, VeloViewer, Squadrats

CityStrides ticks off every street of a town you have run; VeloViewer and
Squadrats split the map into tiles and colour those you have crossed.
Runners describe the appeal as "overt, measurable, daily progress", and pro
cyclists play Squadrats among themselves.

- **Works**: the collection is the map itself. The empty tiles are the
  reason to go out, and the reason is to *explore*, not to go faster.
- **Wears**: it gets harder as the nearby map fills; the next tile is
  always further away.

### Card and creature apps built on runs

A handful of small apps exist: Deckcore (outdoor runs give card XP and
evolutions), StrideBound (collect creatures by running), Dragon Run (hatch
dragons by GPS), Run Visuals (stat cards and stickers from imported data).
None of them makes the card *out of the run itself*: the card is a reward
for distance, drawn from a fixed pool of monsters. That is the gap.

### What the research says

Two meta-analyses of gamified physical activity apps (Mazeas et al., 2022;
Yang et al., 2022) find a small to medium effect on activity, and a much
smaller one weeks after the game ends. Gamification helps; it does not
carry a habit on its own. It should sit on top of the plan, not replace it.

### Randomness and money

Paid random rewards are treated as gambling in Belgium; the Netherlands and
the EU are moving towards stricter rules. A card system that never sells
packs, never draws randomly, and gives every card for an act the runner did,
sits outside all of it.

### What to keep

| Keep | Avoid |
|---|---|
| Rewarding personal bests | Generic "you ran" badges |
| A collection with visible empty slots | Rewards with resale value |
| Exploring (new places, new hours) | Daily streaks that punish rest |
| Comparing to your own past | Public leaderboards |
| One simple anti-cheat rule (speed) | Randomness, packs, anything paid |
| Working at any level and on a treadmill | Content that must be written forever |

---

## 2. What a card is, in all three concepts

The three concepts share one card. Only what is done with it changes.

### A card is a function of the run

A card is computed from a run, the way best efforts are: same run, same
card. Nothing is drawn at random. Editing a run recomputes its card;
deleting the run deletes the card. That is the first anti-cheat rule, and it
keeps the card honest towards the runner themself.

```
card(run, historyBefore) → { number, name, shape, stats, traits, rarity, sets }
```

`historyBefore` is the runs started before this one, so a card's stats say
how it compared *at the time*. A later, better run does not lower an old
card. It can be stored with the run, or simply worked out again wherever it
is shown, which is what the first version does.

### Anatomy

```
┌──────────────────────────────┐
│ No. 042              RARE    │  number in the collection, rarity in words
│                              │
│        (RunShape)            │  the outline, ends hidden (privacy radius)
│                              │
│ Sunday long run              │  name computed from kind and day, never stored
│ 18,4 km · 1 h 41             │
│──────────────────────────────│
│ ENDURANCE  92   SPEED     61 │  four stats, 1–99
│ CLIMB      48   STEADY    85 │
│──────────────────────────────│
│ Longest run · Rain           │  traits, in words
└──────────────────────────────┘
```

- **Illustration**: `RunShape`, already drawn from a 60-point sample and
  cached. A shared card goes through `hideEnds` like every shared picture.
  A treadmill run has no shape: it gets the activity icon in a tile, like a
  ride in History today.
- **Name**: computed from identifiers (`kindName`, `tagName`, the weekday),
  so it changes language with the app.
- **Size**: the run card's size, so it can share through `ShareCard` and
  sit beside `RecapCard`.

### Stats: against your own history

Four stats, each 1–99, as the percentile of this run among the runner's own
runs before it:

| Stat | From | Why |
|---|---|---|
| Endurance | distance (or moving time on a run-walk plan) | the long run matters |
| Speed | average pace, or the best effort it holds | the fast days matter |
| Climb | elevation gain per km | trail and hills |
| Steady | evenness of pace, or how closely a session was followed | control, not effort |

Measured against oneself, a beginner's best run scores as high as an elite's
best run. Nobody is outclassed, and the only way to make better cards is to
improve. **Steady** is there on purpose: an easy run held at an easy pace,
or a session followed block by block, scores high. Running every outing flat
out lowers it.

The first ten runs have too little history to rank against; their stats are
read against a fixed table per level (the welcome's answers) until there is
enough.

### Traits and rarity

A trait is a fact about the run, each worth points. Rarity is the sum,
in four steps: **Common**, **Notable**, **Rare**, **Exceptional**
(*Commune, Remarquable, Rare, Exceptionnelle*).

| Trait | Condition | Points |
|---|---|---|
| Personal best | a new best effort (`bestEfforts`) | 3 |
| Longest run | longest distance so far | 3 |
| Ghost beaten | faster than the route's ghost (`ghostGapS`) | 2 |
| Race | tagged race | 2 |
| Session held | a plan session run within its tolerances | 2 |
| Patience | an easy or recovery run kept at easy pace | 2 |
| New ground | a share of the track on cells never run before (heatmap) | 1–2 |
| Climb | elevation gain over a threshold per km | 1 |
| Early / Late | started before 7:00 or after 21:00 | 1 |
| Rain, Snow, Wind, Cold | from the stored weather, within safe bounds | 1 |
| Anniversary | a year to the day since the first run | 1 |

Common 0–1, Notable 2–3, Rare 4–5, Exceptional 6 and over.

Rarity is shown by **word and frame**, never by colour alone: a hairline
border for Common, a `text` border for Notable, an `accent` border for Rare,
an `accent` fill with `accentText` for Exceptional, as `RecapCard` already
does. No gold, no foil, no glow.

### Safety rules, built into the traits

- **Weather is only ever a small bonus, and never at its worst.** No trait
  above a felt temperature of 30 °C, below −10 °C, in wind over 50 km/h, or
  under a thunderstorm (WMO codes 95–99). A heatwave run is a Common card.
- **No volume trait.** Nothing rewards a week bigger than the last. The
  biggest single rewards are a best effort and the longest run, which a plan
  already asks for.
- **Patience and Session held are worth as much as a ghost beaten.** Doing
  the easy day right is as rare as a fast day.
- **No streak of days.** Tread's existing streak counts weeks on the goal;
  cards add no daily streak. Sets have no deadline.
- **Nothing is ever lost.** No card expires, decays or is taken back for
  skipping a run. A rest day costs nothing.
- **Pain says stop.** A run noted as "Very hard" (exertion 5) twice in a
  row earns no traits after the second, and the card says why: *"Two very
  hard runs in a row. The next card waits for an easier day."*
  (*« Deux sorties très dures d'affilée. La prochaine carte attend un jour
  plus facile. »*)

### Anti-cheat rules

Locally, cheating only cheats yourself. The rules exist so that cards are
believable when shown to others, and so that nothing in the game is worth
cheating for.

- **Sport first.** A card's set and stats come from `sportOf(activity)`. A
  ride makes a ride card, in its own sets, and never fills a running slot,
  as rides already count in none of a runner's figures.
- **A speed ceiling.** A running card whose track holds a kilometre faster
  than 2:20, or 2 km faster than 25 km/h, loses its traits and reads
  *"Too fast for a run. Was it a ride?"*, with a way to change the type.
  Changing a ride to a run recomputes the card under the same rule.
- **Recorded, imported, entered.** A card shows where its run came from:
  recorded by Tread, imported from Health with a watch as source, or
  imported from a file. A file import keeps its traits but wears an
  "Imported" mark. A treadmill run has no shape, no ghost, no new ground.
- **Deterministic.** Since a card is a function of its run, an edited run
  (trimmed, retyped) cannot keep a card it no longer deserves.
- **No stakes.** No card is sold, bought, won from another player or lost
  to one. The STEPN lesson: take the money out and most cheating goes with
  it.

---

## 3. Three concepts

### A. The Album

**Every run is a card; the cards fill an album of sets.** Single-player,
entirely on the phone.

**Sets** are pages with named empty slots:

| Set | Slots |
|---|---|
| First steps | first run, first 5 km, first 10 km, first route, first session |
| Distances | a best effort for each of 400 m, 1 km, mile, 5K, 10K, half, marathon |
| Around the clock | a run in each band: before 7:00, morning, midday, afternoon, evening, after 21:00 |
| Four seasons | a run in each season, repeatable each year |
| All weathers | rain, snow, wind, cold, a clear sky (within the safety bounds) |
| My routes | one slot per saved route: run it, then beat its ghost |
| New ground | 10, 25, 50, 100 cells of the map run for the first time |
| The plan | one slot per plan week completed, rest days included |
| Rides | the same idea for rides, kept apart |

A slot shows what would fill it, in words: *"A run before 7:00"* /
*« Une sortie avant 7 h »*. Sets only ask for things anyone can do at their
level: an hour, a season, a route, a first. None asks for a speed.

**What brings you back**: the empty slot nearest to you. Each week, the
Plan tab may suggest one slot that fits the next planned session ("Your long
run on Sunday could fill *Four seasons · Winter*"), never one that changes
the session.

**Backend**: none. Cards live in SQLite beside their runs, are rebuilt from
history in one pass, and are part of the existing backup. Once sync exists,
the web app shows the album too, read-only.

**Switching hook**: import a Strava or Garmin history (GPX, Health) and the
album is filled on the first evening, with your old records as cards. That
is the moment another app's years of data start working for Tread.

**Risk**: single-player collections plateau once the easy slots are full.
The repeatable sets (seasons, the plan, new ground, routes) are what keep
it going.

### B. Duels

**The Album, plus a deck of three cards to set against a friend's.**

A duel is a game of comparison, three rounds: each round names a stat, and
the higher card takes it. Because stats are percentiles of each runner's own
history, a duel between a beginner and a club runner is even: it is your
progress against theirs. Traits add a small bonus in the round of their stat
(Personal best on Speed, Climb on Climb, Patience and Session held on
Steady), so a well-run easy day can win a round.

**Without a backend**: a deck is shared as a link or QR code holding only
the three cards' stats, traits, rarity, sport and a normalised outline
(ends hidden, no coordinates, no dates beyond the season). The friend's app
plays the duel locally; both sides compute the same result. A copy of the
friend's card goes into a "From friends" page. Nothing is traded away: your
card is your run, and giving it would mean giving the run.

**With accounts**: a friends list, an inbox of duels, a notification when a
friend answers. Still no leaderboard, no ranking, no public profile.

**What brings you back**: a friend's deck waiting with a card you cannot
beat yet, on a stat you can improve. Steady is a stat you improve by
running *easier*.

**Risks**:
- A duel invites playing for the card: running a fast 5 km to beat a
  friend's Speed. Percentiles blunt it (beating your own history is hard
  every day) and the Steady stat pulls the other way, but it is the concept
  with most pull towards intensity.
- Shared decks reveal something: a shape and a season. Hiding ends and
  stripping coordinates and dates keeps that to what a shared picture
  already shows.
- Cheating has no payoff, since nothing is won but a copy of a card.

### C. Territory

**Cards are places, not runs.** The map is cut into cells (the heatmap's
grid); running through a cell for the first time gives its card, and
running a saved route gives the route's card, which levels up each time its
ghost is beaten.

- **Stats**: times run, best time, ghost gap, first and last visit.
- **What brings you back**: the edge of the map you have run, as in
  CityStrides and Squadrats. It rewards exploring, not speed, which makes
  it the gentlest of the three.
- **Backend**: none for one runner, the heatmap is already local. Comparing
  territories with others is a leaderboard by another name, and would need
  accounts.
- **Risks**: it loses the link between a card and *a run*, which is the
  idea's charm; the next cell gets further away every week; and a map of
  where someone runs is the most sensitive thing Tread holds, so it must
  never be shared as a map.

### Side by side

| | A. Album | B. Duels | C. Territory |
|---|---|---|---|
| A card is | a run | a run | a place |
| Done with cards | sets | sets, duels | map, route levels |
| Brings you back | empty slots | a friend's deck | the map's edge |
| Pull towards intensity | low | medium | low |
| Fits the promise | fully | locally yes, inbox no | fully, if never shared |
| Backend | none | none (links) / accounts (inbox) | none |
| Effort | medium | medium after A | medium |

---

## 4. Recommendation

**Build the Album (A). Fold Territory (C) into it as two sets (My routes,
New ground). Keep Duels (B) for later, played by link, and only after the
Album has shown that people care.**

- The Album keeps the promise whole: no account, nothing leaves the phone.
- It makes the run itself the reward, which no competitor does.
- It is the strongest switching argument: import your history, get your
  album.
- Its sets reward the habits a plan wants (variety, the long run, the easy
  day, the plan's weeks), not volume or suffering.
- Duels, if they come, reuse every card and stat unchanged, and work by
  link before any backend. Whether they ever need an inbox is a question
  for the day accounts exist, and for `ROADMAP.md`'s "Not doing" list.

### First step, without a backend

One release, everything on the phone:

1. **`packages/core/src/card.ts`**: pure functions `cardOf(run, history)`,
   `traitsOf`, `rarityOf`, `statsOf`, `setsOf`, with the safety and speed
   rules. Fully unit-tested, like `efforts.ts` and `ghost.ts`: same run,
   same card; a ride never in a running set; a heatwave run is Common; two
   very hard runs earn nothing more; a 2:00 km voids the traits.
2. **No stored stamp, after all**: `listRuns()` already holds every run and
   dealing the whole history takes a moment, so cards are computed where
   they are shown. No migration, nothing to go stale. A `card` column comes
   back only if the history grows large enough to make it slow.
3. **The run's page**: the card under the map, with its traits in words.
4. **Profile**: a `RecordRow` with a chevron, "Collection · 42 cards ·
   3 sets complete", leading to a Collection page: sets as sections
   (`SectionHeader`, "4 / 7" as aside), cards in a grid, empty slots
   showing what fills them. An empty collection uses `EmptyState`.
5. **Sharing**: a card as a picture through the existing `ShareCard` path,
   privacy radius applied.
6. **Three sets to start**: First steps, Distances, Around the clock. The
   others come once the first ones have been used.

Not in the first step: duels, seasonal sets, ride sets, any suggestion in
the Plan tab.

**How to know it works**, without analytics (the promise forbids them):
TestFlight builds and conversations with a dozen runners; whether they open
the collection without being told; whether they mention a slot as a reason
to have gone out; and whether anyone ran harder or worse because of it.

---

## Words

Every string goes in a `defineStrings({ fr, en })` table. A first draft, in
the app's voice (short, *tu*, no exclamation marks, no emoji):

| Key | fr | en |
|---|---|---|
| `collection` | Collection | Collection |
| `cardsCount` | 42 cartes · 3 séries complètes | 42 cards · 3 sets complete |
| `common` | Commune | Common |
| `notable` | Remarquable | Notable |
| `rare` | Rare | Rare |
| `exceptional` | Exceptionnelle | Exceptional |
| `endurance` | Endurance | Endurance |
| `speed` | Vitesse | Speed |
| `climb` | Montée | Climb |
| `steady` | Régularité | Steady |
| `slotEarly` | Une sortie avant 7 h | A run before 7:00 |
| `traitPatience` | Patience : facile tenu facile | Patience: easy kept easy |
| `tooFast` | Trop rapide pour une course. C'était à vélo ? | Too fast for a run. Was it a ride? |
| `restNote` | Deux sorties très dures d'affilée. La prochaine carte attend un jour plus facile. | Two very hard runs in a row. The next card waits for an easier day. |
| `imported` | Importée | Imported |

---

## Sources

Retrieved in November 2026. Several are blogs or trade press; claims from
the companies themselves are marked as such above.

- Adrian Hon, ["Two million runners"](https://medium.com/@adrianhon/two-million-runners-five-cdb53cd793a1), 2015 (developer's own retention claim)
- [Zombies, Run! on Wikipedia](https://en.wikipedia.org/wiki/Zombies,_Run!)
- [Zombies, Run! on the App Store](https://apps.apple.com/au/app/zombies-run/id503519713)
- Nike, ["What challenges are there in the NRC app?"](https://www.nike.com/help/a/nrc-challenges)
- The Drum, ["Nike's redesign of its popular running app angers users"](https://www.thedrum.com/news/2016/08/29/nikes-redesign-its-popular-running-app-angers-users), 2016
- Refinery29, [Nike running app redesign critique](https://www.refinery29.com/2016/08/121457/nike-running-app-redesign-critique), 2016
- Mariposa Bicycles, ["The risks of gamified training"](https://mariposabicycles.ca/blogs/features/the-risks-of-gamified-training-balancing-pbs-with-true-development)
- the5krunner, ["How fitness apps trade athletic progression for daily engagement"](https://the5krunner.com/2026/06/09/how-modern-fitness-apps-ruin-real-progress/), 2026
- NZ Herald, ["Inside the murky world of the Strava cheats"](https://nzherald.co.nz/lifestyle/inside-the-murky-world-of-the-strava-cheats/BWUUVJP5YJFZLHLAB5TF27NJXQ)
- Cycling Weekly, ["Strava clamps down on vehicle cheats"](https://cyclingweekly.com/news/strava-clamps-down-on-vehicle-cheats-in-new-update)
- Fatherly, ["The Strava strain"](https://www.fatherly.com/health/the-strava-strain)
- University of Stirling, [study of runners ending 100-day streaks](https://www.stir.ac.uk/research/hub/file/2261489)
- The Motley Fool / Nasdaq, ["Should investors be worried about STEPN?"](https://www.nasdaq.com/articles/should-investors-be-worried-about-stepn), 2022
- AMBCrypto, [STEPN, spam accounts and attacks](https://ambcrypto.com/stepn-amid-reports-of-spam-accounts-and-ddos-attacks-how-are-its-tokens-reacting/)
- Decrypt, [STEPN tokens fall as China play is blocked](https://decrypt.co/101510/stepn-move-earn-cryptocurrencies-plummet-gameplay-blocked-china), 2022
- Serebii, [Pokémon GO Adventure Sync](https://serebii.net/pokemongo/adventuresync.shtml)
- Niantic, [Adventure Sync announcement](https://pokemongo.com/news/adventure-sync)
- [CityStrides](https://citystrides.com/)
- VeloViewer, [Explorer overview](https://blog.veloviewer.com/veloviewer-explorer-overview/)
- We Love Cycling, ["Tile hunting: how to get started"](https://www.welovecycling.com/wide/2026/04/07/tile-hunting-how-to-get-started/), 2026
- Duke, [#EveryStreet Durham](https://sites.duke.edu/davidbradway/?p=85)
- [Deckcore – Rise to Run](https://play.google.com/store/apps/details?id=com.deckcore.game), [StrideBound](https://apps.apple.com/app/stridebound/id6751173998), [Dragon Run](https://mwm.ai/apps/dragon-run-hatch-by-running/6752803940), [Run Visuals](https://apps.apple.com/pl/app/run-visuals/id6759010004)
- Mazeas et al., ["Effects of gamified smartphone applications on physical activity"](https://pubmed.ncbi.nlm.nih.gov/34893387/), JMIR 2022
- TUM, [on Yang et al., American Journal of Preventive Medicine 2022](https://www.hs.mh.tum.de/en/mgt/news-single-view-en/article/american-journal-of-preventive-medicine-beitrag-zeigt-wann-smartphone-apps-mit-spielerischen-elementen-koerperliche-aktivitaet-foerdern)
- Taylor Wessing, ["An iPhone, a gambling problem and the loot box debate"](https://www.taylorwessing.com/en/insights-and-events/insights/2025/03/an-iphone-a-gambling-problem-and-the-loot-box-debate), 2025
- PC Gamer, ["The Netherlands moves toward an outright loot box ban"](https://pcgamer.com/the-netherlands-moves-toward-an-outright-loot-box-ban)
- Fieldfisher, [EU report on a consumer protection approach to loot boxes](https://www.fieldfisher.com/en/services/technology-outsourcing-and-privacy/technology-and-outsourcing-blog/consumer-protection-approach-to-tackle-loot-boxes)

---

## What was built

The Album first, then, on top of it and still without a backend:

- **The reveal** (`apps/mobile/src/app/card.tsx`). A run's card arrives face
  down at the top of its page; turned on a stage of its own, its traits said
  one at a time. Rare cards and better lean with the phone, their outline
  standing off the paper (`TiltCard`). The past runs' cards are all dealt
  already; the first opening turns over the five finest, and later bursts
  (an import, a new phone) the eight finest.
- **Great cards** (`packages/core/src/metaCard.ts`). A week counts when the
  weekly goal is met, or with two runs without one; its tier comes from the
  variety of its traits, not from its kilometres. Four weeks in a row make a
  block. Every race (tagged, or a plan's race session) seals the runs of the
  twelve weeks before it, back to the race before, as a legendary card.
- **Duels** (`packages/core/src/duel.ts`). Five cards, a budget of 12 (1 to
  4 by rarity), one exceptional at most, so a deck needs plain cards too.
  Five rounds, each on one stat, every stat at least once, the terrains
  taken from a hash of both decks so both phones play the same duel. Traits
  are keywords: a record +15 on speed, the longest run +15 on endurance,
  Session held +15 on steadiness, Patience +12 against a faster card, the
  ghost +12 when behind. The link holds the cards alone (number, rarity,
  stats, traits, distance to 100 m) with a checksum against a link cut
  short; it can be edited by hand, which is acceptable for a game between
  friends with nothing at stake.
- **The campaign** (`packages/core/src/campaign.ts`). Chapters are the plan's
  phases; guardians are each phase's longest long run and last quality
  session; the race closes the last chapter. Only a way of reading the plan.

**Calibrated after a first look.** On a beginner's first weeks almost every
long run broke a record and the longest distance at once, and the two
together made an exceptional card a week. Now a record must be 1 % faster,
over 1 km or more (a 400 m caught by GPS inside repeats is noise), the
longest run must be 5 % longer, and a record and the longest run on the same
day count for four points rather than six, since they are mostly one event.
On a simulated year (fast progress for four months, then a plateau, a race
a season) that deals about 72 % common, 25 % notable, 3 % rare, and an
exceptional card only on a day out of the ordinary.

Still out: printed cards, seasonal sets, ride sets, an inbox of duels.
