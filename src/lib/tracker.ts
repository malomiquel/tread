import * as Location from "expo-location";
import { Pedometer } from "expo-sensors";
import * as TaskManager from "expo-task-manager";
import { useSyncExternalStore } from "react";
import { cadenceSpm } from "./cadence";
import { createRun, finishRun, insertPoints, markPlanSessionDone } from "./db";
import { syncRunToHealth } from "./health";
import { autoName } from "./format";
import { announceKilometre, announcePace, announceStep, stopSpeaking } from "./feedback";
import {
  currentPace, elevationGainM, fastestKmS, isAcceptable, paceSecPerKm, splits, totalDistanceM,
  type TrackPoint,
} from "./geo";
import { reflectRun, stopRun, type RunProgress } from "./liveActivity";
import { paceDrift } from "./pace";
import { getSettings } from "./settings";
import {
  hasSinglePace, isPaced, stepIsDone, stepLabel, type RanBlock, type Session,
} from "./workout";

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
  /** Last kilometre already announced, so it is never announced twice. */
  announcedKm: number;
  /**
   * The structured session being run, or null for a free run.
   *
   * The session itself rather than its name in the catalogue, because a plan
   * generates its own: six repetitions in week three and eight in week nine
   * are two different sessions that no fixed list could hold.
   */
  session: Session | null;
  /** Its position in the programme, when it came from one. */
  planOrder: number | null;
  /** Which block of it is under way. Past the last one, the session is done. */
  stepIndex: number;
  /** Distance and active time at which that block began. */
  stepStartM: number;
  stepStartS: number;
  /** Blocks already finished, kept so the run can be read back later. */
  blocks: RanBlock[];
  /** True when the background task is live, false on the foreground fallback. */
  backgroundMode: boolean;
  error: string | null;
}

const IDLE: TrackerState = {
  status: "idle", runId: null, points: [], segment: 0, startedAt: null,
  bankedS: 0, segmentStartedAt: null, announcedKm: 0,
  session: null, planOrder: null, stepIndex: 0, stepStartM: 0, stepStartS: 0, blocks: [],
  accuracyM: null, backgroundMode: false, error: null,
};

/** How many points may sit in memory before they are flushed to disk. */
const FLUSH_EVERY = 20;

let state: TrackerState = IDLE;
const listeners = new Set<() => void>();
let subscription: Location.LocationSubscription | null = null;
let savedCount = 0;
let writeQueue: Promise<void> = Promise.resolve();
let runTicker: ReturnType<typeof setInterval> | null = null;
let lastPaceWord = 0;

/**
 * How often the target pace may be mentioned, and how long a run must have
 * been going before it is mentioned at all.
 *
 * Sparse on purpose. The pace reading is a thirty second average, so a
 * correction repeated faster than that would be reacting to the same
 * information twice — and a voice that keeps telling you the same thing is a
 * voice you stop hearing.
 */
const PACE_WORD_EVERY_MS = 45_000;
const PACE_WORD_AFTER_MS = 60_000;

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

/**
 * Choose the session the next run will follow. Only between runs: swapping
 * sessions mid-effort would leave the blocks already done belonging to a plan
 * that no longer exists.
 */
export function chooseSession(session: Session | null, planOrder: number | null = null): void {
  if (state.status !== "idle") return;
  publish({ session, planOrder });
}

/**
 * Move the session on when the current block is finished.
 *
 * Driven by a clock of its own rather than by GPS fixes, because a block
 * measured in time has to end on time even when nothing is moving — a ninety
 * second recovery spent standing still produces no fixes at all, and would
 * otherwise never end.
 */
function advanceSession(): void {
  const { session } = state;
  if (!session || state.status !== "running") return;
  const step = session.steps[state.stepIndex];
  if (!step) return;

  const distance = totalDistanceM(state.points);
  const active = activeDurationS(state, Date.now());
  if (!stepIsDone(step, distance - state.stepStartM, active - state.stepStartS)) return;

  // Recorded as it was actually run, target included, so the finished run can
  // be read back without asking the catalogue what the session used to be.
  const ran: RanBlock = {
    effort: step.effort,
    targetMetres: step.metres ?? null,
    targetSeconds: step.seconds ?? null,
    distanceM: distance - state.stepStartM,
    durationS: active - state.stepStartS,
  };

  const nextIndex = state.stepIndex + 1;
  publish({
    stepIndex: nextIndex,
    stepStartM: distance,
    stepStartS: active,
    blocks: [...state.blocks, ran],
  });
  const nextStep = session.steps[nextIndex];
  announceStep(nextStep ? stepLabel(nextStep) : null, getSettings().voice);
}

/**
 * Say how far off the target pace the run has drifted, when it has.
 *
 * Runs for a free run as much as a structured one: a pace to hold is the
 * runner's own, not the session's.
 */
