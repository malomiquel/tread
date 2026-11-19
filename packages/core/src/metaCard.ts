import { cardPoints, cardWords, RARITIES, type Card, type CardRun, type Rarity, type Trait } from "./card.ts";
import { measure, type WeeklyGoal } from "./goals.ts";
import { defineStrings, intlLocale } from "./i18n.ts";
import { sessionKind } from "./plan.ts";
import { weekStart } from "./stats.ts";

/**
 * The cards dealt for more than one run: a week held, a block of weeks, a
 * race and the training that led to it.
 *
 * Like a run's card, each is worked out from the history and never stored,
 * so it appears, changes and disappears with the runs it is made of.
 *
 * What they reward is regularity, not volume. A week counts when the weekly
 * goal is met (the runner's own figure, not one the app chose), or, without
 * a goal, when it held two runs. Its tier comes from how varied its cards
 * were, not from how far it went: an easy run kept easy is worth as much to
 * a week as a record.
 */

export type MetaKind = "week" | "block" | "race";

/** Ranked against the run cards' rarities; a race card stands above them all. */
export type MetaTier = Rarity | "legendary";

export interface MetaCard {
  kind: MetaKind;
  /** Stable while its runs stay the same: "week-1730674800000". */
  key: string;
  /** Its place among the cards of its kind, from the oldest. */
  number: number;
  /** The first day it covers, and the last run in it. */
  from: number;
  to: number;
  /** The runs it is made of, oldest first. For a race, the race itself last. */
  runIds: number[];
  runs: number;
  distanceM: number;
  durationS: number;
  /** Every distinct trait its runs earned, worth most first. */
  traits: Trait[];
  /** How many of its runs dealt a rare card or better. */
  rareCards: number;
  tier: MetaTier;
  /** For a race card: the race run. */
  raceRunId: number | null;
  /** For a block: how many weeks it holds. */
  weeks: number;
}

/** Two runs make a week worth a card, without a goal to meet. */
export const WEEK_MIN_RUNS = 2;
/** Weeks held in a row that make a block. */
export const BLOCK_WEEKS = 4;
/** How far back a race card reaches for the training that led to it. */
export const PREPARATION_WEEKS = 12;

const DAY_MS = 86_400_000;

/** The runs a meta card may be made of: runs, dealt honestly. */
function counted(runs: readonly CardRun[], cards: ReadonlyMap<number, Card>): CardRun[] {
  return runs
    .filter((run) => {
      const card = cards.get(run.id);
      return card !== undefined && card.sport === "running" && card.note !== "tooFast";
    })
    .sort((a, b) => a.startedAt - b.startedAt || a.id - b.id);
}

function summary(runs: readonly CardRun[], cards: ReadonlyMap<number, Card>) {
  const traits = new Set<Trait>();
  let rareCards = 0;
  for (const run of runs) {
    const card = cards.get(run.id);
    if (!card) continue;
    for (const trait of card.traits) traits.add(trait);
    if (card.rarity === "rare" || card.rarity === "exceptional") rareCards += 1;
  }
  return {
    runIds: runs.map((run) => run.id),
    runs: runs.length,
    distanceM: runs.reduce((sum, run) => sum + run.distanceM, 0),
    durationS: runs.reduce((sum, run) => sum + run.durationS, 0),
    traits: [...traits].sort((a, b) => cardPoints([b]) - cardPoints([a])),
    rareCards,
  };
}

/** A week's tier, from the variety of what it earned. */
function weekTier(traits: readonly Trait[]): Rarity {
  const worth = cardPoints(traits);
  if (worth >= 8) return "exceptional";
  if (worth >= 5) return "rare";
  if (worth >= 2) return "notable";
  return "common";
}

/** Whether a week's runs make it count. */
function held(runs: readonly CardRun[], goal: WeeklyGoal | null): boolean {
  if (goal === null) return runs.length >= WEEK_MIN_RUNS;
  const covered = runs.reduce((sum, run) => sum + measure(goal.kind, {
    distanceM: run.distanceM, durationS: run.durationS, climbM: run.elevationGainM ?? 0,
  }), 0);
  return covered >= goal.target;
}

/**
 * Every week held, oldest first.
 *
 * The week under way gets its card as soon as it counts, like the streak:
 * a goal met on Thursday is met.
 */
export function weekCards(
  runs: readonly CardRun[],
  cards: ReadonlyMap<number, Card>,
  goal: WeeklyGoal | null,
): MetaCard[] {
  const weeks = new Map<number, CardRun[]>();
  for (const run of counted(runs, cards)) {
    const start = weekStart(run.startedAt);
    const list = weeks.get(start) ?? [];
    list.push(run);
    weeks.set(start, list);
  }
  const out: MetaCard[] = [];
  for (const [start, list] of [...weeks].sort((a, b) => a[0] - b[0])) {
    if (!held(list, goal)) continue;
    const facts = summary(list, cards);
    out.push({
      kind: "week", key: `week-${start}`, number: out.length + 1,
      from: start, to: list[list.length - 1].startedAt,
      ...facts, tier: weekTier(facts.traits), raceRunId: null, weeks: 1,
    });
  }
  return out;
}

/**
 * Every block of weeks held in a row, oldest first.
 *
 * A run of nine weeks makes two blocks, the ninth week waiting for three
 * more. A missed week ends a run; nothing already dealt is taken back.
 */
