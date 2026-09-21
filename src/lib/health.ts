import { Platform, TurboModuleRegistry } from "react-native";
import { readRun, setHealthUuid, type Run } from "./db";
import { estimateActiveEnergyKcal } from "./energy";
import { segments, totalDistanceM, type TrackPoint } from "./geo";

type Api = typeof import("@kingstinct/react-native-healthkit");
type Types = typeof import("@kingstinct/react-native-healthkit/types");

const DISTANCE = "HKQuantityTypeIdentifierDistanceWalkingRunning";
const ENERGY = "HKQuantityTypeIdentifierActiveEnergyBurned";
const BODY_MASS = "HKQuantityTypeIdentifierBodyMass";

/**
 * HealthKit sits behind a lazy require, and behind a check that the native
 * side is there at all.
 *
 * The library binds to its native counterpart the moment it is loaded, so a
 * plain import would throw at startup wherever that counterpart is missing —
 * in Expo Go, or in a development build made before HealthKit was added.
 * Deferring the require is not enough on its own either: a module that throws
 * while loading is reported by the bundler whether or not the caller catches
 * it, which fills the console with a failure the app has already handled.
 *
 * So the question asked first is the honest one — is the native module
 * registered? — rather than a guess about which app is running the bundle.
 * It is the same lookup the library performs internally, and it answers with
 * null instead of an exception.
 *
 * The answer is cached either way: a device without HealthKit will not grow
 * one between two calls.
 */
let loaded: { api: Api; types: Types } | null | undefined;

function healthKit(): { api: Api; types: Types } | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS !== "ios") return (loaded = null);
  try {
    // The library is built on Nitro modules; without that host there is
    // nothing for it to bind to, and loading it would only raise.
    if (!TurboModuleRegistry.get("NitroModules")) return (loaded = null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@kingstinct/react-native-healthkit") as Api;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const types = require("@kingstinct/react-native-healthkit/types") as Types;
    loaded = api.isHealthDataAvailable() ? { api, types } : null;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** HealthKit exists on iPhone and iPad, and nowhere else this app runs. */
export function healthAvailable(): boolean {
  return healthKit() !== null;
}

/**
 * What the app asks Health for, and nothing beyond it. The workout and its
 * route are what a running app is there to write; distance and energy are the
 * samples that make a run count towards the day's totals and the move ring.
 * Body mass is the single thing read back, and only because active energy
 * cannot be worked out without a weight.
 */
function permissions(types: Types) {
  return {
    toShare: [types.WorkoutTypeIdentifier, types.WorkoutRouteTypeIdentifier, DISTANCE, ENERGY],
    toRead: [BODY_MASS],
  } as const;
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
  const health = healthKit();
  if (!health) return false;
  try {
    return await health.api.requestAuthorization(permissions(health.types));
  } catch {
    return false;
  }
}

/** True once the user has explicitly refused to let the app write workouts. */
export function sharingRefused(): boolean {
  const health = healthKit();
  if (!health) return false;
  try {
    return (
      health.api.authorizationStatusFor(health.types.WorkoutTypeIdentifier) ===
      health.types.AuthorizationStatus.sharingDenied
    );
  } catch {
    return false;
  }
}

/** The most recent weight recorded in Health, in kilograms, if any. */
async function bodyMassKg(api: Api): Promise<number | null> {
  try {
    const sample = await api.getMostRecentQuantitySample(BODY_MASS, "kg");
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
function quantitiesFor(points: TrackPoint[], weightKg: number | null) {
  const samples = [];

  for (const segment of segments(points)) {
    const distance = totalDistanceM(segment);
    if (distance <= 0) continue;

    const startDate = new Date(segment[0].ts);
    const endDate = new Date(segment[segment.length - 1].ts);
    samples.push({ startDate, endDate, quantityType: DISTANCE, quantity: distance, unit: "m" } as const);

    const energy = weightKg === null ? null : estimateActiveEnergyKcal(distance, weightKg);
    if (energy !== null) {
      samples.push({ startDate, endDate, quantityType: ENERGY, quantity: energy, unit: "kcal" } as const);
    }
  }
  return samples;
}

/**
 * CoreLocation marks a missing measurement with a negative accuracy rather
 * than a missing field, and that is the convention Health reads back.
 */
function toLocations(points: TrackPoint[]) {
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
  const health = healthKit();
  if (!health) return null;

  const stored = await readRun(runId);
  if (!stored) return null;
  const { run, points } = stored;
  const endedAt = run.endedAt;
  if (endedAt === null) return null;
  if (run.healthUuid) return run.healthUuid;

  try {
    const weight = await bodyMassKg(health.api);
    const energy = estimateActiveEnergyKcal(run.distanceM, weight ?? Number.NaN);

    const workout = await health.api.saveWorkoutSample(
      health.types.WorkoutActivityType.running,
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
  const health = healthKit();
  if (!run.healthUuid || !health) return;
  try {
    await health.api.deleteObjects(health.types.WorkoutTypeIdentifier, { uuid: run.healthUuid });
  } catch {
    /* nothing left to do: the run is already gone from this app */
  }
}