function checkPace(): void {
  const { targetPaceSKm, voice } = getSettings();
  if (state.status !== "running" || targetPaceSKm === null) return;

  // A session of varied efforts sets its own paces, and a target left over
  // from an earlier run would talk over it — correcting a recovery towards a
  // figure chosen for a repetition.
  const { session } = state;
  if (session) {
    if (!hasSinglePace(session)) return;
    // Even then, only through the block the target was meant for. A long run
    // warms up and cools down around its pace, and nobody wants to be told
    // they are running their warm-up too slowly.
    const step = session.steps[state.stepIndex];
    if (!step || !isPaced(step)) return;
  }

  const now = Date.now();
  if (state.startedAt !== null && now - state.startedAt < PACE_WORD_AFTER_MS) return;
  if (now - lastPaceWord < PACE_WORD_EVERY_MS) return;

  const drift = paceDrift(currentPace(state.points, now), targetPaceSKm);
  if (drift === null) return;

  lastPaceWord = now;
  announcePace(drift, voice);
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

  // A pause is only ever asked for. Guessing that a runner has stopped means
  // guessing wrong sometimes, and a wrong guess quietly shortens the recorded
  // time of a run that really was still going — the one number nobody can
  // check afterwards.
  if (state.status !== "running") return;

  const last = state.points.length ? state.points[state.points.length - 1] : null;
  const previous = last && last.segment === point.segment ? last : null;
  if (isAcceptable(previous, point)) {
    publish({ points: [...state.points, point] });
    if (state.points.length - savedCount >= FLUSH_EVERY) void flush();
    announceIfKilometre();
  }
}

/**
 * The cadence held over a finished run, asked of the phone after the fact.
 *
 * Asked rather than counted as it happens, which matters more than it sounds:
 * the pedometer keeps its own log, so the answer is right even when the run
 * was spent in a pocket with the screen off and nothing here could have
 * counted a thing.
 */
async function cadenceOf(from: number, to: number, activeS: number): Promise<number | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const { status } = await Pedometer.requestPermissionsAsync();
    if (status !== "granted") return null;
    const { steps } = await Pedometer.getStepCountAsync(new Date(from), new Date(to));
    return cadenceSpm(steps, activeS);
  } catch {
    // No pedometer, no permission, or a simulator: a run is worth keeping
    // without a cadence.
    return null;
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
            notificationColor: "#00348f",
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
    publish({
      status: "running", runId, points: [], segment: 0, startedAt,
      bankedS: 0, segmentStartedAt: startedAt, announcedKm: 0,
      stepIndex: 0, stepStartM: 0, stepStartS: 0, blocks: [],
      backgroundMode: false,
    });
    const { session } = state;
    if (session) announceStep(stepLabel(session.steps[0]), getSettings().voice);
    // One clock for both: the session needs it because a block measured in
    // time must end without gps fixes, and the pace needs it because a runner
    // drifting off target produces no event of their own.
    lastPaceWord = 0;
    runTicker = setInterval(() => {
      advanceSession();
      checkPace();
    }, 1000);
    publish({ backgroundMode: await startGps() });
  } catch (cause) {
    await stopGps();
    publish({ ...IDLE, error: cause instanceof Error ? cause.message : "Impossible de démarrer la course." });
  }
}

export function pause(): void {
  if (state.status !== "running" || state.segmentStartedAt === null) return;
  const elapsed = (Date.now() - state.segmentStartedAt) / 1000;
  publish({
    status: "paused",
    bankedS: state.bankedS + elapsed,
    segmentStartedAt: null,
  });
  void flush();
}

export function resume(): void {
  if (state.status !== "paused") return;
  publish({
    status: "running",
    segment: state.segment + 1,
    segmentStartedAt: Date.now(),
  });
}

/**
 * The blocks to store: those already finished, plus the one under way when
 * the run was stopped.
 */
function closingBlocks(endedAt: number): RanBlock[] {
  const { session } = state;
  const step = session?.steps[state.stepIndex];
  if (!session || !step) return state.blocks;

  const distance = totalDistanceM(state.points) - state.stepStartM;
  const duration = activeDurationS(state, endedAt) - state.stepStartS;
  if (distance <= 0 && duration <= 0) return state.blocks;

  return [...state.blocks, {
    effort: step.effort,
    targetMetres: step.metres ?? null,
    targetSeconds: step.seconds ?? null,
    distanceM: distance,
    durationS: duration,
  }];
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
  const cadence = startedAt === null ? null : await cadenceOf(startedAt, endedAt, duration);
  await finishRun(runId, {
    endedAt,
    distanceM: distance,
    durationS: Math.round(duration),
    avgPaceSKm: paceSecPerKm(distance, duration),
    name: autoName(startedAt ?? endedAt),
    elevationGainM: elevationGainM(points),
    fastestKmS: fastestKmS(points),
    cadenceSpm: cadence,
    sessionId: state.session?.id ?? null,
    // Including the block under way when the run was stopped: a session
    // abandoned halfway is still a session, and the work done in that last
    // repetition was done.
    blocks: closingBlocks(endedAt),
  });

  // Tick the plan off only now. The run is on disk at this point, so a
  // programme can never claim a session that was not recorded.
  if (state.planOrder !== null) {
    await markPlanSessionDone(state.planOrder, runId, endedAt).catch(() => undefined);
  }

  // Apple Health is a mirror, and the run is already safe on disk, so the copy
  // is deliberately not awaited: a slow or refused HealthKit call must not
  // hold up the summary screen. The run's own page reports whether the copy
  // landed, and offers to send it again.
  //
  // No setting guards this any more. Permission is the only gate that matters,
  // and iOS already owns it — a second switch inside the app could only ever
  // disagree with the one in Settings, or quietly countermand a yes.
  void syncRunToHealth(runId);

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
  if (runTicker) {
    clearInterval(runTicker);
    runTicker = null;
  }
  // reset bypasses publish, so the lock screen is cleared by hand here.
  stopRun();
  // The chosen session outlives the run: having just finished one set of
  // intervals, the last thing wanted is to have to choose it again.
  state = { ...IDLE, session: state.session, planOrder: state.planOrder };
  savedCount = 0;
  for (const listener of listeners) listener();
}
