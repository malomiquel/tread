import { Platform, TurboModuleRegistry } from "react-native";
import type { Beat } from "./heart";
import type { HealthWorkout } from "./healthImport";
import { segments, totalDistanceM, type TrackPoint } from "./geo";

/**
 * Health Connect: Android's counterpart to Apple Health, the shared store a
 * watch's app writes runs and heart rate to, and that this app writes its own
 * runs to in turn. Everything here stays on the phone, as it does on iOS.
 *
 * The same few jobs as src/lib/health.ts, in Health Connect's terms; that
 * module hands them over here on Android.
 */

type Api = typeof import("react-native-health-connect");

let loaded: Api | null | undefined;

/**
 * The library, or null where its native half is missing — Expo Go, iOS, or
 * a build made before it was added. Asked of the registry first, since the
 * library binds with `getEnforcing` and would throw while loading.
 */
function healthConnect(): Api | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS !== "android") return (loaded = null);
  try {
    if (!TurboModuleRegistry.get("HealthConnect")) return (loaded = null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("react-native-health-connect") as Api;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Tread's own package: runs it wrote itself are not brought back in. */
const OWN_PACKAGE = "com.malomiquel.tread";

/** Health Connect's number for a run, and for one on a treadmill. */
const RUNNING = 56;
const RUNNING_TREADMILL = 57;

/** Ready once the library is there and Health Connect answers on this phone. */
async function ready(): Promise<Api | null> {
  const api = healthConnect();
  if (!api) return null;
  try {
    if ((await api.getSdkStatus()) !== api.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    return (await api.initialize()) ? api : null;
  } catch {
    return null;
  }
}

/** Whether this build can talk to Health Connect at all. */
export const healthConnectPresent = (): boolean => healthConnect() !== null;

/** Ask for what the app writes and reads, as on iOS. */
export async function requestHealthConnectAccess(): Promise<boolean> {
  const api = await ready();
  if (!api) return false;
  try {
    await api.requestPermission([
      { accessType: "write", recordType: "ExerciseSession" },
      { accessType: "write", recordType: "ExerciseRoute" },
      { accessType: "write", recordType: "Distance" },
      { accessType: "write", recordType: "ActiveCaloriesBurned" },
      { accessType: "read", recordType: "ExerciseSession" },
      { accessType: "read", recordType: "Distance" },
      { accessType: "read", recordType: "HeartRate" },
      { accessType: "read", recordType: "Weight" },
    ]);
    return true;
  } catch {
    return false;
  }
}

const between = (from: number, to: number) => ({
  operator: "between" as const,
  startTime: new Date(from).toISOString(),
  endTime: new Date(to).toISOString(),
});

/** The latest weight Health Connect holds, in kilograms. */
export async function readWeightKg(): Promise<number | null> {
  const api = await ready();
  if (!api) return null;
  try {
    const { records } = await api.readRecords("Weight", {
      timeRangeFilter: { operator: "before", endTime: new Date().toISOString() },
      ascendingOrder: false,
      pageSize: 1,
    });
    return records[0]?.weight.inKilograms ?? null;
  } catch {
    return null;
  }
}

/** Every heart rate sample in a run's window, oldest first. */
export async function readHeartBeats(startedAt: number, endedAt: number): Promise<Beat[]> {
  const api = await ready();
  if (!api) return [];
  try {
    const { records } = await api.readRecords("HeartRate", { timeRangeFilter: between(startedAt, endedAt) });
    return records
      .flatMap((record) => record.samples)
      .map((sample) => ({ ts: new Date(sample.time).getTime(), bpm: sample.beatsPerMinute }))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/**
 * Write a finished run: the session with its route, and its distance and
 * energy, so it counts in the day's totals. Returns the session's id.
 */
export async function writeRun(
  run: { name: string | null; startedAt: number; endedAt: number; distanceM: number },
  points: readonly TrackPoint[],
  energyKcal: number | null,
): Promise<string | null> {
  const api = await ready();
  if (!api) return null;
  const range = { startTime: new Date(run.startedAt).toISOString(), endTime: new Date(run.endedAt).toISOString() };
  try {
    const [sessionId] = await api.insertRecords([{
      recordType: "ExerciseSession",
      exerciseType: RUNNING,
      title: run.name ?? undefined,
      ...range,
      ...(points.length > 1
        ? {
          exerciseRoute: {
            route: points.map((point) => ({
              time: new Date(point.ts).toISOString(),
              latitude: point.lat,
              longitude: point.lng,
              ...(point.alt === null ? {} : { altitude: { value: point.alt, unit: "meters" as const } }),
              ...(point.accuracy === null ? {} : { horizontalAccuracy: { value: point.accuracy, unit: "meters" as const } }),
            })),
          },
        }
        : {}),
    }]);
    // One distance record per active segment, as on iOS: a pause leaves the
    // day's distance flat rather than drawing a block across it.
    const distances = segments([...points])
      .map((segment) => ({ segment, metres: totalDistanceM(segment) }))
      .filter(({ metres }) => metres > 0)
      .map(({ segment, metres }) => ({
        recordType: "Distance" as const,
        startTime: new Date(segment[0].ts).toISOString(),
        endTime: new Date(segment[segment.length - 1].ts).toISOString(),
        distance: { value: metres, unit: "meters" as const },
      }));
    await api.insertRecords([
      ...(distances.length ? distances : [{ recordType: "Distance" as const, ...range, distance: { value: run.distanceM, unit: "meters" as const } }]),
      ...(energyKcal === null ? [] : [{ recordType: "ActiveCaloriesBurned" as const, ...range, energy: { value: energyKcal, unit: "kilocalories" as const } }]),
    ]).catch(() => undefined);
    return sessionId ?? null;
  } catch {
    return null;
  }
}

/** Remove a session this app wrote. */
export async function deleteRun(sessionId: string): Promise<void> {
  const api = await ready();
  if (!api) return;
  await api.deleteRecordsByUuids("ExerciseSession", [sessionId], []).catch(() => undefined);
}

/** How the app that wrote a run is called, for the line under it. */
const ORIGINS: Record<string, string> = {
  "com.google.android.apps.fitness": "Google Fit",
  "com.garmin.android.apps.connectmobile": "Garmin Connect",
  "com.sec.android.app.shealth": "Samsung Health",
  "com.samsung.android.wear.shealth": "Samsung Health",
  "com.fitbit.FitbitMobile": "Fitbit",
  "com.polar.polarflow": "Polar Flow",
  "com.suunto.connectivity": "Suunto",
  "com.coros.coros": "COROS",
  "com.strava": "Strava",
};

/**
 * The running sessions other apps wrote since `anchor`, with their routes,
 * and the anchor for next time.
 *
 * The anchor here is a moment rather than a token: Health Connect's change
 * tokens expire after thirty days, which a phone left unopened over a long
 * injury would outlast. Asked a week back from it, since a watch can sync
 * late; the ids already here keep anything from coming in twice.
 */
export async function readNewSessions(anchor: string | undefined): Promise<{ workouts: HealthWorkout[]; anchor: string } | null> {
  const api = await ready();
  if (!api) return null;
  const now = Date.now();
  const since = anchor ? Number(anchor) - 7 * 86_400_000 : now - 365 * 86_400_000;
  try {
    const workouts: HealthWorkout[] = [];
    let pageToken: string | undefined;
    do {
      const page = await api.readRecords("ExerciseSession", { timeRangeFilter: between(since, now), pageToken });
      for (const session of page.records) {
        if (session.exerciseType !== RUNNING && session.exerciseType !== RUNNING_TREADMILL) continue;
        const origin = session.metadata?.dataOrigin ?? "";
        const uuid = session.metadata?.id;
        if (!uuid || origin === OWN_PACKAGE) continue;
        const startedAt = new Date(session.startTime).getTime();
        const endedAt = new Date(session.endTime).getTime();
        const distance = await api.readRecords("Distance", {
          timeRangeFilter: between(startedAt, endedAt),
          dataOriginFilter: origin ? [origin] : undefined,
        })
          .then(({ records }) => records.reduce((sum, record) => sum + record.distance.inMeters, 0))
          .catch(() => 0);
        workouts.push({
          uuid,
          startedAt,
          endedAt,
          durationS: (endedAt - startedAt) / 1000,
          distanceM: distance > 0 ? distance : null,
          indoor: session.exerciseType === RUNNING_TREADMILL,
          sourceName: ORIGINS[origin] ?? origin,
          locations: (session.exerciseRoute?.route ?? []).map((location) => ({
            ts: new Date(location.time).getTime(),
            lat: location.latitude,
            lng: location.longitude,
            alt: location.altitude ? toMetres(location.altitude) : null,
            accuracy: location.horizontalAccuracy ? toMetres(location.horizontalAccuracy) : null,
            speed: null,
          })),
        });
      }
      pageToken = page.pageToken;
    } while (pageToken);
    return { workouts, anchor: String(now) };
  } catch {
    return null;
  }
}

/** A Health Connect length, whichever shape it arrives in. */
function toMetres(length: { value?: number; unit?: string; inMeters?: number }): number | null {
  if (typeof length.inMeters === "number") return length.inMeters;
  const factor: Record<string, number> = { meters: 1, kilometers: 1000, miles: 1609.344, feet: 0.3048, inches: 0.0254 };
  return typeof length.value === "number" && length.unit && factor[length.unit] !== undefined
    ? length.value * factor[length.unit]
    : null;
}
