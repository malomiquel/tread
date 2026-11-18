import { sportOf, type ActivityType, type RunTag, type Sport } from "./activity.ts";
import { EFFORT_KEYS, effortName, type BestEfforts } from "./efforts.ts";
import { defineStrings } from "./i18n.ts";
import type { Exertion } from "./plan.ts";
import type { RanBlock } from "./workout.ts";

/**
 * The card a run leaves behind, and the album the cards fill.
 *
 * A card is worked out from the run and from the runs before it, never drawn
 * at random and never stored: the same history always deals the same cards,
 * an edited run is dealt again, a deleted one takes its card with it. That
 * is what keeps a card honest, and what keeps it out of anything a regulator
 * would call a loot box. See `docs/gamification.md` for the reasoning.
 *
 * What it rewards is chosen with the runner's body in mind: nothing for
 * volume, nothing for a day in a row, little for weather and nothing at all
 * for the worst of it, and as much for an easy day kept easy as for a ghost
 * beaten.
 */

/** What a card is read from: the parts of a run it looks at. */
export interface CardRun {
  id: number;
  startedAt: number;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  elevationGainM: number | null;
  fastestKmS: number | null;
  exertion: Exertion | null;
  sessionId: string | null;
  blocks: readonly RanBlock[];
  weather: CardWeather | null;
  bestEfforts: BestEfforts | null;
  routeId: number | null;
  activity: ActivityType;
  tags: readonly RunTag[];
}

/** The weather readings a card looks at. */
export interface CardWeather {
  feelsLikeC: number;
  windKmh: number;
  precipitationMm: number;
  code: number | null;
}

export type Rarity = "common" | "notable" | "rare" | "exceptional";
export const RARITIES: readonly Rarity[] = ["common", "notable", "rare", "exceptional"];

export type Trait =
  | "best" | "longest" | "ghost" | "race" | "session" | "patience"
  | "climb" | "early" | "late" | "rain" | "snow" | "wind" | "cold" | "anniversary";

/** Why a card holds no traits, when it is for a reason worth saying. */
export type CardNote = "tooFast" | "rest";

export type StatKey = "endurance" | "speed" | "climb" | "steady";
export const STAT_KEYS: readonly StatKey[] = ["endurance", "speed", "climb", "steady"];

/** Each from 1 to 99, or null when the run has nothing to measure it by. */
export type CardStats = Record<StatKey, number | null>;

export interface Card {
  runId: number;
  /** Its place in the collection: the nth outing of its sport. */
  number: number;
  sport: Sport;
  stats: CardStats;
  /** In the order they are worth most. */
  traits: Trait[];
  rarity: Rarity;
  note: CardNote | null;
}

const POINTS: Record<Trait, number> = {
  best: 3, longest: 3, ghost: 2, race: 2, session: 2, patience: 2,
  climb: 1, early: 1, late: 1, rain: 1, snow: 1, wind: 1, cold: 1, anniversary: 1,
};

/** How many points a card's traits add up to. */
export const cardPoints = (traits: readonly Trait[]): number =>
  traits.reduce((sum, trait) => sum + POINTS[trait], 0);

export function rarityOf(traits: readonly Trait[]): Rarity {
  const points = cardPoints(traits);
  if (points >= 6) return "exceptional";
  if (points >= 4) return "rare";
  if (points >= 2) return "notable";
  return "common";
}

/**
 * Faster than anyone runs: a kilometre under 2:20, or an average over
 * 25 km/h for 2 km or more. A run that fast was a ride, or a car, or a GPS
 * having a bad day, and earns nothing as a run.
 */
const RUN_FASTEST_KM_S = 140;
const RUN_FASTEST_AVG_S_KM = 144;

function tooFastForARun(run: CardRun): boolean {
  if (sportOf(run.activity) !== "running") return false;
  if (run.fastestKmS !== null && run.fastestKmS > 0 && run.fastestKmS < RUN_FASTEST_KM_S) return true;
  return run.distanceM >= 2000 && run.avgPaceSKm !== null && run.avgPaceSKm > 0
    && run.avgPaceSKm < RUN_FASTEST_AVG_S_KM;
}

