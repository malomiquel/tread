import {
  authorizationStatusFor,
  deleteObjects,
  getMostRecentQuantitySample,
  isHealthDataAvailable,
  requestAuthorization,
  saveWorkoutSample,
} from "@kingstinct/react-native-healthkit";
import {
  AuthorizationStatus,
  WorkoutActivityType,
  WorkoutRouteTypeIdentifier,
  WorkoutTypeIdentifier,
  type LocationForSaving,
  type QuantitySampleForSaving,
} from "@kingstinct/react-native-healthkit/types";
import { Platform } from "react-native";
import { readRun, setHealthUuid, type Run } from "./db";
import { estimateActiveEnergyKcal } from "./energy";
import { segments, totalDistanceM, type TrackPoint } from "./geo";

const DISTANCE = "HKQuantityTypeIdentifierDistanceWalkingRunning";
const ENERGY = "HKQuantityTypeIdentifierActiveEnergyBurned";
const BODY_MASS = "HKQuantityTypeIdentifierBodyMass";

/**
 * What the app asks Health for, and nothing beyond it. The workout and its
 * route are what a running app is there to write; distance and energy are the
 * samples that make a run count towards the day's totals and the move ring.
 * Body mass is the single thing read back, and only because active energy
 * cannot be worked out without a weight.
 */
const SHARE = [WorkoutTypeIdentifier, WorkoutRouteTypeIdentifier, DISTANCE, ENERGY] as const;
const READ = [BODY_MASS] as const;

/** HealthKit exists on iPhone and iPad, and nowhere else the app runs. */
export function healthAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    return isHealthDataAvailable();
  } catch {
    // No native module: a development client built before HealthKit was added.
    return false;
  }
}

/**
 * Ask for access. iOS shows its sheet once per type and silently remembers the
 * answer afterwards, so calling this again later is harmless and does nothing
 * visible.
 *
 * The returned boolean says the request went through, not that permission was
 * granted: for privacy, HealthKit refuses to tell an app whether it may *read*
 * something. Writing is different, and sharingRefused() below does report it.
 */
export async function requestHealthAccess(): Promise<boolean> {
  if (!healthAvailable()) return false;
  try {
    return await requestAuthorization({ toShare: [...SHARE], toRead: [...READ] });
  } catch {
    return false;
  }
}

/** True once the user has explicitly refused to let the app write workouts. */
export function sharingRefused(): boolean {
  if (!healthAvailable()) return false;
  try {
    return authorizationStatusFor(WorkoutTypeIdentifier) === AuthorizationStatus.sharingDenied;
  } catch {
    return false;
  }
}

/** The most recent weight recorded in Health, in kilograms, if any. */
async function bodyMassKg(): Promise<number | null> {
  try {
    const sample = await getMostRecentQuantitySample(BODY_MASS, "kg");
    return sample?.quantity ?? null;
  } catch {
    // Reads are never confirmed nor denied out loud; an empty answer is one of
    // the normal ones.
    return null;
  }
}

/**
 * One distance sample and one energy sample per active segment, rather than a
 * single sample spanning the whole run. A run paused for a coffee should leave
 * the day's distance graph flat for that quarter of an hour, not draw a block
 * across it.
 */
function quantitiesFor(points: TrackPoint[], weightKg: number | null): QuantitySampleForSaving[] {
  const samples: QuantitySampleForSaving[] = [];

  for (const segment of segments(points)) {
    const distance = totalDistanceM(segment);
    if (distance <= 0) continue;

    const startDate = new Date(segment[0].ts);
    const endDate = new Date(segment[segment.length - 1].ts);
    samples.push({ startDate, endDate, quantityType: DISTANCE, quantity: distance, unit: "m" });

    const energy = weightKg === null ? null : estimateActiveEnergyKcal(distance, weightKg);
    if (energy !== null) {
      samples.push({ startDate, endDate, quantityType: ENERGY, quantity: energy, unit: "kcal" });
    }
  }
  return samples;
}

/**
 * CoreLocation marks a missing measurement with a negative accuracy rather
 * than a missing field, and that is the convention Health reads back.
 */
function toLocations(points: TrackPoint[]): LocationForSaving[] {
  return points.map((point) => ({
    latitude: point.lat,
    longitude: point.lng,
    altitude: point.alt ?? 0,
    date: new Date(point.ts),
    horizontalAccuracy: point.accuracy ?? -1,
    verticalAccuracy: point.alt === null ? -1 : 10,
    speed: point.speed ?? -1,
    course: -1,
  }));
}

/**
 * Copy one finished run into Apple Health, and remember where it landed.
 *
 * Health is a mirror, never the record: the run already lives in this app's
 * own database, so a failure here loses nothing and is reported by returning
 * null rather than by throwing. A run that carries an identifier already was
 * copied before, and is left alone.
 */
export async function syncRunToHealth(runId: number): Promise<string | null> {
  if (!healthAvailable()) return null;

  const stored = await readRun(runId);
  if (!stored) return null;
  const { run, points } = stored;
  const endedAt = run.endedAt;
  if (endedAt === null) return null;
  if (run.healthUuid) return run.healthUuid;

  try {
    const weight = await bodyMassKg();
    const energy = estimateActiveEnergyKcal(run.distanceM, weight ?? Number.NaN);

    const workout = await saveWorkoutSample(
      WorkoutActivityType.running,
      quantitiesFor(points, weight),
      new Date(run.startedAt),
      new Date(endedAt),
      { distance: run.distanceM, ...(energy === null ? {} : { energyBurned: energy }) },
      { HKWorkoutBrandName: "Tread" },
    );

    // The route is a bonus, not the point: a workout that saved without its
    // trace is still a run in Health, so a refusal here is not a failure.
    if (points.length > 1) {
      try {
        await workout.saveWorkoutRoute(toLocations(points));
      } catch {
        /* the workout itself is already stored */
      }
    }

    await setHealthUuid(run.id, workout.uuid);
    return workout.uuid;
  } catch {
    return null;
  }
}

/**
 * Remove a run's copy from Health. Called when the run is deleted here, so
 * that throwing a run away does not leave a ghost of it behind. HealthKit only
 * ever lets an app delete what it wrote itself.
 */
export async function forgetRunInHealth(run: Run): Promise<void> {
  if (!run.healthUuid || !healthAvailable()) return;
  try {
    await deleteObjects(WorkoutTypeIdentifier, { uuid: run.healthUuid });
  } catch {
    /* nothing left to do: the run is already gone from this app */
  }
}
