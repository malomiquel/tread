// Extension spelled out, as in archive.ts: this module is loaded by a plain
// node test, and node resolves a relative import literally.
import { distanceM, type TrackPoint } from "./geo.ts";

/**
 * Replaying a finished run on its own map.
 *
 * The track is drawn from the start rather than shown whole, at the speed it
 * was actually run — so the line crawls up the hill and shoots down the other
 * side, and a slow kilometre takes longer to draw than a fast one. That is
 * the whole idea: the shape of a route says where you went, and only its
 * pacing says how it went.
 *
 * The clock is the run's own, compressed. Pauses are not: a replay that sat
 * still for the eleven minutes somebody spent at a level crossing would be a
 * replay nobody watches to the end.
 */

/**
 * How long the whole replay takes, whatever the run.
 *
 * Fixed rather than proportional, and that is the point: at a constant total,
 * every second of the animation is the same number of seconds of running, so
 * the only thing that makes the line slow down is the runner having slowed
 * down. A duration that scaled with the run would flatten exactly the
 * difference this exists to show.
 *
 * Twelve seconds is about as long as anybody watches a line draw itself.
 */
export const REPLAY_MS = 12_000;

/**
 * The longest gap a replay will sit through, in real run time.
 *
 * Anything longer is a pause the tracker did not record as one — a phone that
 * lost the sky under a bridge, or a run recovered after a crash. Counting it
 * would spend a third of the animation on a frozen dot.
 */
const MAX_GAP_MS = 20_000;

export interface ReplayTrack {
  /** The points actually drawn, thinned for the animation. */
  points: TrackPoint[];
  /** Milliseconds of running elapsed at each point, pauses removed. */
  marks: number[];
  /** Metres covered at each point. */
  metres: number[];
  totalMs: number;
  totalM: number;
}

/**
 * Thin a track down to something a map can redraw twenty-five times a second.
 *
 * A long run holds thousands of fixes and a polyline rebuilt from all of them
 * on every frame is a replay that stutters. Every nth point is kept, plus the
 * ends of every segment — losing a segment boundary would draw a line across
 * a pause, which is the one thing the map has always refused to do.
 */
export function thin(points: TrackPoint[], most: number): TrackPoint[] {
  if (points.length <= most) return points;
  const step = Math.ceil(points.length / most);
  const kept: TrackPoint[] = [];
  points.forEach((point, index) => {
    const edge = index === 0
      || index === points.length - 1
      || point.segment !== points[index - 1].segment
      || point.segment !== points[Math.min(index + 1, points.length - 1)].segment;
    if (edge || index % step === 0) kept.push(point);
  });
  return kept;
}

/**
 * Lay a track out on two axes at once: time run and ground covered.
 *
 * Both are needed by the thing that watches it — the line is placed by time
 * and the figures beside it are read in metres — and both are cumulative, so
 * they are computed once here rather than summed again on every frame.
 */
export function buildReplay(points: TrackPoint[], most = 600): ReplayTrack | null {
  const kept = thin(points, most);
  if (kept.length < 2) return null;

  const marks: number[] = [0];
  const metres: number[] = [0];
  for (let i = 1; i < kept.length; i += 1) {
    const previous = kept[i - 1];
    const point = kept[i];
    // A pause is a change of segment, and it costs the replay nothing.
    const sameLeg = point.segment === previous.segment;
    const gap = sameLeg ? Math.min(Math.max(point.ts - previous.ts, 0), MAX_GAP_MS) : 0;
    marks.push(marks[i - 1] + gap);
    metres.push(metres[i - 1] + (sameLeg ? distanceM(previous, point) : 0));
  }

  return {
    points: kept,
    marks,
    metres,
    totalMs: marks[marks.length - 1],
    totalM: metres[metres.length - 1],
  };
}

export interface ReplayHead {
  /** The last point already drawn. */
  index: number;
  /** How far past it the head has travelled, from zero to one. */
  fraction: number;
  lat: number;
  lng: number;
  /** Where the figures beside the map come from. */
  elapsedMs: number;
  metresRun: number;
  done: boolean;
}

/**
 * Where the head of the line is, a given share of the way through.
 *
 * Interpolated between two fixes rather than snapped to the nearer one: at
 * twenty-five frames a second and a fix every second, snapping would make the
 * line advance in visible steps — which reads as a stuttering animation
 * rather than as a runner.
 */
export function headAt(track: ReplayTrack, share: number): ReplayHead {
  const clamped = Math.min(1, Math.max(0, share));
  const wanted = track.totalMs * clamped;

  // Binary search: this runs on every frame, and a walk from the start would
  // make a long run cost more per frame than a short one.
  let low = 0;
  let high = track.marks.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (track.marks[middle] <= wanted) low = middle;
    else high = middle - 1;
  }

  const index = Math.min(low, track.points.length - 2);
  const here = track.points[index];
  const next = track.points[index + 1];
  const span = track.marks[index + 1] - track.marks[index];
  const fraction = span > 0 ? Math.min(1, (wanted - track.marks[index]) / span) : 0;
  // Across a pause there is nothing to interpolate: the head waits on this
  // side of it rather than gliding over the gap.
  const glide = next.segment === here.segment ? fraction : 0;

  return {
    index,
    fraction: glide,
    lat: here.lat + (next.lat - here.lat) * glide,
    lng: here.lng + (next.lng - here.lng) * glide,
    elapsedMs: wanted,
    metresRun: track.metres[index]
      + (track.metres[index + 1] - track.metres[index]) * glide,
    done: clamped >= 1,
  };
}

/**
 * What to draw: the segments already run, cut off at the head.
 *
 * Returned segment by segment for the same reason the finished map is drawn
 * that way — a pause must never appear as a line between where you stopped
 * and where you started again.
 */
export function drawnSoFar(track: ReplayTrack, head: ReplayHead): TrackPoint[][] {
  const upTo = track.points.slice(0, head.index + 1);
  if (head.fraction > 0) {
    const here = track.points[head.index];
    upTo.push({ ...here, lat: head.lat, lng: head.lng, ts: here.ts + 1 });
  }

  const legs: TrackPoint[][] = [];
  for (const point of upTo) {
    const leg = legs[legs.length - 1];
    if (leg && leg[0].segment === point.segment) leg.push(point);
    else legs.push([point]);
  }
  // A single point is not a line, and a polyline of one draws nothing anyway.
  return legs.filter((leg) => leg.length > 1);
}
