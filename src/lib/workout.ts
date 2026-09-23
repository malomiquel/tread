import { decimal, defineStrings } from "./i18n.ts";

/** Structured sessions: what to run, and for how long, announced as you go. */

export type Effort = "warmup" | "fast" | "recovery" | "steady" | "cooldown";

/**
 * One block of a session, measured either in distance or in time — never both.
 *
 * The distinction is the whole point. A four-hundred-metre repetition is over
 * when four hundred metres are behind you, however long that took; a ninety
 * second recovery is over after ninety seconds, however far you got. Forcing
 * either into the other's unit is how a session stops matching the one the
 * runner meant to do.
 */
export interface Step {
  effort: Effort;
  metres?: number;
  seconds?: number;
}

export interface Session {
  id: string;
  name: string;
  steps: Step[];
}

/**
 * A block as it was actually run, kept with the finished run.
 *
 * The target is stored beside the result rather than looked up from the
 * catalogue later. A session edited or removed afterwards would otherwise
 * rewrite what a past run was asked to do, and a training log that changes
 * behind you is worse than none.
 */
export interface RanBlock {
  effort: Effort;
  targetMetres: number | null;
  targetSeconds: number | null;
  distanceM: number;
  durationS: number;
}

/** What is left of a step, in its own unit. Null in the unit it does not use. */
export interface Remaining {
  metres: number | null;
  seconds: number | null;
}

export function stepIsDone(step: Step, coveredM: number, elapsedS: number): boolean {
  if (step.metres !== undefined) return coveredM >= step.metres;
  if (step.seconds !== undefined) return elapsedS >= step.seconds;
  return false;
}

export function stepRemaining(step: Step, coveredM: number, elapsedS: number): Remaining {
  if (step.metres !== undefined) {
    return { metres: Math.max(0, step.metres - coveredM), seconds: null };
  }
  if (step.seconds !== undefined) {
    return { metres: null, seconds: Math.max(0, step.seconds - elapsedS) };
  }
  return { metres: null, seconds: null };
}

/** How a step is named aloud and on screen. */
/**
 * What each kind of block is called on screen.
 *
 * The efforts are identifiers, stored with every session and every run;
 * these are the words shown for them.
 */
const effortNames = defineStrings<Record<Effort, string>>({
  fr: {
    warmup: "échauffement",
    fast: "rapide",
    recovery: "récupération",
    steady: "allure",
    cooldown: "retour au calme",
  },
  en: {
    warmup: "warm-up",
    fast: "fast",
    recovery: "recovery",
    steady: "steady",
    cooldown: "cool-down",
  },
});

export const effortName = (effort: Effort): string => effortNames()[effort];

export function stepLabel(step: Step): string {
  const measure = step.metres !== undefined
    ? step.metres >= 1000
      ? `${decimal((step.metres / 1000).toString())} km`
      : `${step.metres} m`
    : `${Math.round((step.seconds ?? 0) / 60)} min`;
  return `${measure} ${effortName(step.effort)}`;
}

/**
 * Roughly how long a session takes, for the line under its name.
 *
 * Distance blocks are counted at five minutes a kilometre, which is a guess
 * and says so: the figure exists to tell a twenty minute session from an hour
 * long one, not to be relied upon.
 */
export function sessionMinutes(session: Session): number {
  const seconds = session.steps.reduce(
    (total, step) => total + (step.seconds ?? ((step.metres ?? 0) / 1000) * 300),
    0,
  );
  return Math.round(seconds / 60);
}

const repeat = (times: number, ...block: Step[]): Step[] =>
  Array.from({ length: times }, () => block).flat();

/**
 * The catalogue, kept deliberately short.
 *
 * Five sessions that between them cover what a runner actually alternates
 * between — short repetitions, threshold, a pyramid, an easy run and a long
 * one. A longer list would need a builder, and a builder is a different
 * feature.
 */
export const SESSIONS: Session[] = [
  {
    id: "400",
    name: "5 × 400 m",
    steps: [
      { effort: "warmup", seconds: 600 },
      ...repeat(5, { effort: "fast", metres: 400 }, { effort: "recovery", metres: 200 }),
      { effort: "cooldown", seconds: 300 },
    ],
  },
  {
    id: "threshold",
    name: "3 × 8 min au seuil",
    steps: [
      { effort: "warmup", seconds: 900 },
      ...repeat(3, { effort: "steady", seconds: 480 }, { effort: "recovery", seconds: 180 }),
      { effort: "cooldown", seconds: 600 },
    ],
  },
  {
    id: "pyramid",
    name: "Pyramide 1-2-3-2-1",
    steps: [
      { effort: "warmup", seconds: 600 },
      { effort: "fast", seconds: 60 }, { effort: "recovery", seconds: 60 },
      { effort: "fast", seconds: 120 }, { effort: "recovery", seconds: 120 },
      { effort: "fast", seconds: 180 }, { effort: "recovery", seconds: 180 },
      { effort: "fast", seconds: 120 }, { effort: "recovery", seconds: 120 },
      { effort: "fast", seconds: 60 },
      { effort: "cooldown", seconds: 600 },
    ],
  },
  {
    id: "easy",
    name: "Footing 30 min",
    steps: [{ effort: "steady", seconds: 1800 }],
  },
  {
    id: "long",
    name: "Sortie longue 1 h",
    // One block, like the easy run. Cutting a long run into a warm-up and a
    // cool-down announces three things where there is only one to do: go out
    // and run for an hour.
    steps: [{ effort: "steady", seconds: 3600 }],
  },
];

