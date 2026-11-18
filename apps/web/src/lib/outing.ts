import { elevationGainM, paceSecPerKm, segments, totalDistanceM, type TrackPoint } from "@tread/core/geo";
import { parseGpx } from "@tread/core/gpx";

/** One GPX file, read and measured in the browser. */
export interface Outing {
  id: string;
  name: string | null;
  ride: boolean;
  startedAt: number | null;
  distanceM: number;
  durationS: number;
  paceSecPerKm: number | null;
  elevationGainM: number;
  points: TrackPoint[];
}

/** Moving time: each segment from its first fix to its last, so pauses do not count. */
function movingTimeS(points: TrackPoint[]): number {
  let total = 0;
  for (const part of segments(points)) {
    if (part.length < 2) continue;
    const span = part[part.length - 1].ts - part[0].ts;
    if (Number.isFinite(span) && span > 0) total += span / 1000;
  }
  return total;
}

export function readOuting(id: string, xml: string): Outing | null {
  const { name, points, ride } = parseGpx(xml);
  if (points.length < 2) return null;
  const distanceM = totalDistanceM(points);
  const durationS = movingTimeS(points);
  const first = points[0].ts;
  return {
    id,
    name,
    ride,
    startedAt: Number.isFinite(first) && first > 0 ? first : null,
    distanceM,
    durationS,
    paceSecPerKm: durationS > 0 ? paceSecPerKm(distanceM, durationS) : null,
    elevationGainM: elevationGainM(points),
    points,
  };
}
