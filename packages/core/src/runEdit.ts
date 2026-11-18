import { bestEfforts, type BestEfforts } from "./efforts.ts";
import {
  elevationGainM, fastestKmS, paceSecPerKm, segments, totalDistanceM, type TrackPoint,
} from "./geo.ts";
import type { LapMark } from "./laps.ts";

/**
 * Putting right a run that was started too early or stopped too late, or
 * whose distance the GPS got wrong.
 *
 * A forgotten stop is the commonest mistake there is — the watch runs on
 * through the walk home, the drive, the shower — and it ruins the one run's
 * pace and every record it touches. Cutting is by time from either end,
 * because that is how the mistake is remembered: "I stopped about ten minutes
 * after I got back".
 */

/** The shortest a run may be cut down to, so an edit cannot erase it. */
export const MIN_KEPT_S = 60;

/** Seconds between the first fix and the last, pauses included. */
export function spanS(points: readonly TrackPoint[]): number {
  return points.length > 1 ? (points[points.length - 1].ts - points[0].ts) / 1000 : 0;
}

/** Seconds spent running: fix to fix inside each segment, pauses left out. */
export function activeS(points: readonly TrackPoint[]): number {
  return segments([...points]).reduce(
    (total, segment) => total + (segment.length > 1 ? (segment[segment.length - 1].ts - segment[0].ts) / 1000 : 0),
    0,
  );
}

/** The largest cut from one end that leaves the other end's cut and a minute. */
export function maxCutS(points: readonly TrackPoint[], otherCutS: number): number {
  return Math.max(0, Math.floor(spanS(points) - otherCutS - MIN_KEPT_S));
}

/** The fixes left once `cutStartS` is taken off the start and `cutEndS` off the end. */
export function trimmed(points: readonly TrackPoint[], cutStartS: number, cutEndS: number): TrackPoint[] {
  if (points.length < 2) return [...points];
  const from = points[0].ts + cutStartS * 1000;
  const to = points[points.length - 1].ts - cutEndS * 1000;
  return points.filter((point) => point.ts >= from && point.ts <= to);
}

export interface EditedRun {
  startedAt: number;
  endedAt: number;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  elevationGainM: number;
  fastestKmS: number | null;
  bestEfforts: BestEfforts;
  laps: LapMark[];
  points: TrackPoint[];
}

/**
 * A run's figures once cut and corrected.
 *
 * The time taken off is the running time the cut removed, so a run whose
 * clock started before the first fix keeps that difference. A corrected
 * distance replaces the measured one for the total and the pace; splits and
 * records still come from the track, which is the only place they can.
 */
export function editRun(
  run: { startedAt: number; endedAt: number; durationS: number; laps: readonly LapMark[] },
  points: readonly TrackPoint[],
  cutStartS: number,
  cutEndS: number,
  distanceOverrideM: number | null,
): EditedRun {
  const kept = trimmed(points, cutStartS, cutEndS);
  const cut = cutStartS > 0 || cutEndS > 0;
  const durationS = cut
    ? Math.max(0, Math.round(run.durationS - (activeS(points) - activeS(kept))))
    : run.durationS;
  const measuredM = totalDistanceM(kept);
  const distanceM = distanceOverrideM ?? measuredM;
  return {
    startedAt: cutStartS > 0 && kept.length ? kept[0].ts : run.startedAt,
    endedAt: cutEndS > 0 && kept.length ? kept[kept.length - 1].ts : run.endedAt,
    distanceM,
    durationS,
    avgPaceSKm: paceSecPerKm(distanceM, durationS),
    elevationGainM: elevationGainM(kept),
    fastestKmS: fastestKmS(kept),
    bestEfforts: bestEfforts(kept),
    // Laps are counted from the start: cutting the start moves every one of
    // them, so they go. Cutting the end only loses those past the new finish.
    laps: cutStartS > 0
      ? []
      : run.laps.filter((mark) => mark.distanceM < measuredM && mark.durationS < durationS),
    points: kept,
  };
}
