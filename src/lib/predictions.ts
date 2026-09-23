import { EFFORT_DISTANCES, effortKey, type BestEfforts } from "./efforts.ts";
import { equivalentTimeS, GOALS, type Goal } from "./plan.ts";

/**
 * Race times this runner could expect today, from what they have run lately.
 *
 * Projected with the same endurance curve the plans use to set their paces
 * (see `equivalentTimeS`), so the profile and a programme never disagree
 * about what a runner is worth over a distance.
 */

/** One best effort, from one run. */
export interface EffortSample {
  /** Effort key, as stored on the run: "5000", "10000"… */
  key: string;
  seconds: number;
  /** When the run it came from started. */
  at: number;
}

export interface Prediction {
  goal: Goal;
  distanceM: number;
  timeS: number;
  paceSKm: number;
  /** The effort it was projected from. */
  from: EffortSample;
}

/**
 * How far back an effort still says something about today.
 *
 * CHOSEN. Twelve weeks is about the length of a training block: fitness from
 * before it has been gained or lost since, and a record from last spring
 * would flatter a runner who stopped in the summer.
 */
export const PREDICTION_WINDOW_MS = 84 * 86_400_000;

/**
 * The shortest effort worth projecting from, and how far it may be stretched.
 *
 * CHOSEN. A mile says little about a marathon: the further a projection
 * reaches, the more it measures the curve rather than the runner. So an
 * effort only predicts races up to ten times its length, and nothing under a
 * mile predicts at all.
 */
const SHORTEST_BASE_M = 1609;
const LONGEST_REACH = 10;

/** Every effort of every run, ready to predict from. */
export function effortSamples(runs: readonly { startedAt: number; bestEfforts: BestEfforts | null }[]): EffortSample[] {
  return runs.flatMap((run) => Object.entries(run.bestEfforts ?? {})
    .map(([key, seconds]) => ({ key, seconds, at: run.startedAt })));
}

const distanceOf = (key: string): number | null =>
  EFFORT_DISTANCES.find((metres) => effortKey(metres) === key) ?? null;

/**
 * A predicted time for each race, from the recent effort that projects
 * fastest.
 *
 * The fastest rather than the latest or the average: most efforts are found
 * inside training runs nobody raced, and those can only understate a runner.
 * The quickest of them is the nearest thing to what they would do with a
 * number pinned on. A race with no effort in reach is left out, not guessed.
 */
export function predictRaces(
  samples: readonly EffortSample[],
  now: number,
  weeklyKm: number | null = null,
): Prediction[] {
  const recent = samples.filter((sample) => sample.at >= now - PREDICTION_WINDOW_MS && sample.at <= now);
  const predictions: Prediction[] = [];
  for (const goal of GOALS) {
    let best: Prediction | null = null;
    for (const sample of recent) {
      const base = distanceOf(sample.key);
      if (base === null || base < SHORTEST_BASE_M || goal.distanceM > base * LONGEST_REACH) continue;
      const timeS = equivalentTimeS(base, sample.seconds, goal.distanceM, weeklyKm ?? undefined);
      if (timeS === null || (best && best.timeS <= timeS)) continue;
      best = { goal: goal.id, distanceM: goal.distanceM, timeS, paceSKm: timeS / (goal.distanceM / 1000), from: sample };
    }
    if (best) predictions.push(best);
  }
  return predictions;
}
