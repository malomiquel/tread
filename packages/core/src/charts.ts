import { distanceM, segments, type TrackPoint } from "./geo.ts";
import type { Beat } from "./heart.ts";

/**
 * The series drawn on a run's page, each against distance.
 *
 * Distance rather than time along the bottom, like the elevation profile, so
 * the charts line up and a slow stretch can be read against the hill that
 * caused it. Every series is averaged into even slices of distance: a single
 * wild fix cannot draw a spike, and a stretch with dense fixes cannot
 * outweigh a sparse one.
 */

export interface ChartPoint {
  /** Distance into the run, in metres. */
  distanceM: number;
  value: number;
}

/** Values averaged into `buckets` even slices of the run's distance. */
function sliced(samples: ChartPoint[], total: number, buckets: number): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const from = (total * i) / buckets;
    const to = (total * (i + 1)) / buckets;
    const inside = samples.filter((sample) => sample.distanceM >= from && (sample.distanceM < to || i === buckets - 1));
    if (!inside.length) continue;
    out.push({ distanceM: (from + to) / 2, value: inside.reduce((sum, sample) => sum + sample.value, 0) / inside.length });
  }
  return out;
}

/** Slower than this is walking or standing, and would flatten the chart. */
const SLOWEST_PACE_S_KM = 15 * 60;

/** The shortest stretch a pace is measured over, so fix jitter is not a sprint. */
const PACE_OVER_M = 50;

/**
 * Pace along the run, in seconds per kilometre.
 *
 * Measured stretch by stretch over at least 50 m. Stretches slower than a
 * walk are left out rather than drawn as cliffs: a stop at a light is not a
 * pace.
 */
export function paceSeries(points: readonly TrackPoint[], buckets = 50): ChartPoint[] {
  const samples: ChartPoint[] = [];
  let total = 0;
  for (const segment of segments([...points])) {
    let anchor = 0;
    let anchorAt = 0;
    let covered = 0;
    for (let i = 1; i < segment.length; i += 1) {
      covered += distanceM(segment[i - 1], segment[i]);
      const stretch = covered - anchorAt;
      if (stretch < PACE_OVER_M) continue;
      const pace = (segment[i].ts - segment[anchor].ts) / 1000 / (stretch / 1000);
      if (pace > 0 && pace <= SLOWEST_PACE_S_KM) {
        samples.push({ distanceM: total + anchorAt + stretch / 2, value: pace });
      }
      anchor = i;
      anchorAt = covered;
    }
    total += covered;
  }
  return total > 0 && samples.length > 1 ? sliced(samples, total, buckets) : [];
}

/**
 * Heart rate along the run, from the beats a watch wrote to Health.
 *
 * Each beat is placed at the distance the run had reached at that moment,
 * interpolated between the fixes around it. Beats from before the start,
 * after the finish, or during a pause have no distance and are dropped.
 */
export function heartSeries(beats: readonly Beat[], points: readonly TrackPoint[], buckets = 50): ChartPoint[] {
  const ts: number[] = [];
  const covered: number[] = [];
  const segmentOf: number[] = [];
  let metres = 0;
  for (const segment of segments([...points])) {
    segment.forEach((point, i) => {
      if (i > 0) metres += distanceM(segment[i - 1], point);
      ts.push(point.ts);
      covered.push(metres);
      segmentOf.push(point.segment);
    });
  }
  if (ts.length < 2) return [];

  const samples: ChartPoint[] = [];
  let at = 0;
  for (const beat of [...beats].sort((a, b) => a.ts - b.ts)) {
    if (beat.ts < ts[0] || beat.ts > ts[ts.length - 1]) continue;
    while (at + 1 < ts.length && ts[at + 1] < beat.ts) at += 1;
    const next = Math.min(at + 1, ts.length - 1);
    // Between the last fix before a pause and the first after it, nothing
    // was being run.
    if (segmentOf[next] !== segmentOf[at]) continue;
    const share = ts[next] > ts[at] ? (beat.ts - ts[at]) / (ts[next] - ts[at]) : 0;
    samples.push({ distanceM: covered[at] + share * (covered[next] - covered[at]), value: beat.bpm });
  }
  const total = covered[covered.length - 1];
  return total > 0 && samples.length > 1 ? sliced(samples, total, buckets) : [];
}
