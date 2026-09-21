/** Structured sessions: what to run, and for how long, announced as you go. */

export type Effort = "échauffement" | "rapide" | "récupération" | "allure" | "retour au calme";

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
export function stepLabel(step: Step): string {
  const measure = step.metres !== undefined
    ? step.metres >= 1000
      ? `${(step.metres / 1000).toString().replace(".", ",")} km`
      : `${step.metres} m`
    : `${Math.round((step.seconds ?? 0) / 60)} min`;
  return `${measure} ${step.effort}`;
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

const repeat = (fois: number, ...bloc: Step[]): Step[] =>
  Array.from({ length: fois }, () => bloc).flat();

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
      { effort: "échauffement", seconds: 600 },
      ...repeat(5, { effort: "rapide", metres: 400 }, { effort: "récupération", metres: 200 }),
      { effort: "retour au calme", seconds: 300 },
    ],
  },
  {
    id: "seuil",
    name: "3 × 8 min au seuil",
    steps: [
      { effort: "échauffement", seconds: 900 },
      ...repeat(3, { effort: "allure", seconds: 480 }, { effort: "récupération", seconds: 180 }),
      { effort: "retour au calme", seconds: 600 },
    ],
  },
  {
    id: "pyramide",
    name: "Pyramide 1-2-3-2-1",
    steps: [
      { effort: "échauffement", seconds: 600 },
      { effort: "rapide", seconds: 60 }, { effort: "récupération", seconds: 60 },
      { effort: "rapide", seconds: 120 }, { effort: "récupération", seconds: 120 },
      { effort: "rapide", seconds: 180 }, { effort: "récupération", seconds: 180 },
      { effort: "rapide", seconds: 120 }, { effort: "récupération", seconds: 120 },
      { effort: "rapide", seconds: 60 },
      { effort: "retour au calme", seconds: 600 },
    ],
  },
  {
    id: "footing",
    name: "Footing 30 min",
    steps: [{ effort: "allure", seconds: 1800 }],
  },
  {
    id: "longue",
    name: "Sortie longue 1 h",
    // One block, like the easy run. Cutting a long run into a warm-up and a
    // cool-down announces three things where there is only one to do: go out
    // and run for an hour.
    steps: [{ effort: "allure", seconds: 3600 }],
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
  return step.effort === "rapide" || step.effort === "allure";
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

export const sessionById = (id: string | null): Session | null =>
  SESSIONS.find((s) => s.id === id) ?? null;
