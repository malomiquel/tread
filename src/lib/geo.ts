/**
 * Pure geographic maths, with no React Native dependency, so everything here
 * can be exercised by plain Node. Distance, noise filtering, pace, splits and
 * elevation all live in this file.
 */

export interface TrackPoint {
  /** Milliseconds since the epoch. */
  ts: number;
  lat: number;
  lng: number;
  alt: number | null;
  /** Accuracy radius in metres, as reported by the GPS chip. */
  accuracy: number | null;
  /** Ground speed in m/s, when the chip reports one. */
  speed: number | null;
  /** Segment index, bumped on every resume so pauses never join up. */
  segment: number;
}

const EARTH_RADIUS_M = 6371008.8;

/**
 * Beyond this the fix is too vague to trust, typical of an indoor start.
 *
 * Twenty metres rather than thirty. A vague fix does not shorten a run, it
 * lengthens it: the reported position wanders around where you actually are,
 * and every wander is counted as ground covered. Between tall buildings that
 * is how a five-kilometre run reports five and a half — the credibility
 * problem runs in the opposite direction to the one people expect.
 */
export const MAX_ACCURACY_M = 20;
/** 12 m/s is 43 km/h: no runner, but a very common GPS jump. */
export const MAX_SPEED_MS = 12;
/** Below this it is GPS jitter while standing still, not travel. */
export const MIN_TRAVEL_M = 1.5;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Decide whether a fix deserves a place in the track. `previous` is the last
 * accepted point of the same segment, or null at the start of one.
 */
export function isAcceptable(previous: TrackPoint | null, point: TrackPoint): boolean {
  if (point.accuracy !== null && point.accuracy > MAX_ACCURACY_M) return false;
  if (!previous) return true;
  const elapsedS = (point.ts - previous.ts) / 1000;
  if (elapsedS <= 0) return false;
  const travelled = distanceM(previous, point);
  if (travelled < MIN_TRAVEL_M) return false;
  if (travelled / elapsedS > MAX_SPEED_MS) return false;
  return true;
}

/** Group points by segment, preserving order. */
export function segments(points: TrackPoint[]): TrackPoint[][] {
  const groups: TrackPoint[][] = [];
  let current: TrackPoint[] = [];
  let index: number | null = null;
  for (const point of points) {
    if (index !== null && point.segment !== index) {
      if (current.length) groups.push(current);
      current = [];
    }
    index = point.segment;
    current.push(point);
  }
  if (current.length) groups.push(current);
  return groups;
}

/** Cumulative distance in metres, never joining two segments together. */
export function totalDistanceM(points: TrackPoint[]): number {
  let total = 0;
  for (const segment of segments(points)) {
    for (let i = 1; i < segment.length; i++) total += distanceM(segment[i - 1], segment[i]);
  }
  return total;
}

/** Average pace in seconds per kilometre, or null when the run is too short to mean anything. */
export function paceSecPerKm(distanceMetres: number, durationS: number): number | null {
  if (distanceMetres < 50 || durationS <= 0) return null;
  return durationS / (distanceMetres / 1000);
}

/**
 * Pace over the last few seconds of the current segment. A 30 second window
 * smooths GPS noise without hiding a genuine change of rhythm.
 */
export function currentPace(points: TrackPoint[], nowTs: number, windowS = 30): number | null {
  const all = segments(points);
  const segment = all[all.length - 1];
  if (!segment || segment.length < 2) return null;

  const since = nowTs - windowS * 1000;
  const recent = segment.filter((p) => p.ts >= since);
  if (recent.length < 2) return null;

  let travelled = 0;
  for (let i = 1; i < recent.length; i++) travelled += distanceM(recent[i - 1], recent[i]);
  const elapsedS = (recent[recent.length - 1].ts - recent[0].ts) / 1000;
  if (travelled < 20 || elapsedS <= 0) return null;
  return elapsedS / (travelled / 1000);
}

export interface Split {
  /** 1 for the first kilometre, and so on. */
  km: number;
  /** Duration of this kilometre in seconds. */
  durationS: number;
  /** True for the trailing chunk when it falls short of a kilometre. */
  partial: boolean;
  /** Actual length of the chunk in metres, mostly useful for the partial one. */
  distanceM: number;
}

/**
 * Per-kilometre times. Each marker is interpolated inside the leg that crosses
 * it rather than rounded to the nearest fix, which would shift every split by
 * several seconds. Pauses are excluded: the walk works segment by segment, in
 * active time only.
 */
