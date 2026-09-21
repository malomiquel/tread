import LiveActivity from "live-activity";
import { formatDistance, formatDuration, formatPace } from "./format";

/**
 * How rarely the lock screen is told anything new.
 *
 * Apple budgets Live Activity updates and starts dropping them when an app
 * pushes too often, so the numbers beside the clock move at a walking pace on
 * purpose. Nothing is lost by it: the clock counts on its own, and a distance
 * a few seconds stale is still a distance. Pausing and resuming ignore this
 * and go through at once, because those are the moments you actually look.
 */
const MIN_INTERVAL_MS = 15_000;

export interface RunProgress {
  /** Instant the clock counts from, or null while the run is paused. */
  clockOriginMs: number | null;
  elapsedS: number;
  distanceM: number;
  paceSKm: number | null;
}

export type RunPhase = "running" | "paused" | "idle";

let activityId: string | null = null;
let shownPhase: RunPhase | null = null;
let lastPushAt = 0;
/** Set once the system has turned an activity down, so it is not asked again. */
let refused = false;
/** Serialises native calls: starting and ending must not overlap. */
let queue: Promise<void> = Promise.resolve();

function run(work: () => Promise<void>): void {
  queue = queue.then(work).catch(() => undefined);
}

/**
 * Reflect the run on the lock screen.
 *
 * `measure` is a function rather than a value because most calls are throttled
 * away, and working out a distance means walking every GPS point recorded so
 * far. This way that cost is paid only when there is something to send.
 */
export function reflectRun(phase: RunPhase, title: string, measure: () => RunProgress): void {
  const native = LiveActivity;
  if (!native) return;

  if (phase === "idle") {
    stopRun();
    return;
  }
  if (refused) return;

  const now = Date.now();
  const phaseChanged = phase !== shownPhase;
  if (activityId !== null && !phaseChanged && now - lastPushAt < MIN_INTERVAL_MS) return;

  lastPushAt = now;
  shownPhase = phase;

  const progress = measure();
  const state = {
    clockOriginMs: progress.clockOriginMs,
    elapsed: formatDuration(Math.round(progress.elapsedS)),
    distance: formatDistance(progress.distanceM),
    pace: formatPace(progress.paceSKm),
  };

  run(async () => {
    if (activityId === null) {
      if (!native.isAvailable()) {
        refused = true;
        return;
      }
      activityId = await native.start(title, state);
      // A refusal is final for this run: the user has turned Live Activities
      // off, or the system is full. Asking again every quarter minute would
      // change nothing.
      if (activityId === null) refused = true;
    } else {
      await native.update(activityId, state);
    }
  });
}

/** Take the run off the lock screen, and clear anything a past one left. */
export function stopRun(): void {
  const native = LiveActivity;
  if (!native) return;

  const hadSomething = activityId !== null || shownPhase !== null;
  activityId = null;
  shownPhase = null;
  refused = false;
  lastPushAt = 0;
  if (hadSomething) run(() => native.stop());
}

/**
 * Clears whatever survived the app being killed mid-run. Called once at
 * launch: an activity outlives its process, and a clock still counting for a
 * run that ended hours ago is worse than no clock at all.
 */
export function clearStaleRun(): void {
  const native = LiveActivity;
  if (!native) return;
  run(() => native.stop());
}
