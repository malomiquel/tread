import { formatElevation } from "./format.ts";
import { zoneName } from "./heart.ts";
import { decimal, defineStrings } from "./i18n.ts";
import { distanceUnit, elevationUnit, toDistanceUnits } from "./units.ts";

/** Structured sessions: what to run, and for how long, announced as you go. */

export type Effort = "warmup" | "fast" | "recovery" | "steady" | "cooldown" | "walk";

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
  /**
   * The ground the block is run on, for a trail session. Absent on the road,
   * where the ground is flat and says nothing.
   */
  terrain?: Terrain;
  /**
   * How hard the block should feel, on Borg's 0 to 10 scale (CR10), for a
   * session run by effort rather than by pace. Absent on a paced session.
   *
   * A trail session cannot be held to a pace: the same effort is 4'30" on
   * the flat and 15'00" up a 20 % slope, so a pace target would be wrong on
   * every metre of the run. Effort is what a trail coach prescribes, and
   * what a heart-rate zone measures for a runner with a watch.
   */
  rpe?: number;
}

/**
 * The ground under a trail block: climbing, descending, or rolling terrain
 * that does a bit of both, as a long run in the hills does.
 */
export type Terrain = "climb" | "descent" | "hills";

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
    walk: "marche",
  },
  en: {
    warmup: "warm-up",
    fast: "fast",
    recovery: "recovery",
    steady: "steady",
    cooldown: "cool-down",
    walk: "walk",
  },
});

export const effortName = (effort: Effort): string => effortNames()[effort];

const terrainNames = defineStrings<Record<Terrain, string>>({
  fr: { climb: "en montée", descent: "en descente", hills: "sur terrain vallonné" },
  en: { climb: "uphill", descent: "downhill", hills: "on hills" },
});

export function stepLabel(step: Step): string {
  const measure = step.metres !== undefined
    ? step.metres >= 1000
      ? `${decimal((step.metres / 1000).toString())} km`
      : `${step.metres} m`
    : secondsName(step.seconds ?? 0);
  const ground = step.terrain ? ` ${terrainNames()[step.terrain]}` : "";
  return `${measure} ${effortName(step.effort)}${ground}`;
}

const rpeWords = defineStrings({
  fr: {
    rpe: (rpe: number) => `effort ${rpe}/10`,
    zone: (zone: number, name: string) => `Z${zone + 1} ${name}`,
  },
  en: {
    rpe: (rpe: number) => `effort ${rpe}/10`,
    zone: (zone: number, name: string) => `Z${zone + 1} ${name}`,
  },
});

/** "effort 7/10" — displayed. */
export const rpeName = (rpe: number): string => rpeWords().rpe(rpe);

/**
 * The heart-rate zone an effort corresponds to, from 0 for the easiest.
 *
 * CHOSEN, after the usual reading of Borg's CR10 against a five-zone split:
 * up to 2 is recovery, 3 and 4 the endurance a long run is spent in, 5 and 6
 * tempo, 7 and 8 threshold, 9 and 10 the top. Approximate in both directions
 * — heart rate lags a short climb and drifts up through a long day — which
 * is why the effort is the target and the zone only a cross-check.
 */
export function rpeZone(rpe: number): number {
  if (rpe <= 2) return 0;
  if (rpe <= 4) return 1;
  if (rpe <= 6) return 2;
  if (rpe <= 8) return 3;
  return 4;
}

/** "effort 7/10 · Z4 Threshold" — displayed. */
export function rpeWithZone(rpe: number): string {
  const zone = rpeZone(rpe);
  return `${rpeName(rpe)} · ${rpeWords().zone(zone, zoneName(zone))}`;
}

/**
 * True for a session run by effort and time rather than by pace: a trail
 * session, or a trail race. No pace verdict is ever given on one.
 */
export function isEffortSession(session: Session | null): boolean {
  if (!session) return false;
  const id = session.id.replace(/-eased$/, "");
  return id.startsWith("trail-") || id.startsWith("race-trail");
}

/**
 * How hard a session's work should feel: the highest effort of the blocks
 * that are the point of it, warm-up, cool-down and recoveries aside. Null
 * for a session that carries no effort.
 */