export function splits(points: TrackPoint[]): Split[] {
  const result: Split[] = [];
  let covered = 0;
  let marker = 1000;
  let activeS = 0; // active seconds elapsed before the current segment
  let lastMarkerS = 0;

  for (const segment of segments(points)) {
    const segmentStart = segment[0].ts;
    for (let i = 1; i < segment.length; i++) {
      const from = segment[i - 1];
      const to = segment[i];
      const legM = distanceM(from, to);
      const fromS = activeS + (from.ts - segmentStart) / 1000;
      const toS = activeS + (to.ts - segmentStart) / 1000;

      let before = covered;
      covered += legM;
      while (covered >= marker) {
        const ratio = legM > 0 ? (marker - before) / legM : 1;
        const markerS = fromS + ratio * (toS - fromS);
        result.push({ km: marker / 1000, durationS: markerS - lastMarkerS, partial: false, distanceM: 1000 });
        lastMarkerS = markerS;
        before = marker;
        marker += 1000;
      }
    }
    activeS += (segment[segment.length - 1].ts - segmentStart) / 1000;
  }

  const remainder = covered - (marker - 1000);
  if (remainder > 50) {
    result.push({ km: marker / 1000, durationS: activeS - lastMarkerS, partial: true, distanceM: remainder });
  }
  return result;
}

/**
 * Cumulative elevation gain in metres.
 *
 * Two precautions, because altitude is the least reliable figure the GPS
 * gives us. First a moving average, which absorbs the wobble of a stationary
 * device: without it a perfectly flat route would report hundreds of metres of
 * climb. Then hysteresis, which only banks a climb once it clears a threshold
 * above the last reference point.
 *
 * Smoothing trims the ends of the series and so slightly understates a short
 * hill. That is the price worth paying: inventing elevation out of noise would
 * be far worse than missing a few metres of a genuine climb.
 */
export function elevationGainM(points: TrackPoint[], thresholdM = 4, window = 5): number {
  let total = 0;
  for (const segment of segments(points)) {
    const altitudes = segment.map((p) => p.alt).filter((a): a is number => a !== null);
    if (altitudes.length < 2) continue;

    const smoothed = altitudes.map((_, i) => {
      const from = Math.max(0, i - Math.floor(window / 2));
      const to = Math.min(altitudes.length, from + window);
      let sum = 0;
      for (let j = from; j < to; j++) sum += altitudes[j];
      return sum / (to - from);
    });

    let reference = smoothed[0];
    for (const altitude of smoothed) {
      const delta = altitude - reference;
      if (delta >= thresholdM) {
        total += delta;
        reference = altitude;
      } else if (delta <= -thresholdM) {
        reference = altitude;
      }
    }
  }
  return total;
}

/** Duration of the fastest full kilometre in seconds, ignoring the partial chunk. */
export function fastestKmS(points: TrackPoint[]): number | null {
  const full = splits(points).filter((s) => !s.partial);
  if (!full.length) return null;
  return Math.min(...full.map((s) => s.durationS));
}

/** Bounding box, used to frame the map around a finished track. */
export function bounds(points: TrackPoint[]) {
  if (!points.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * A camera framing the whole track, worked out here rather than asked of the
 * map.
 *
 * A map told only to fit coordinates once it is ready has to be ready, laid
 * out and listening at the right moment; miss any of those and it stays on
 * its default camera, which is a view of the planet centred on open water —
 * a rectangle of blue. Handing it a region up front means it opens on the run
 * whatever happens afterwards, and any later fit only refines it.
 *
 * The margin keeps the track off the edges. The floor stops a run around the
 * block from being magnified until the street names crowd it out.
 */
export function regionAround(points: TrackPoint[], margin = 1.35, lift = 0): MapRegion | null {
  const box = bounds(points);
  if (!box) return null;
  const MIN_DELTA = 0.0035;
  const latitudeDelta = Math.max((box.maxLat - box.minLat) * margin, MIN_DELTA);
  return {
    // Lifting the track means lowering the camera: the centre drops south by a
    // share of the frame's height, and the run rises by as much. The share
    // card uses it to keep the route clear of the text laid over the bottom.
    latitude: (box.minLat + box.maxLat) / 2 - latitudeDelta * lift,
    longitude: (box.minLng + box.maxLng) / 2,
    latitudeDelta,
    longitudeDelta: Math.max((box.maxLng - box.minLng) * margin, MIN_DELTA),
  };
}
