import { distanceM, MAX_ACCURACY_M, type TrackPoint } from "./geo.ts";

/**
 * Stopping at a light, and setting off again, without touching the phone.
 *
 * Off unless asked for. A guess that the runner has stopped is sometimes
 * wrong — a tunnel, a lost signal — and a wrong guess shortens the recorded
 * time of a run that was still going. Those who turn it on have decided that
 * a watch that keeps counting at every crossing is the worse of the two.
 *
 * Stillness cannot be read from fixes alone: the GPS only reports a new
 * position every few metres, so a runner standing still produces no fixes at
 * all. It is read against the clock instead — nothing further than a few
 * metres from the last position for ten seconds — and asked every second by
 * the run's own ticker.
 */

/** How long nothing has to move before the run pauses itself. */
export const STILL_AFTER_S = 10;

/** How far GPS drift can wander while standing still. */
export const STILL_RADIUS_M = 8;

/** How far from where it stopped the runner has to be to count as off again. */
export const MOVE_AWAY_M = 12;

/** A speed that is running, not drifting: about 5.4 km/h. */
export const MOVING_SPEED_MS = 1.5;

/**
 * Whether the runner has been standing still for long enough.
 *
 * `segmentStartedAt` gives a grace period after a start or a resume: the
 * first seconds of a run, spent waiting for a lock or tying a shoe, are not a
 * stop.
 */
export function hasStopped(
  points: readonly TrackPoint[],
  segment: number,
  segmentStartedAt: number,
  now: number,
): boolean {
  if (now - segmentStartedAt < STILL_AFTER_S * 1000) return false;
  const current = points.filter((point) => point.segment === segment);
  const last = current[current.length - 1];
  // No position at all yet is a GPS still searching, not a runner standing.
  if (!last) return false;
  const since = now - STILL_AFTER_S * 1000;
  return current
    .filter((point) => point.ts >= since)
    .every((point) => distanceM(point, last) <= STILL_RADIUS_M);
}

/** Whether a fresh fix shows the runner has set off again from where they stopped. */
export function hasMovedOn(stoppedAt: TrackPoint, fix: TrackPoint): boolean {
  if (fix.accuracy !== null && fix.accuracy > MAX_ACCURACY_M) return false;
  if (fix.speed !== null && fix.speed >= MOVING_SPEED_MS) return true;
  return distanceM(stoppedAt, fix) > MOVE_AWAY_M;
}