export function blockCards(weeks: readonly MetaCard[], cards: ReadonlyMap<number, Card>, runs: readonly CardRun[]): MetaCard[] {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const out: MetaCard[] = [];
  let streak: MetaCard[] = [];
  const flush = () => {
    for (let i = 0; i + BLOCK_WEEKS <= streak.length; i += BLOCK_WEEKS) {
      const group = streak.slice(i, i + BLOCK_WEEKS);
      const blockRuns = group.flatMap((week) => week.runIds).map((id) => byId.get(id)).filter((run) => run !== undefined);
      const facts = summary(blockRuns, cards);
      const worth = group.reduce((sum, week) => sum + RARITIES.indexOf(week.tier as Rarity), 0);
      const tier: Rarity = worth >= 9 ? "exceptional" : worth >= 6 ? "rare" : worth >= 3 ? "notable" : "common";
      out.push({
        kind: "block", key: `block-${group[0].from}`, number: out.length + 1,
        from: group[0].from, to: group[group.length - 1].to,
        ...facts, tier, raceRunId: null, weeks: BLOCK_WEEKS,
      });
    }
    streak = [];
  };
  for (const week of weeks) {
    const last = streak[streak.length - 1];
    // A day before a Monday is always in the week before, whatever the
    // clocks did in between.
    if (last && weekStart(week.from - DAY_MS) !== last.from) flush();
    streak.push(week);
  }
  flush();
  return out;
}

/** Whether a run was a race: tagged so, or the race session of a plan. */
export const isRace = (run: CardRun): boolean =>
  run.tags.includes("race") || sessionKind(run.sessionId) === "race";

/**
 * A card for every race, sealing the training that led to it: the runs of
 * the twelve weeks before, back to the race before at the furthest.
 */
export function raceCards(runs: readonly CardRun[], cards: ReadonlyMap<number, Card>): MetaCard[] {
  const ordered = counted(runs, cards);
  const out: MetaCard[] = [];
  let previous = -Infinity;
  for (const race of ordered.filter(isRace)) {
    const since = Math.max(previous, race.startedAt - PREPARATION_WEEKS * 7 * DAY_MS);
    const preparation = ordered.filter((run) => run.startedAt > since && run.startedAt < race.startedAt && !isRace(run));
    const facts = summary([...preparation, race], cards);
    out.push({
      kind: "race", key: `race-${race.id}`, number: out.length + 1,
      from: preparation[0]?.startedAt ?? race.startedAt, to: race.startedAt,
      ...facts, tier: "legendary", raceRunId: race.id, weeks: 0,
    });
    previous = race.startedAt;
  }
  return out;
}

export interface MetaAlbum {
  weeks: MetaCard[];
  blocks: MetaCard[];
  races: MetaCard[];
}

export function metaCardsOf(
  runs: readonly CardRun[],
  cards: ReadonlyMap<number, Card>,
  goal: WeeklyGoal | null,
): MetaAlbum {
  const weeks = weekCards(runs, cards, goal);
  return { weeks, blocks: blockCards(weeks, cards, runs), races: raceCards(runs, cards) };
}

/** The meta cards a run has just completed: the ones it is the last run of. */
export function completedBy(album: MetaAlbum, runId: number): MetaCard[] {
  return [...album.races, ...album.blocks, ...album.weeks]
    .filter((card) => card.runIds[card.runIds.length - 1] === runId);
}

// ─── Words ───────────────────────────────────────────────────────────────

const dayMonth = (ms: number) =>
  new Date(ms).toLocaleDateString(intlLocale(), { day: "numeric", month: "short" });

export const metaWords = defineStrings({
  fr: {
    kind: { week: "Semaine", block: "Bloc", race: "Course" } as Record<MetaKind, string>,
    kinds: { week: "Semaines tenues", block: "Blocs", race: "Jours de course" } as Record<MetaKind, string>,
    legendary: "Légendaire",
    weekOf: (from: number) => `Semaine du ${dayMonth(from)}`,
    blockOf: (from: number, to: number) => `Du ${dayMonth(from)} au ${dayMonth(to)}`,
    prepared: (runs: number) => `${runs} sortie${runs > 1 ? "s" : ""} pour y arriver`,
    runs: (runs: number) => `${runs} sortie${runs > 1 ? "s" : ""}`,
    rareCards: (count: number) => `${count} carte${count > 1 ? "s" : ""} rare${count > 1 ? "s" : ""}`,
    explain: {
      week: "Une semaine où ton objectif est tenu, ou deux sorties sans objectif.",
      block: `${BLOCK_WEEKS} semaines tenues d'affilée.`,
      race: "Chaque course scelle les sorties qui y ont mené.",
    } as Record<MetaKind, string>,
  },
  en: {
    kind: { week: "Week", block: "Block", race: "Race" },
    kinds: { week: "Weeks held", block: "Blocks", race: "Race days" },
    legendary: "Legendary",
    weekOf: (from: number) => `Week of ${dayMonth(from)}`,
    blockOf: (from: number, to: number) => `${dayMonth(from)} to ${dayMonth(to)}`,
    prepared: (runs: number) => `${runs} run${runs > 1 ? "s" : ""} to get there`,
    runs: (runs: number) => `${runs} run${runs > 1 ? "s" : ""}`,
    rareCards: (count: number) => `${count} rare card${count > 1 ? "s" : ""}`,
    explain: {
      week: "A week your goal was met, or two runs without a goal.",
      block: `${BLOCK_WEEKS} weeks held in a row.`,
      race: "Every race seals the runs that led to it.",
    },
  },
});

/** A meta card's tier in words. */
export function tierName(tier: MetaTier): string {
  return tier === "legendary" ? metaWords().legendary : cardWords().rarity[tier];
}
