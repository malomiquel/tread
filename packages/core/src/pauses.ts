// Extension spelled out: this module is loaded by a plain node test.
import { distanceM, segments, type TrackPoint } from "./geo.ts";

/**
 * The stops a run made, read back from its track.
 *
 * Every resume opens a new segment, whether the runner pressed pause or the
 * run paused itself at a stop: a pause is the gap between the last fix of
 * one segment and the first of the next. Nothing else needs storing, so
 * every run ever recorded has its pauses already.
 */
export interface Pause {
  /** How far into the run it began. */
  atM: number;
  /** How long had been run, moving, when it began. */
  afterS: number;
  durationS: number;
}

/**
 * Shorter than this is the GPS taking a breath between two fixes, not a
 * stop anybody made.
 */
const SHORTEST_S = 3;

export function pausesOf(points: readonly TrackPoint[]): Pause[] {
  const parts = segments([...points]);
  const pauses: Pause[] = [];
  let metres = 0;
  let moving = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    for (let k = 1; k < part.length; k += 1) metres += distanceM(part[k - 1], part[k]);
    moving += (part[part.length - 1].ts - part[0].ts) / 1000;
    const next = parts[i + 1];
    if (!next) break;
    const durationS = (next[0].ts - part[part.length - 1].ts) / 1000;
    if (durationS >= SHORTEST_S) pauses.push({ atM: metres, afterS: moving, durationS });
  }
  return pauses;
}

/** Everything spent stopped, in seconds. */
export const pausedS = (pauses: readonly Pause[]): number =>
  pauses.reduce((sum, pause) => sum + pause.durationS, 0);