export function sessionEffort(session: Session): number | null {
  let highest: number | null = null;
  for (const step of session.steps) {
    if (step.rpe === undefined) continue;
    if (step.effort === "warmup" || step.effort === "cooldown" || step.effort === "recovery") continue;
    highest = Math.max(highest ?? 0, step.rpe);
  }
  return highest;
}

/**
 * "3 min", "1 min 30" — displayed. The seconds are kept because a run-walk
 * session is built of ninety second blocks, and "2 min" for one of them
 * would be the app getting its own session wrong.
 */
export function secondsName(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (rest === 0) return `${minutes} min`;
  return minutes === 0 ? `${rest} s` : `${minutes} min ${String(rest).padStart(2, "0")}`;
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

/** Length of the VMA test's block: the half-Cooper's six minutes. */
const VMA_TEST_S = 360;

const repeat = (times: number, ...block: Step[]): Step[] =>
  Array.from({ length: times }, () => block).flat();

/**
 * Every session the app has ever offered, so that a run which followed one
 * is still named after it.
 *
 * The first five were the original catalogue. They are no longer offered —
 * a runner now writes their own — but runs recorded with them keep their
 * ids, and a past run should not lose its name because a list changed.
 */
export const KNOWN_SESSIONS: Session[] = [
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
  {
    // Billat's 30-30: thirty seconds at maximal aerobic speed, thirty
    // seconds jogged. Known by that name in every running club, and in the
    // same words in both languages.
    id: "thirty-thirty",
    name: "30/30",
    steps: [
      { effort: "warmup", seconds: 900 },
      ...repeat(10, { effort: "fast", seconds: 30 }, { effort: "recovery", seconds: 30 }),
      { effort: "cooldown", seconds: 600 },
    ],
  },
  {
    // The half-Cooper: six minutes as far as you can. Run evenly, the
    // distance in metres divided by a hundred is the maximal aerobic speed in
    // km/h — which is what every interval pace is set from.
    id: "vma-test",
    name: "Test VMA (demi-Cooper)",
    steps: [
      { effort: "warmup", seconds: 900 },
      { effort: "fast", seconds: VMA_TEST_S },
      { effort: "cooldown", seconds: 600 },
    ],
  },
  {
    id: "1000",
    name: "5 × 1000 m",
    steps: [
      { effort: "warmup", seconds: 900 },
      ...repeat(5, { effort: "fast", metres: 1000 }, { effort: "recovery", seconds: 120 }),
      { effort: "cooldown", seconds: 600 },
    ],
  },
];

/**
 * What the session picker offers beside the runner's own: the two sessions
 * every runner has heard of, one on time and one on distance. Anything else
 * is written in the editor, the way the runner wants it.
 */
export const SESSIONS: Session[] = KNOWN_SESSIONS.filter((session) =>
  session.id === "thirty-thirty" || session.id === "1000" || session.id === "vma-test");

/**
 * The maximal aerobic speed a VMA test measured, in metres per second, or
 * null when the test was not run through.
 *
 * The average speed over the six-minute block. Stopped well short of the six
 * minutes it says nothing: a VMA is the speed held for about that long, not
 * the speed of a sprint.
 */
export function vmaFromBlocks(sessionId: string | null, blocks: readonly RanBlock[]): number | null {
  if (sessionId !== "vma-test") return null;
  const test = blocks.find((block) => block.effort === "fast");
  if (!test || test.durationS < VMA_TEST_S * 0.9 || test.distanceM <= 0) return null;
  return test.distanceM / test.durationS;
}

/** Consecutive blocks that repeat, folded into one line. */
export interface StepGroup {
  times: number;
  steps: Step[];
}

const sameStep = (a: Step, b: Step): boolean =>
  a.effort === b.effort && a.metres === b.metres && a.seconds === b.seconds
  && a.terrain === b.terrain && a.rpe === b.rpe;

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
  // A test is a measurement: lightened, it measures something else.
  if (session.id === "vma-test") return session;
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
    runWalk: (times: number, run: string) => `Course-marche ${times} × ${run}`,
    pyramid: "Pyramide 1-2-3-2-1",
    vmaTest: "Test VMA (demi-Cooper)",
    trailEasy: (duration: string) => `Footing trail ${duration}`,
    trailLong: (duration: string) => `Sortie longue vallonnée ${duration}`,
    backToBack: (duration: string) => `Enchaînement ${duration}`,
    hills: (times: number, duration: string) => `${times} × ${duration} en côte`,
    climb: (blocks: number, minutes: number) => `${blocks} × ${minutes} min de montée`,
    hike: (blocks: number, minutes: number) => `${blocks} × ${minutes} min de marche en côte`,
    descent: (times: number, duration: string) => `${times} × ${duration} de descente`,
    trailRace: (distance: string, gain: string) => `Trail ${distance} · ${gain} D+`,
    races: { fiveK: "5 km", tenK: "10 km", half: "Semi-marathon", marathon: "Marathon", trail: "Trail" },
  },
  en: {
    easy: (duration: string) => `Easy run ${duration}`,
    long: (duration: string) => `Long run ${duration}`,
    threshold: (blocks: number, minutes: number) => `${blocks} × ${minutes} min at threshold`,
    runWalk: (times: number, run: string) => `Run-walk ${times} × ${run}`,
    pyramid: "Pyramid 1-2-3-2-1",
    vmaTest: "VMA test (half-Cooper)",
    trailEasy: (duration: string) => `Easy trail run ${duration}`,
    trailLong: (duration: string) => `Hilly long run ${duration}`,
    backToBack: (duration: string) => `Back-to-back ${duration}`,
    hills: (times: number, duration: string) => `${times} × ${duration} hill repeats`,
    climb: (blocks: number, minutes: number) => `${blocks} × ${minutes} min uphill tempo`,
    hike: (blocks: number, minutes: number) => `${blocks} × ${minutes} min power hiking`,
    descent: (times: number, duration: string) => `${times} × ${duration} downhill`,
    trailRace: (distance: string, gain: string) => `Trail ${distance} · ${gain} gain`,
    races: { fiveK: "5 km", tenK: "10 km", half: "Half marathon", marathon: "Marathon", trail: "Trail" },
  },
});