/** Consecutive blocks that repeat, folded into one line. */
export interface StepGroup {
  times: number;
  steps: Step[];
}

const sameStep = (a: Step, b: Step): boolean =>
  a.effort === b.effort && a.metres === b.metres && a.seconds === b.seconds;

/**
 * Fold a session's blocks into the shape a runner thinks in.
 *
 * Nobody holds twenty three blocks in their head. They hold a warm-up, six
 * repetitions, and a cool-down — which is the same session said in the way
 * it was designed. Listing every block flat is accurate and useless, and it
 * is what made "4 blocs" on screen tell you nothing about what they were.
 *
 * Cycles up to four blocks long are recognised, which covers everything the
 * generator and the catalogue produce: an effort with its recovery is two,
 * and nothing here alternates more richly than that.
 */
export function groupSteps(steps: Step[]): StepGroup[] {
  const groups: StepGroup[] = [];
  let at = 0;

  while (at < steps.length) {
    let bestSize = 1;
    let bestTimes = 1;

    for (let size = 1; size <= 4 && at + size * 2 <= steps.length; size += 1) {
      let times = 1;
      while (
        at + (times + 1) * size <= steps.length
        && steps.slice(at, at + size)
          .every((step, i) => sameStep(step, steps[at + times * size + i]))
      ) {
        times += 1;
      }
      // Longest run of blocks wins, so six of a pair beats three of a
      // four-block cycle covering the same ground.
      if (times > 1 && times * size > bestTimes * bestSize) {
        bestSize = size;
        bestTimes = times;
      }
    }

    groups.push({ times: bestTimes, steps: steps.slice(at, at + bestSize) });
    at += bestSize * bestTimes;
  }
  return groups;
}

/** How a group reads on one line — displayed. */
export function groupLabel(group: StepGroup): string {
  const body = group.steps.map(stepLabel).join(" + ");
  return group.times > 1 ? `${group.times} × (${body})` : body;
}

/** True for a block you hold a pace through, as opposed to one you survive. */
export function isPaced(step: Step): boolean {
  return step.effort === "fast" || step.effort === "steady";
}

/**
 * True when a session has at most one block to hold a pace through.
 *
 * Warming up and cooling down do not compete for a target: nobody holds a
 * figure through them, and counting them would rule out a long run, which has
 * exactly one pace to hold and half an hour of easy running around it. What
 * rules a target out is several efforts asking for different speeds — five
 * repetitions, or three blocks at threshold.
 */
export function hasSinglePace(session: Session): boolean {
  return session.steps.filter(isPaced).length <= 1;
}

