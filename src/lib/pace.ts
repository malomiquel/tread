/** Holding a target pace: how far off it you are, and whether to say so. */

/**
 * How far the current pace sits from the target, in seconds per kilometre.
 *
 * Positive means slower than asked, negative faster. Null when there is no
 * target, no reading yet, or the drift is inside the tolerance — a runner
 * cannot hold a pace to the second, and a voice that says so every few
 * strides is a voice that gets switched off.
 */
export function paceDrift(
  currentSKm: number | null,
  targetSKm: number | null,
  toleranceS = 8,
): number | null {
  if (targetSKm === null || currentSKm === null) return null;
  if (!Number.isFinite(currentSKm) || !Number.isFinite(targetSKm)) return null;
  // A pace beyond half an hour a kilometre is someone standing still, not
  // someone running slowly.
  if (currentSKm > 30 * 60) return null;

  const drift = Math.round(currentSKm - targetSKm);
  return Math.abs(drift) < toleranceS ? null : drift;
}

/** The bounds a target pace is picked between, and the step it moves by. */
export const TARGET_MIN_S = 3 * 60;
export const TARGET_MAX_S = 9 * 60;
export const TARGET_STEP_S = 5;

/** Keeps a chosen target inside those bounds, on the step. */
export function clampTarget(seconds: number): number {
  const stepped = Math.round(seconds / TARGET_STEP_S) * TARGET_STEP_S;
  return Math.min(TARGET_MAX_S, Math.max(TARGET_MIN_S, stepped));
}

export type PaceState = "onPace" | "slow" | "fast" | "free";

/**
 * Where the runner stands against their target, for the run screen's gauge:
 * inside the tolerance, too slow or too fast, or running free. `offset` places
 * the marker on the gauge, from −1 (far too fast) to 1 (far too slow), with
 * the tolerance band in the middle third.
 */
export function paceStatus(
  currentSKm: number | null,
  targetSKm: number | null,
  toleranceS = 8,
): { state: PaceState; driftS: number; offset: number } {
  if (targetSKm === null) return { state: "free", driftS: 0, offset: 0 };
  if (currentSKm === null || !Number.isFinite(currentSKm) || currentSKm > 30 * 60) {
    return { state: "onPace", driftS: 0, offset: 0 };
  }
  const driftS = Math.round(currentSKm - targetSKm);
  // The band spans a third of the gauge; three tolerances either side fill it.
  const offset = Math.max(-1, Math.min(1, driftS / (toleranceS * 3)));
  const state = Math.abs(driftS) < toleranceS ? "onPace" : driftS > 0 ? "slow" : "fast";
  return { state, driftS, offset };
}