/** Thunderstorm codes: no card asks for a run under one. */
const STORM = (code: number) => code >= 95 && code <= 99;
const SNOW = (code: number) => (code >= 71 && code <= 77) || code === 85 || code === 86;

/**
 * At most one weather trait, and none outside the conditions anyone should
 * be asked to run in: a heatwave run is a common card, on purpose.
 */
function weatherTrait(weather: CardWeather | null): Trait | null {
  if (!weather) return null;
  if (weather.feelsLikeC > 30 || weather.feelsLikeC < -10 || weather.windKmh > 50) return null;
  if (weather.code !== null && STORM(weather.code)) return null;
  if (weather.code !== null && SNOW(weather.code)) return "snow";
  if (weather.precipitationMm >= 0.3) return "rain";
  if (weather.windKmh >= 25) return "wind";
  if (weather.feelsLikeC <= 2) return "cold";
  return null;
}

/** A block run through, give or take its last few percent. */
const blockDone = (block: RanBlock): boolean => {
  if (block.targetMetres) return block.distanceM >= block.targetMetres * 0.95;
  if (block.targetSeconds) return block.durationS >= block.targetSeconds * 0.95;
  return true;
};

const sessionHeld = (run: CardRun): boolean =>
  run.sessionId !== null && run.blocks.length > 0 && run.blocks.every(blockDone);

/**
 * What a stat is measured by. Higher is better for every one: pace has its
 * sign turned so that it is too.
 */
function measures(run: CardRun): Record<StatKey, number | null> {
  const km = run.distanceM / 1000;
  const indoor = run.activity === "treadmill";
  return {
    endurance: run.distanceM > 0 ? run.distanceM : null,
    speed: run.avgPaceSKm && run.avgPaceSKm > 0 ? -run.avgPaceSKm : null,
    climb: !indoor && run.elevationGainM !== null && km >= 0.5 ? run.elevationGainM / km : null,
    // How close the average came to the fastest kilometre: an even run
    // scores high, a run gone off too fast scores low.
    steady: !run.sessionId && run.fastestKmS && run.avgPaceSKm && run.distanceM >= 2000
      ? Math.min(1, run.fastestKmS / run.avgPaceSKm)
      : null,
  };
}

/**
 * What the first runs are ranked against, before there is a history to rank
 * them in: ten plain outings a newer runner might have done, per sport.
 * Topped up until the runner's own number ten, then left out.
 */
const REFERENCE: Record<Sport, Record<StatKey, number[]>> = {
  running: {
    endurance: [2000, 3000, 4000, 5000, 5000, 6000, 8000, 10_000, 12_000, 15_000],
    speed: [480, 450, 420, 400, 380, 360, 345, 330, 315, 300].map((pace) => -pace),
    climb: [0, 2, 4, 6, 8, 10, 15, 20, 30, 50],
    steady: [0.7, 0.75, 0.8, 0.83, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96],
  },
  cycling: {
    endurance: [10_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 60_000, 80_000, 100_000],
    speed: [240, 220, 200, 190, 180, 170, 160, 150, 140, 130].map((pace) => -pace),
    climb: [0, 2, 4, 6, 8, 10, 15, 20, 30, 50],
    steady: [0.7, 0.75, 0.8, 0.83, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96],
  },
};

const BASELINE = 10;

