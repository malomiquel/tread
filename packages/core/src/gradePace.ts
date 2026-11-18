import { distanceM, segments, type TrackPoint } from "./geo.ts";

/**
 * Grade-adjusted pace: the pace a run would have been on the flat, for the
 * same effort.
 *
 * PUBLISHED. The cost of running on a slope is Minetti's (Journal of Applied
 * Physiology, 2002), measured on a treadmill from −45 % to +45 %:
 *
 *   C(i) = 155.4 i⁵ − 30.4 i⁴ − 43.3 i³ + 46.3 i² + 19.5 i + 3.6  (J/kg/m)
 *
 * so every metre climbed at grade i counts as C(i) / C(0) flat metres.
 *
 * CHOSEN. Downhill is where the model is known to flatter: its cost bottoms
 * out near −20 %, a slope few people run as fast as the curve allows. So a
 * descent never counts for less than 80 % of its length, which keeps a long
 * downhill from turning an easy run into a fast one on paper.
 */

const cost = (i: number): number =>
  155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;

const FLAT_COST = cost(0);
const STEEPEST = 0.45;
const DOWNHILL_FLOOR = 0.8;

/** How many flat metres one metre at this grade is worth. */
export function gradeFactor(grade: number): number {
  const i = Math.max(-STEEPEST, Math.min(STEEPEST, grade));
  return Math.max(DOWNHILL_FLOOR, cost(i) / FLAT_COST);
}

/**
 * The shortest stretch a grade is measured over. GPS altitude wanders by a
 * few metres from fix to fix, which over ten metres reads as a wall.
 */
const GRADE_OVER_M = 50;

/**
 * The run's distance as if it had all been flat, in metres, or null when the
 * track carries no altitude to judge slopes by.
 */
export function flatEquivalentM(points: readonly TrackPoint[]): number | null {
  let flat = 0;
  let measured = false;
  for (const segment of segments([...points])) {
    let from = 0;
    let covered = 0;
    for (let i = 1; i < segment.length; i += 1) {
      covered += distanceM(segment[i - 1], segment[i]);
      if (covered < GRADE_OVER_M && i < segment.length - 1) continue;
      const startAlt = segment[from].alt;
      const endAlt = segment[i].alt;
      const factor = startAlt != null && endAlt != null && covered > 0
        ? gradeFactor((endAlt - startAlt) / covered)
        : 1;
      if (startAlt != null && endAlt != null) measured = true;
      flat += covered * factor;
      from = i;
      covered = 0;
    }
  }
  return measured ? flat : null;
}

/** Seconds per kilometre on the flat for the same effort, or null without altitude. */
export function gradeAdjustedPace(points: readonly TrackPoint[], durationS: number): number | null {
  const flat = flatEquivalentM(points);
  return flat !== null && flat > 0 && durationS > 0 ? durationS / (flat / 1000) : null;
}