const adviceWords = defineStrings({
  fr: {
    climbGain: (gain: string) => `Cherche du relief : vise environ ${gain} de D+ sur la sortie.`,
    flatland: "Pas de relief près de chez toi ? Des escaliers, un parking à étages ou un tapis incliné font l'affaire.",
    longRun: "Cours à l'effort, pas à l'allure : marche dans les montées raides, mange et bois dès la première heure, comme le jour J.",
    backToBack: "Sur les jambes de la veille : c'est le but. Pars lentement, marche les montées et arrête-toi si une douleur s'installe.",
    hills: "Monte à fond mais en restant relâché, et redescends en trottinant : la descente est la récupération.",
    climb: "Un effort que tu pourrais tenir une heure : la respiration forte mais régulière, pas à bout de souffle.",
    hike: "Pas courts, buste penché, mains sur les cuisses ou bâtons si tu cours avec. Vite, sans courir : c'est ce que tu feras dans les montées raides.",
    descent: "Regard loin devant, pas courts et rapides, bras écartés pour l'équilibre. Lâche les freins progressivement, séance après séance.",
    race: "Pars plus lentement que tu ne le voudrais : sur un trail, les heures de la fin se gagnent dans la première.",
    vmaTest: [
      "Sur piste de préférence : le GPS y est plus juste, et les lignes permettent de vérifier la distance.",
      "Pars à une allure que tu penses tenir six minutes, et garde-la jusqu'au bout.",
      "Accélère seulement dans la dernière minute, s'il te reste de la marge.",
      "Frais et bien échauffé : pas au lendemain d'une séance dure.",
    ],
  },
  en: {
    climbGain: (gain: string) => `Look for hills: aim for about ${gain} of climbing on this run.`,
    flatland: "No hills nearby? Stairs, a multi-storey car park or an inclined treadmill will do.",
    longRun: "Run by effort, not by pace: walk the steep climbs, and eat and drink from the first hour, as on race day.",
    backToBack: "On yesterday's legs: that is the point. Start slowly, walk the climbs and stop if a pain sets in.",
    hills: "Climb hard but stay relaxed, and jog back down: the descent is the recovery.",
    climb: "An effort you could hold for an hour: breathing hard but steady, not gasping.",
    hike: "Short steps, chest forward, hands on your thighs or poles if you use them. Fast, without running: it is what you will do on the steep climbs.",
    descent: "Eyes well ahead, short quick steps, arms out for balance. Let go of the brakes gradually, session after session.",
    race: "Start slower than you want to: on a trail, the last hours are won in the first one.",
    vmaTest: [
      "On a track if you can: GPS is more accurate there, and the lines let you check the distance.",
      "Start at a pace you think you can hold for six minutes, and keep it to the end.",
      "Only speed up in the last minute, if you have something left.",
      "Fresh and well warmed up: not the day after a hard session.",
    ],
  },
});