/** Where a value falls among the ones before it, from 1 to 99. */
function rank(value: number, earlier: readonly number[], reference: readonly number[]): number {
  const pool = earlier.length >= BASELINE
    ? earlier
    : [...earlier, ...reference.slice(0, BASELINE - earlier.length)];
  let below = 0;
  for (const other of pool) {
    if (other < value) below += 1;
    else if (other === value) below += 0.5;
  }
  return 1 + Math.round((98 * below) / pool.length);
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

interface History {
  count: number;
  first: CardRun | null;
  longestM: number;
  efforts: Record<string, number>;
  /** Fastest time on each route, by route id. */
  routes: Map<number, number>;
  paces: number[];
  measures: Record<StatKey, number[]>;
  lastExertion: Exertion | null;
  /** The days an anniversary has already been dealt on. */
  anniversaries: Set<string>;
}

const emptyHistory = (): History => ({
  count: 0, first: null, longestM: 0, efforts: {}, routes: new Map(), paces: [],
  measures: { endurance: [], speed: [], climb: [], steady: [] },
  lastExertion: null, anniversaries: new Set(),
});

function traitsOf(run: CardRun, before: History): Trait[] {
  const traits: Trait[] = [];
  const indoor = run.activity === "treadmill";

  if (run.bestEfforts && Object.entries(run.bestEfforts).some(
    ([key, seconds]) => before.efforts[key] !== undefined && seconds < before.efforts[key],
  )) traits.push("best");
  if (before.count > 0 && run.distanceM > before.longestM) traits.push("longest");
  if (!indoor && run.routeId !== null) {
    const record = before.routes.get(run.routeId);
    if (record !== undefined && run.durationS < record) traits.push("ghost");
  }
  if (run.tags.includes("race")) traits.push("race");
  if (sessionHeld(run)) traits.push("session");
  // An easy day kept easy: slower than the runner's usual, and not felt as hard.
  if (
    (run.tags.includes("easy") || run.tags.includes("recovery"))
    && run.avgPaceSKm !== null && before.paces.length >= 3 && run.avgPaceSKm >= median(before.paces)
    && (run.exertion === null || run.exertion <= 2)
  ) traits.push("patience");
  if (!indoor && run.elevationGainM !== null && run.elevationGainM >= 100
    && run.elevationGainM / Math.max(run.distanceM / 1000, 0.1) >= 15) traits.push("climb");

  const started = new Date(run.startedAt);
  const hour = started.getHours();
  if (hour < 7) traits.push("early");
  else if (hour >= 21) traits.push("late");

  const weather = indoor ? null : weatherTrait(run.weather);
  if (weather) traits.push(weather);

  if (before.first) {
    const first = new Date(before.first.startedAt);
    if (started.getFullYear() > first.getFullYear() && started.getMonth() === first.getMonth()
      && started.getDate() === first.getDate() && !before.anniversaries.has(dayKey(started))) {
      traits.push("anniversary");
    }
  }
  return traits;
}

function remember(history: History, run: CardRun, traits: readonly Trait[], values: Record<StatKey, number | null>) {
  history.count += 1;
  history.first ??= run;
  history.longestM = Math.max(history.longestM, run.distanceM);
  for (const [key, seconds] of Object.entries(run.bestEfforts ?? {})) {
    if (history.efforts[key] === undefined || seconds < history.efforts[key]) history.efforts[key] = seconds;
  }
  if (run.routeId !== null && run.activity !== "treadmill") {
    const record = history.routes.get(run.routeId);
    if (record === undefined || run.durationS < record) history.routes.set(run.routeId, run.durationS);
  }
  if (run.avgPaceSKm) history.paces.push(run.avgPaceSKm);
  for (const key of STAT_KEYS) {
    const value = values[key];
    if (value !== null) history.measures[key].push(value);
  }
  if (traits.includes("anniversary")) history.anniversaries.add(dayKey(new Date(run.startedAt)));
  history.lastExertion = run.exertion;
}

/**
 * Every run's card, by run id.
 *
 * In one pass from the oldest, each sport ranked against itself: a ride
 * never makes a runner's card look slow, nor fills a runner's set.
 */
export function cardsOf(runs: readonly CardRun[]): Map<number, Card> {
  const cards = new Map<number, Card>();
  const histories: Record<Sport, History> = { running: emptyHistory(), cycling: emptyHistory() };
  const numbers: Record<Sport, number> = { running: 0, cycling: 0 };
  const ordered = [...runs].sort((a, b) => a.startedAt - b.startedAt || a.id - b.id);

  for (const run of ordered) {
    const sport = sportOf(run.activity);
    const history = histories[sport];
    numbers[sport] += 1;
    const values = measures(run);

    let note: CardNote | null = null;
    let traits: Trait[] = [];
    if (tooFastForARun(run)) note = "tooFast";
    else if (run.exertion === 5 && history.lastExertion === 5) note = "rest";
    else traits = traitsOf(run, history);

    const stats = {} as CardStats;
    for (const key of STAT_KEYS) {
      const value = values[key];
      stats[key] = value === null ? null : rank(value, history.measures[key], REFERENCE[sport][key]);
    }
    // A session's steadiness is how much of it was run as written.
    if (run.sessionId && run.blocks.length > 0) {
      stats.steady = 1 + Math.round((98 * run.blocks.filter(blockDone).length) / run.blocks.length);
    }

    cards.set(run.id, {
      runId: run.id, number: numbers[sport], sport, stats, traits, rarity: rarityOf(traits), note,
    });

    // A run too fast to be one is kept out of what later runs are measured
    // against: it would make every honest run after it look slow.
    if (note !== "tooFast") remember(history, run, traits, values);
  }
  return cards;
}

// ─── The album ───────────────────────────────────────────────────────────

export type SetId = "firstSteps" | "distances" | "clock";
export const SET_IDS: readonly SetId[] = ["firstSteps", "distances", "clock"];

export interface Slot {
  /** Stable within its set: "first5k", "5000", "dawn". */
  key: string;
  /** The run that fills it, or null while it is empty. */
  runId: number | null;
}

export interface CardSet {
  id: SetId;
  slots: Slot[];
}

/** The hours a day is cut into, for the Around the clock set. */
export const CLOCK_BANDS = [
  { key: "dawn", from: 0, to: 7 },
  { key: "morning", from: 7, to: 10 },
  { key: "midday", from: 10, to: 14 },
  { key: "afternoon", from: 14, to: 18 },
  { key: "evening", from: 18, to: 21 },
  { key: "night", from: 21, to: 24 },
] as const;

/**
 * The album's pages, from a runner's runs and their cards.
 *
 * Runs only: a ride fills none of these, and a run too fast to be one fills
 * nothing either. None of the slots asks for a speed: an hour, a distance
 * run once, a first. The distance slots hold the run with the best time, so
 * they change hands as the runner gets faster.
 */
export function setsOf(runs: readonly CardRun[], cards: ReadonlyMap<number, Card>): CardSet[] {
  const counted = runs
    .filter((run) => {
      const card = cards.get(run.id);
      return card !== undefined && card.sport === "running" && card.note !== "tooFast";
    })
    .sort((a, b) => a.startedAt - b.startedAt || a.id - b.id);

  const firstWhere = (test: (run: CardRun) => boolean): number | null =>
    counted.find(test)?.id ?? null;

  const firstSteps: Slot[] = [
    { key: "firstRun", runId: firstWhere(() => true) },
    { key: "first5k", runId: firstWhere((run) => run.distanceM >= 5000) },
    { key: "first10k", runId: firstWhere((run) => run.distanceM >= 10_000) },
    { key: "firstRoute", runId: firstWhere((run) => run.routeId !== null) },
    { key: "firstSession", runId: firstWhere((run) => run.sessionId !== null) },
  ];

  const distances: Slot[] = EFFORT_KEYS.map((key) => {
    let best: { id: number; seconds: number } | null = null;
    for (const run of counted) {
      const seconds = run.bestEfforts?.[key];
      if (seconds !== undefined && (best === null || seconds < best.seconds)) best = { id: run.id, seconds };
    }
    return { key, runId: best?.id ?? null };
  });

  const clock: Slot[] = CLOCK_BANDS.map((band) => ({
    key: band.key,
    runId: firstWhere((run) => {
      const hour = new Date(run.startedAt).getHours();
      return hour >= band.from && hour < band.to;
    }),
  }));

  return [
    { id: "firstSteps", slots: firstSteps },
    { id: "distances", slots: distances },
    { id: "clock", slots: clock },
  ];
}

export const filledCount = (set: CardSet): number => set.slots.filter((slot) => slot.runId !== null).length;
export const isComplete = (set: CardSet): boolean => filledCount(set) === set.slots.length;

/** The cards most worth showing first: rarest, then most recent. */
export function rarestCards(cards: ReadonlyMap<number, Card>, runs: readonly CardRun[], limit = 5): Card[] {
  const startedAt = new Map(runs.map((run) => [run.id, run.startedAt]));
  return [...cards.values()]
    .filter((card) => card.sport === "running" && card.traits.length > 0)
    .sort((a, b) => cardPoints(b.traits) - cardPoints(a.traits)
      || (startedAt.get(b.runId) ?? 0) - (startedAt.get(a.runId) ?? 0))
    .slice(0, limit);
}

// ─── Words ───────────────────────────────────────────────────────────────

export const cardWords = defineStrings({
  fr: {
    rarity: {
      common: "Commune", notable: "Remarquable", rare: "Rare", exceptional: "Exceptionnelle",
    } as Record<Rarity, string>,
    stat: {
      endurance: "Endurance", speed: "Vitesse", climb: "Montée", steady: "Régularité",
    } as Record<StatKey, string>,
    trait: {
      best: "Record battu", longest: "Plus longue sortie", ghost: "Fantôme battu", race: "Jour de course",
      session: "Séance tenue", patience: "Patience", climb: "Grimpée", early: "À l'aube",
      late: "De nuit", rain: "Sous la pluie", snow: "Sous la neige", wind: "Dans le vent",
      cold: "Dans le froid", anniversary: "Un an déjà",
    } as Record<Trait, string>,
    note: {
      tooFast: "Trop rapide pour une course. C'était à vélo ?",
      rest: "Deux sorties très dures d'affilée. La prochaine carte attend un jour plus facile.",
    } as Record<CardNote, string>,
    number: (n: number) => `N° ${String(n).padStart(3, "0")}`,
    set: {
      firstSteps: "Premiers pas", distances: "Distances", clock: "Toutes les heures",
    } as Record<SetId, string>,
    slot: {
      firstRun: "Ta première sortie",
      first5k: "Une sortie de 5 km",
      first10k: "Une sortie de 10 km",
      firstRoute: "Un de tes parcours",
      firstSession: "Une séance guidée",
      dawn: "Avant 7 h",
      morning: "Le matin, 7 h – 10 h",
      midday: "À midi, 10 h – 14 h",
      afternoon: "L'après-midi, 14 h – 18 h",
      evening: "En soirée, 18 h – 21 h",
      night: "Après 21 h",
    } as Record<string, string>,
    slotEffort: (distance: string) => `${distance} d'une traite`,
  },
  en: {
    rarity: {
      common: "Common", notable: "Notable", rare: "Rare", exceptional: "Exceptional",
    },
    stat: {
      endurance: "Endurance", speed: "Speed", climb: "Climb", steady: "Steady",
    },
    trait: {
      best: "Record broken", longest: "Longest run", ghost: "Ghost beaten", race: "Race day",
      session: "Session held", patience: "Patience", climb: "Climb", early: "At dawn",
      late: "At night", rain: "In the rain", snow: "In the snow", wind: "In the wind",
      cold: "In the cold", anniversary: "A year already",
    },
    note: {
      tooFast: "Too fast for a run. Was it a ride?",
      rest: "Two very hard runs in a row. The next card waits for an easier day.",
    },
    number: (n: number) => `No. ${String(n).padStart(3, "0")}`,
    set: {
      firstSteps: "First steps", distances: "Distances", clock: "Around the clock",
    },
    slot: {
      firstRun: "Your first run",
      first5k: "A 5 km run",
      first10k: "A 10 km run",
      firstRoute: "One of your routes",
      firstSession: "A guided session",
      dawn: "Before 7:00",
      morning: "Morning, 7:00 – 10:00",
      midday: "Midday, 10:00 – 14:00",
      afternoon: "Afternoon, 14:00 – 18:00",
      evening: "Evening, 18:00 – 21:00",
      night: "After 21:00",
    },
    slotEffort: (distance: string) => `${distance} in one go`,
  },
});

/** What fills a slot, in words: "Before 7:00", "5K in one go". */
export function slotName(set: SetId, key: string): string {
  const words = cardWords();
  if (set === "distances") return words.slotEffort(effortName(key));
  return words.slot[key] ?? key;
}