/** "1 h 15", "45 min" — displayed. */
function durationName(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/**
 * The same session, asking for less.
 *
 * Repetitions come off before anything else, which is what a coach actually
 * says — do five instead of seven, not seven shorter ones. A session with
 * nothing to repeat has its working blocks shortened instead. The warm-up and
 * the cool-down are never touched: they are not the work, cutting them saves
 * a couple of minutes, and arriving at a repetition cold is how an easy day
 * becomes an injury.
 *
 * The name is rebuilt rather than kept. A card still reading "7 × 400 m" over
 * five repetitions would be the app lying about what it just asked for, which
 * is worse than not easing off at all.
 */
export function eased(session: Session, factor: number): Session {
  if (!(factor > 0) || factor >= 1) return session;
  const steps: Step[] = [];
  let repetitions: number | null = null;

  for (const group of groupSteps(session.steps)) {
    if (group.times > 1) {
      const times = Math.max(1, Math.round(group.times * factor));
      repetitions = times;
      for (let i = 0; i < times; i += 1) steps.push(...group.steps);
      continue;
    }
    steps.push(...group.steps.map((step) => {
      const spare = step.effort === "warmup" || step.effort === "cooldown";
      if (spare || step.seconds === undefined) return step;
      return { ...step, seconds: Math.max(300, Math.round((step.seconds * factor) / 300) * 300) };
    }));
  }

  return { ...session, id: `${session.id}-eased`, name: easedName(session.name, steps, repetitions), steps };
}

/** The name put back in step with the blocks underneath it. */
function easedName(name: string, steps: Step[], repetitions: number | null): string {
  if (repetitions !== null) return name.replace(/^\d+(?= × )/, String(repetitions));
  // A single-block session is named after its length, so the length is what
  // has to change.
  const minutes = Math.round((steps[0]?.seconds ?? 0) / 60);
  const rebuilt = name.replace(/\d+\s*(min|h)(\s*\d+)?$/, durationName(minutes));
  return rebuilt === name && minutes > 0 ? `${name} (${durationName(minutes)})` : rebuilt;
}

const sessionWords = defineStrings({
  fr: {
    easy: (duration: string) => `Footing ${duration}`,
    long: (duration: string) => `Sortie longue ${duration}`,
    threshold: (blocks: number, minutes: number) => `${blocks} × ${minutes} min au seuil`,
    pyramid: "Pyramide 1-2-3-2-1",
    races: { fiveK: "5 km", tenK: "10 km", half: "Semi-marathon", marathon: "Marathon" },
  },
  en: {
    easy: (duration: string) => `Easy run ${duration}`,
    long: (duration: string) => `Long run ${duration}`,
    threshold: (blocks: number, minutes: number) => `${blocks} × ${minutes} min at threshold`,
    pyramid: "Pyramid 1-2-3-2-1",
    races: { fiveK: "5 km", tenK: "10 km", half: "Half marathon", marathon: "Marathon" },
  },
});

/** The name of a race distance, by the goal id the programme stores. */
export function raceName(goal: string): string | null {
  const races: Record<string, string> = sessionWords().races;
  return races[goal] ?? null;
}

/**
 * What a session is called, in the interface's language.
 *
 * Worked out from what the session is rather than read from its `name`: that
 * field was written in French when the session was made, and is kept in every
 * programme and every run already on disk. The id says which kind it is and
 * the blocks say how much of it, which is everything the name ever said — so
 * it is also right for a session the programme has lightened. Anything this
 * does not recognise keeps the name it came with.
 */
export function sessionName(session: Session): string {
  const words = sessionWords();
  const kind = session.id.replace(/-eased$/, "");
  const fast = session.steps.filter((step) => step.effort === "fast");
  const paced = session.steps.filter((step) => step.effort === "steady");
  const minutesOf = (step: Step | undefined) => Math.round((step?.seconds ?? 0) / 60);

  if (kind === "easy" || kind.startsWith("easy-")) return words.easy(durationName(minutesOf(paced[0])));
  if (kind === "long" || kind.startsWith("long-")) return words.long(durationName(minutesOf(paced[0])));
  if (kind === "pyramid") return words.pyramid;
  if ((kind === "400" || kind.startsWith("interval-")) && fast[0]?.metres !== undefined) {
    return `${fast.length} × ${fast[0].metres} m`;
  }
  if ((kind === "threshold" || kind.startsWith("tempo-")) && paced.length > 0) {
    return words.threshold(paced.length, minutesOf(paced[0]));
  }
  if (kind.startsWith("race-")) return raceName(kind.slice("race-".length)) ?? session.name;
  return session.name;
}

/**
 * The values sessions were stored with before the code spoke English.
 *
 * Programmes, runs and transfer files written by an older version carry
 * efforts and library ids in French. The database is rewritten once, by a
 * migration; a transfer file from an old phone is converted as it is read.
 */
const LEGACY_EFFORTS: Record<string, Effort> = {
  "échauffement": "warmup",
  "rapide": "fast",
  "récupération": "recovery",
  "allure": "steady",
  "retour au calme": "cooldown",
};

const LEGACY_SESSION_IDS: Record<string, string> = {
  seuil: "threshold",
  pyramide: "pyramid",
  footing: "easy",
  longue: "long",
};

/** An effort as currently spelled, whichever version wrote it. */
export const currentEffort = (effort: string): Effort =>
  LEGACY_EFFORTS[effort] ?? (effort as Effort);

/** A session id as currently spelled, lightened variants included. */
export function currentSessionId(id: string): string {
  const eased = id.endsWith("-eased");
  const base = eased ? id.slice(0, -"-eased".length) : id;
  const renamed = LEGACY_SESSION_IDS[base] ?? base;
  return eased ? `${renamed}-eased` : renamed;
}

/** A stored session, brought up to the current spelling. */
export function currentSession(session: Session): Session {
  return {
    ...session,
    id: currentSessionId(session.id),
    steps: session.steps.map((step) => ({ ...step, effort: currentEffort(step.effort) })),
  };
}

export const sessionById = (id: string | null): Session | null =>
  SESSIONS.find((s) => s.id === id) ?? null;
