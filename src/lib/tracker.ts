import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useSyncExternalStore } from "react";
import { createRun, finishRun, insertPoints } from "./db";
import { syncRunToHealth } from "./health";
import { autoName } from "./format";
import { announceAutoPause, announceKilometre, stopSpeaking } from "./feedback";
import {
  distanceM, elevationGainM, fastestKmS, isAcceptable, paceSecPerKm, splits, totalDistanceM,
  type TrackPoint,
} from "./geo";
import { reflectRun, stopRun, type RunProgress } from "./liveActivity";
import { getSettings } from "./settings";

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
  /** True when the pause came from the app noticing you had stopped. */
  autoPaused: boolean;
  /** Last kilometre already announced, so it is never announced twice. */
  announcedKm: number;
  /** True when the background task is live, false on the foreground fallback. */
  backgroundMode: boolean;
  error: string | null;
}

const IDLE: TrackerState = {
  status: "idle", runId: null, points: [], segment: 0, startedAt: null,
  bankedS: 0, segmentStartedAt: null, autoPaused: false, announcedKm: 0,
  accuracyM: null, backgroundMode: false, error: null,
};

/** Slower than a walk: below this you are standing at a crossing. */
const STOP_SPEED_MS = 0.6;
/** A brisk walk, unambiguously moving again. */
const GO_SPEED_MS = 1.4;
/** Sustained, so a red light counts but a stumble does not. */
const STOP_AFTER_S = 12;

/** How many points may sit in memory before they are flushed to disk. */
const FLUSH_EVERY = 20;

let state: TrackerState = IDLE;
const listeners = new Set<() => void>();
let subscription: Location.LocationSubscription | null = null;
let savedCount = 0;
let writeQueue: Promise<void> = Promise.resolve();
let speedWindow: { ts: number; speed: number }[] = [];

function publish(patch: Partial<TrackerState>): void {
  state = { ...state, ...patch };
  // Hooked here rather than at each of the half-dozen places a run changes
  // shape: this is the one road they all take, so the lock screen cannot fall
  // out of step with the app. Most calls are throttled away inside.
  reflectLiveActivity();
  for (const listener of listeners) listener();
}

/**
 * Hand the current run to the lock screen.
 *
 * The clock is sent as the instant it should count from rather than as an
 * elapsed time — the system then ticks on its own, without the app waking up
 * every second to say what the phone can already work out. Pausing simply
 * withdraws that instant, and resuming hands over a new one shifted forward
 * by however long the pause lasted.
 */
function reflectLiveActivity(): void {
  if (state.status === "idle") {
    reflectRun("idle", "", () => EMPTY_PROGRESS);
    return;
  }
  reflectRun(state.status, autoName(state.startedAt ?? Date.now()), (): RunProgress => {
    const elapsedS = activeDurationS(state, Date.now());
    const distanceM = totalDistanceM(state.points);
    return {
      clockOriginMs:
        state.segmentStartedAt === null ? null : state.segmentStartedAt - state.bankedS * 1000,
      elapsedS,
      distanceM,
      paceSKm: paceSecPerKm(distanceM, elapsedS),
    };
  });
}

const EMPTY_PROGRESS: RunProgress = {
  clockOriginMs: null, elapsedS: 0, distanceM: 0, paceSKm: null,
};

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

/** Speed in m/s: the chip's own figure when it has one, otherwise derived. */
function speedOf(location: Location.LocationObject, previous: TrackPoint | null): number {
  const reported = location.coords.speed;
  if (reported !== null && reported >= 0) return reported;
  if (!previous) return 0;
  const elapsed = (location.timestamp - previous.ts) / 1000;
  if (elapsed <= 0) return 0;
  const moved = distanceM(previous, { lat: location.coords.latitude, lng: location.coords.longitude });
  return moved / elapsed;
}

function rememberSpeed(ts: number, speed: number): void {
  speedWindow.push({ ts, speed });
  const cutoff = ts - STOP_AFTER_S * 1000;
  while (speedWindow.length && speedWindow[0].ts < cutoff) speedWindow.shift();
}

/**
 * True only when the whole window agrees we have stopped, and the window
 * actually spans the full delay. Reacting to a single slow fix would pause the
 * run every time the signal wavers under a bridge.
 */
function looksStopped(nowTs: number): boolean {
  if (speedWindow.length < 3) return false;
  if (nowTs - speedWindow[0].ts < STOP_AFTER_S * 1000) return false;
  return speedWindow.every((entry) => entry.speed < STOP_SPEED_MS);
}