/**
 * What to know before running a session, when there is anything.
 *
 * Only the test has any: a measurement is only as good as the way it is
 * taken, and six minutes started too fast measures the start.
 */
export function sessionAdvice(session: Session): readonly string[] {
  const words = adviceWords();
  if (session.id === "vma-test") return words.vmaTest;
  const kind = session.id.replace(/-eased$/, "");
  if (kind.startsWith("race-trail")) return [words.race];
  if (kind.startsWith("trail-long-")) {
    const gain = trailGainOf(kind);
    return gain > 0
      ? [words.climbGain(`${formatElevation(gain)} ${elevationUnit()}`), words.longRun, words.flatland]
      : [words.longRun];
  }
  if (kind.startsWith("trail-b2b-")) return [words.backToBack];
  if (kind.startsWith("trail-hills-")) return [words.hills, words.flatland];
  if (kind.startsWith("trail-climb-")) return [words.climb, words.flatland];
  if (kind.startsWith("trail-hike-")) return [words.hike, words.flatland];
  if (kind.startsWith("trail-descent-")) return [words.descent];
  return [];
}

/**
 * The climbing a trail session's id carries, in metres: the last number of
 * `trail-long-150-600` or `race-trail-2500`. Zero when it has none.
 */
export function trailGainOf(id: string): number {
  const match = /-(\d+)$/.exec(id.replace(/-eased$/, ""));
  return match ? Number(match[1]) : 0;
}

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
  if (kind.startsWith("runwalk-") && paced.length > 0) {
    return words.runWalk(paced.length, secondsName(paced[0].seconds ?? 0));
  }
  if (kind === "pyramid") return words.pyramid;
  if (kind === "vma-test") return words.vmaTest;
  if ((kind === "400" || kind.startsWith("interval-")) && fast[0]?.metres !== undefined) {
    return `${fast.length} × ${fast[0].metres} m`;
  }
  if ((kind === "threshold" || kind.startsWith("tempo-")) && paced.length > 0) {
    return words.threshold(paced.length, minutesOf(paced[0]));
  }
  if (kind.startsWith("trail-")) {
    const climbs = session.steps.filter((step) => step.terrain === "climb" && step.effort !== "walk");
    const walks = session.steps.filter((step) => step.terrain === "climb" && step.effort === "walk");
    const descents = session.steps.filter((step) => step.terrain === "descent" && step.effort === "steady");
    if (kind.startsWith("trail-easy-") && paced.length > 0) return words.trailEasy(durationName(minutesOf(paced[0])));
    if (kind.startsWith("trail-long-") && paced.length > 0) return words.trailLong(durationName(minutesOf(paced[0])));
    if (kind.startsWith("trail-b2b-") && paced.length > 0) return words.backToBack(durationName(minutesOf(paced[0])));
    if (kind.startsWith("trail-hills-") && climbs.length > 0) {
      return words.hills(climbs.length, secondsName(climbs[0].seconds ?? 0));
    }
    if (kind.startsWith("trail-climb-") && climbs.length > 0) return words.climb(climbs.length, minutesOf(climbs[0]));
    if (kind.startsWith("trail-hike-") && walks.length > 0) return words.hike(walks.length, minutesOf(walks[0]));
    if (kind.startsWith("trail-descent-") && descents.length > 0) {
      return words.descent(descents.length, secondsName(descents[0].seconds ?? 0));
    }
  }
  if (kind.startsWith("race-trail") && session.steps[0]?.metres !== undefined) {
    return words.trailRace(
      // Whole units: a race is called "42 km", not "42,0 km".
      `${Math.round(toDistanceUnits(session.steps[0].metres))} ${distanceUnit()}`,
      `${formatElevation(trailGainOf(kind))} ${elevationUnit()}`,
    );
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
  KNOWN_SESSIONS.find((s) => s.id === id) ?? null;
