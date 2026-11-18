import { distanceM, segments, type TrackPoint } from "./geo.ts";

/**
 * The ghost: your best run on a route, run again beside you.
 *
 * Replayed by active time rather than by the clock, so a pause at a light in
 * the record does not freeze the ghost for the length of that light today —
 * both of you are measured on time spent running.
 */
export interface Ghost {
  /** Active seconds at each fix. */
  seconds: number[];
  /** Distance covered at each fix, in metres. */
  metres: number[];
  lat: number[];
  lng: number[];
}

/** A ghost from a finished run's points, or null for one too short to follow. */
export function ghostOf(points: readonly TrackPoint[]): Ghost | null {
  const ghost: Ghost = { seconds: [], metres: [], lat: [], lng: [] };
  let seconds = 0;
  let metres = 0;
  for (const segment of segments([...points])) {
    segment.forEach((point, i) => {
      // Crossing into a new segment adds nothing: a pause is neither run nor
      // timed.
      if (i > 0) {
        seconds += (point.ts - segment[i - 1].ts) / 1000;
        metres += distanceM(segment[i - 1], point);
      }
      ghost.seconds.push(seconds);
      ghost.metres.push(metres);
      ghost.lat.push(point.lat);
      ghost.lng.push(point.lng);
    });
  }
  return ghost.seconds.length > 1 && seconds > 0 && metres > 0 ? ghost : null;
}

/** First index whose value is at least `target`, in an ascending array. */
function reaching(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Where the ghost is after `activeS` seconds of running: interpolated between
 * two fixes, and waiting at the finish once its run is over.
 */
export function ghostAt(ghost: Ghost, activeS: number): { lat: number; lng: number; distanceM: number } {
  const last = ghost.seconds.length - 1;
  if (activeS >= ghost.seconds[last]) {
    return { lat: ghost.lat[last], lng: ghost.lng[last], distanceM: ghost.metres[last] };
  }
  if (activeS <= 0) return { lat: ghost.lat[0], lng: ghost.lng[0], distanceM: 0 };
  const i = reaching(ghost.seconds, activeS);
  const span = ghost.seconds[i] - ghost.seconds[i - 1];
  const share = span > 0 ? (activeS - ghost.seconds[i - 1]) / span : 1;
  const along = (from: number[]) => from[i - 1] + (from[i] - from[i - 1]) * share;
  return { lat: along(ghost.lat), lng: along(ghost.lng), distanceM: along(ghost.metres) };
}

/**
 * How far ahead of the ghost the runner is, in seconds: positive ahead,
 * negative behind.
 *
 * Measured at the runner's distance — when did the ghost get here, against
 * when did I — because seconds are what a record is kept in, and a gap in
 * metres means nothing without a pace to divide it by. Null past the end of
 * the ghost's run, where there is nothing left to compare.
 */
export function ghostGapS(ghost: Ghost, distanceM: number, activeS: number): number | null {
  const last = ghost.metres.length - 1;
  if (distanceM <= 0 || distanceM > ghost.metres[last]) return null;
  const i = Math.max(1, reaching(ghost.metres, distanceM));
  const span = ghost.metres[i] - ghost.metres[i - 1];
  const share = span > 0 ? (distanceM - ghost.metres[i - 1]) / span : 1;
  const ghostS = ghost.seconds[i - 1] + (ghost.seconds[i] - ghost.seconds[i - 1]) * share;
  return ghostS - activeS;
}
