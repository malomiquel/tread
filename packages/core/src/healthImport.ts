import type { ActivityType } from "./activity.ts";
import { bestEfforts, type BestEfforts } from "./efforts.ts";
import {
  elevationGainM, fastestKmS, paceSecPerKm, totalDistanceM, type TrackPoint,
} from "./geo.ts";

/**
 * Runs a watch wrote to Apple Health, turned into Tread's own.
 *
 * A runner with a watch runs with the watch, and the phone stays at home.
 * Without this, Tread would only ever see the runs it recorded itself — and
 * lose that runner, with or without a watch app of its own. Nothing is sent
 * anywhere: Health is on the same phone.
 */

/** A workout as read from Health, reduced to what a run needs. */
export interface HealthWorkout {
  uuid: string;
  startedAt: number;
  endedAt: number;
  durationS: number;
  /** As Health totals it, or null when the workout has none. */
  distanceM: number | null;
  /** On a treadmill or indoors. */
  indoor: boolean;
  /** A ride rather than a run. */
  ride: boolean;
  /** The app or device that wrote it: "Apple Watch", "Garmin Connect". */
  sourceName: string;
  locations: { ts: number; lat: number; lng: number; alt: number | null; accuracy: number | null; speed: number | null }[];
}

export interface ImportedRun {
  startedAt: number;
  endedAt: number;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  elevationGainM: number;
  fastestKmS: number | null;
  bestEfforts: BestEfforts;
  activity: ActivityType;
  points: TrackPoint[];
}

/** Two starts closer than this, with similar distances, are the same run. */
const SAME_RUN_WITHIN_MS = 5 * 60_000;

export function toImportedRun(workout: HealthWorkout): ImportedRun {
  const points: TrackPoint[] = workout.locations
    .filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng))
    .map((location) => ({ ...location, segment: 0 }));
  // Health's own total first: a watch measures distance on the wrist as well
  // as by GPS, and indoors it has no track at all.
  const distanceM = workout.distanceM ?? totalDistanceM(points);
  // A ride keeps none of a runner's measures, as one recorded here does not.
  const ride = workout.ride;
  return {
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    distanceM,
    durationS: Math.round(workout.durationS),
    avgPaceSKm: paceSecPerKm(distanceM, workout.durationS),
    elevationGainM: elevationGainM(points),
    fastestKmS: ride ? null : fastestKmS(points),
    bestEfforts: ride ? {} : bestEfforts(points),
    activity: ride ? "ride" : workout.indoor ? "treadmill" : "run",
    points,
  };
}

/**
 * Whether a run already here is this workout: the phone and a watch
 * recording the same outing side by side. Kept once, the phone's copy, which
 * already has everything.
 */
export function alreadyHere(
  runs: readonly { startedAt: number; distanceM: number }[],
  workout: { startedAt: number; distanceM: number | null },
): boolean {
  return runs.some((run) => {
    if (Math.abs(run.startedAt - workout.startedAt) > SAME_RUN_WITHIN_MS) return false;
    if (workout.distanceM === null || run.distanceM <= 0) return true;
    return Math.abs(run.distanceM - workout.distanceM) / Math.max(run.distanceM, workout.distanceM) < 0.25;
  });
}
