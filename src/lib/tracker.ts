import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useSyncExternalStore } from "react";
import { createRun, finishRun, insertPoints } from "./db";
import { autoName } from "./format";
import {
  elevationGainM, fastestKmS, isAcceptable, paceSecPerKm, totalDistanceM, type TrackPoint,
} from "./geo";

export const TASK_NAME = "tread-gps-tracking";

export type TrackerStatus = "idle" | "running" | "paused";

export interface TrackerState {
  status: TrackerStatus;
  runId: number | null;
  points: TrackPoint[];
  /** Current segment, bumped on every resume so pauses never join up. */
  segment: number;
  startedAt: number | null;
  /** Active seconds already banked before the current segment. */
  bankedS: number;
  /** Start of the active segment, null while paused. */
  segmentStartedAt: number | null;
  /** Accuracy of the last fix, even a rejected one: it doubles as a signal gauge. */
  accuracyM: number | null;
  /** True when the background task is live, false on the foreground fallback. */
  backgroundMode: boolean;
  error: string | null;
}

const IDLE: TrackerState = {
  status: "idle", runId: null, points: [], segment: 0, startedAt: null,
  bankedS: 0, segmentStartedAt: null, accuracyM: null, backgroundMode: false, error: null,
};

/** How many points may sit in memory before they are flushed to disk. */
const FLUSH_EVERY = 20;

let state: TrackerState = IDLE;
const listeners = new Set<() => void>();
let subscription: Location.LocationSubscription | null = null;
let savedCount = 0;
let writeQueue: Promise<void> = Promise.resolve();

function publish(patch: Partial<TrackerState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getSnapshot = (): TrackerState => state;

export function useTracker(): TrackerState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Total active seconds at the given instant. */
export function activeDurationS(snapshot: TrackerState, nowTs: number): number {
  const current = snapshot.segmentStartedAt !== null ? (nowTs - snapshot.segmentStartedAt) / 1000 : 0;
  return snapshot.bankedS + current;
}

// The task must be defined at module load, outside any component: the system
// can wake the app straight into it without going through the interface.
// SDK 57 expects an async executor, even though the work here is synchronous.
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const location of locations) handleLocation(location);
});

function toPoint(location: Location.LocationObject): TrackPoint {
  return {
    ts: location.timestamp,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    alt: location.coords.altitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    segment: state.segment,
  };
}

export function handleLocation(location: Location.LocationObject): void {
  const point = toPoint(location);
  if (state.status !== "running") {
    publish({ accuracyM: point.accuracy });
    return;
  }

  const last = state.points.length ? state.points[state.points.length - 1] : null;
  const previous = last && last.segment === point.segment ? last : null;
  if (!isAcceptable(previous, point)) {
    publish({ accuracyM: point.accuracy });
    return;
  }

  publish({ points: [...state.points, point], accuracyM: point.accuracy });
  if (state.points.length - savedCount >= FLUSH_EVERY) void flush();
}

/** Write pending points to disk, never letting two writes overlap. */
function flush(): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      if (state.runId === null) return;
      const pending = state.points.slice(savedCount);
      if (!pending.length) return;
      await insertPoints(state.runId, pending);
      savedCount += pending.length;
    })
    .catch(() => undefined);
  return writeQueue;
}

/** Returns true when the background task took over, false on the foreground fallback. */
async function startGps(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Sans autorisation de localisation, impossible de tracer la course.");
  }

  // Background where possible, which is what makes a locked screen work. This
  // fails cleanly inside Expo Go, which does not offer it, and we fall back to
  // the foreground watcher below.
  try {
    if (await Location.isBackgroundLocationAvailableAsync()) {
      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status === "granted") {
        await Location.startLocationUpdatesAsync(TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1000,
          activityType: Location.ActivityType.Fitness,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: "Course en cours",
            notificationBody: "Le suivi GPS continue, même écran verrouillé.",
            notificationColor: "#16a34a",
          },
        });
        return true;
      }
    }
  } catch {
    /* no background available: fall through to the foreground watcher */
  }

  subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 1000 },
    handleLocation,
  );
  return false;
}

async function stopGps(): Promise<void> {
  subscription?.remove();
  subscription = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
  } catch {
    /* already stopped */
  }
}

export async function start(): Promise<void> {
  if (state.status !== "idle") return;
  publish({ error: null });
  try {
    const startedAt = Date.now();
    const runId = await createRun(startedAt);
    savedCount = 0;
    publish({
      status: "running", runId, points: [], segment: 0, startedAt,
      bankedS: 0, segmentStartedAt: startedAt, backgroundMode: false,
    });
    publish({ backgroundMode: await startGps() });
  } catch (cause) {
    await stopGps();
    publish({ ...IDLE, error: cause instanceof Error ? cause.message : "Impossible de démarrer la course." });
  }
}

export function pause(): void {
  if (state.status !== "running" || state.segmentStartedAt === null) return;
  const elapsed = (Date.now() - state.segmentStartedAt) / 1000;
  publish({ status: "paused", bankedS: state.bankedS + elapsed, segmentStartedAt: null });
  void flush();
}

export function resume(): void {
  if (state.status !== "paused") return;
  publish({ status: "running", segment: state.segment + 1, segmentStartedAt: Date.now() });
}

/** Close the run and return its id, or null when nothing was in progress. */
export async function finish(): Promise<number | null> {
  if (state.status === "idle" || state.runId === null) return null;

  const endedAt = Date.now();
  const duration = activeDurationS(state, endedAt);
  const { runId, points, startedAt } = state;

  publish({ status: "paused", segmentStartedAt: null, bankedS: duration });
  await stopGps();
  await flush();

  const distance = totalDistanceM(points);
  await finishRun(runId, {
    endedAt,
    distanceM: distance,
    durationS: Math.round(duration),
    avgPaceSKm: paceSecPerKm(distance, duration),
    name: autoName(startedAt ?? endedAt),
    elevationGainM: elevationGainM(points),
    fastestKmS: fastestKmS(points),
  });

  reset();
  return runId;
}

export async function discard(): Promise<void> {
  if (state.status === "idle") return;
  await stopGps();
  reset();
}

function reset(): void {
  state = IDLE;
  savedCount = 0;
  for (const listener of listeners) listener();
}