/** Announce a kilometre the moment it is completed, once and only once. */
function announceIfKilometre(): void {
  const km = Math.floor(totalDistanceM(state.points) / 1000);
  if (km <= state.announcedKm) return;
  const full = splits(state.points).filter((split) => !split.partial);
  const latest = full[full.length - 1];
  publish({ announcedKm: km });
  announceKilometre(km, latest?.durationS ?? 0, getSettings().voice);
}

export function handleLocation(location: Location.LocationObject): void {
  const point = toPoint(location);
  publish({ accuracyM: point.accuracy });

  const last = state.points.length ? state.points[state.points.length - 1] : null;
  const speed = speedOf(location, last);

  if (state.status === "paused") {
    // Only an automatic pause lifts itself. A pause you asked for stays until
    // you say otherwise.
    if (state.autoPaused && speed > GO_SPEED_MS) {
      announceAutoPause(false, getSettings().voice);
      resume();
    }
    return;
  }
  if (state.status !== "running") return;

  rememberSpeed(point.ts, speed);

  const previous = last && last.segment === point.segment ? last : null;
  if (isAcceptable(previous, point)) {
    publish({ points: [...state.points, point] });
    if (state.points.length - savedCount >= FLUSH_EVERY) void flush();
    announceIfKilometre();
  }

  if (getSettings().autoPause && looksStopped(point.ts)) {
    announceAutoPause(true, getSettings().voice);
    pause(true);
  }
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
          // Highest, not BestForNavigation. Apple reserves the latter for
          // turn-by-turn driving with the device on a charger: it pins the
          // receiver at full rate and brings other sensors in to dead-reckon
          // between fixes. A run does not need to know which lane it is in,
          // and an hour of it would be paid for out of the battery that has
          // to last the whole outing.
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 3,
          timeInterval: 1000,
          activityType: Location.ActivityType.Fitness,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: "Course en cours",
            notificationBody: "Le suivi GPS continue, même écran verrouillé.",
            notificationColor: "#0f7a3d",
          },
        });
        return true;
      }
    }
  } catch {
    /* no background available: fall through to the foreground watcher */
  }

  subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Highest, distanceInterval: 3, timeInterval: 1000 },
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
    speedWindow = [];
    publish({
      status: "running", runId, points: [], segment: 0, startedAt,
      bankedS: 0, segmentStartedAt: startedAt, autoPaused: false, announcedKm: 0,
      backgroundMode: false,
    });
    publish({ backgroundMode: await startGps() });
  } catch (cause) {
    await stopGps();
    publish({ ...IDLE, error: cause instanceof Error ? cause.message : "Impossible de démarrer la course." });
  }
}

export function pause(automatic = false): void {
  if (state.status !== "running" || state.segmentStartedAt === null) return;
  const elapsed = (Date.now() - state.segmentStartedAt) / 1000;
  speedWindow = [];
  publish({
    status: "paused",
    bankedS: state.bankedS + elapsed,
    segmentStartedAt: null,
    autoPaused: automatic,
  });
  void flush();
}

export function resume(): void {
  if (state.status !== "paused") return;
  speedWindow = [];
  publish({
    status: "running",
    segment: state.segment + 1,
    segmentStartedAt: Date.now(),
    autoPaused: false,
  });
}

/** Close the run and return its id, or null when nothing was in progress. */
export async function finish(): Promise<number | null> {
  if (state.status === "idle" || state.runId === null) return null;

  const endedAt = Date.now();
  const duration = activeDurationS(state, endedAt);
  const { runId, points, startedAt } = state;

  stopSpeaking();
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

  // Apple Health is a mirror, and the run is already safe on disk, so the copy
  // is deliberately not awaited: a slow or refused HealthKit call must not
  // hold up the summary screen. The run's own page reports whether the copy
  // landed, and offers to send it again.
  if (getSettings().healthSync) void syncRunToHealth(runId);

  reset();
  return runId;
}

export async function discard(): Promise<void> {
  if (state.status === "idle") return;
  stopSpeaking();
  await stopGps();
  reset();
}

function reset(): void {
  // reset bypasses publish, so the lock screen is cleared by hand here.
  stopRun();
  state = IDLE;
  savedCount = 0;
  speedWindow = [];
  for (const listener of listeners) listener();
}
