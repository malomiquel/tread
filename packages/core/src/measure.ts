import type { ActivityType } from "./activity.ts";
import { autoName } from "./format.ts";
import {
  elevationGainM, fastestKmS, paceSecPerKm, segments, totalDistanceM, type TrackPoint,
} from "./geo.ts";

/** What a bare track adds up to, worked out the way the app measures its own runs. */
export interface MeasuredTrack {
  startedAt: number;
  endedAt: number;
  distanceM: number;
  /** Moving time: each segment from its first fix to its last, so pauses do not count. */
  durationS: number;
  avgPaceSKm: number | null;
  name: string;
  elevationGainM: number;
  /** Null on a ride: a ride has no kilometre to race. */
  fastestKmS: number | null;
}

/**
 * A track from a file, measured.
 *
 * Totals are recomputed rather than trusted from the file, because a file
 * written elsewhere states its own figures and they are rarely measured the
 * same way. The phone (a GPX opened on it) and the server (a GPX uploaded in
 * the browser) both bring files in through here, so a run reads the same
 * wherever it arrived. Null when there is no track to speak of.
 */
export function measureTrack(
  name: string | null, points: readonly TrackPoint[], activity: ActivityType = "run",
): MeasuredTrack | null {
  if (points.length < 2) return null;
  const track = [...points];
  const startedAt = track[0].ts;
  const riding = activity === "ride";
  const distanceM = totalDistanceM(track);
  const durationS = Math.round(segments(track)
    .reduce((total, part) => total + (part[part.length - 1].ts - part[0].ts) / 1000, 0));
  return {
    startedAt,
    endedAt: track[track.length - 1].ts,
    distanceM,
    durationS,
    avgPaceSKm: paceSecPerKm(distanceM, durationS),
    name: name ?? autoName(startedAt, riding),
    elevationGainM: elevationGainM(track),
    fastestKmS: riding ? null : fastestKmS(track),
  };
}
