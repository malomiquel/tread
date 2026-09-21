// Explicit extensions: this module is exercised by tests running under plain
// Node, whose ESM resolver does not add them. Metro accepts either form.
import { DEMO_ROUTE } from "./demoRoute.ts";
import { distanceM, type TrackPoint } from "./geo.ts";

/**
 * Builds a believable run along a real route, so the screens can be judged
 * without going outside first.
 *
 * Everything a real track has is reproduced: pace drifting the way legs
 * actually tire, a hill, GPS wander, and a pause at a crossing. A tidy
 * synthetic line would flatter the app and teach us nothing about how it
 * copes with real data.
 */

const METRES_PER_DEG_LAT = 111_320;

export interface DemoOptions {
  /** Roughly how far the run should cover, in metres. */
  targetM?: number;
  /** When the run took place. Defaults to two hours ago. */
  startedAt?: number;
}

interface Waypoint {
  lat: number;
  lng: number;
  /** Distance from the start of the route, in metres. */
  along: number;
}

/** The route with cumulative distances, so a position can be found by metres run. */
const WAYPOINTS: Waypoint[] = (() => {
  let along = 0;
  return DEMO_ROUTE.map(([lat, lng], i) => {
    if (i > 0) {
      const [prevLat, prevLng] = DEMO_ROUTE[i - 1];
      along += distanceM({ lat: prevLat, lng: prevLng }, { lat, lng });
    }
    return { lat, lng, along };
  });
})();

const ROUTE_LENGTH_M = WAYPOINTS[WAYPOINTS.length - 1].along;

/**
 * Position after running a given distance along the route, interpolated
 * between the two surrounding waypoints.
 *
 * OSRM places a vertex wherever the street geometry bends, so the spacing is
 * irregular: anything from a metre to a hundred. Snapping to the nearest
 * vertex would make the runner stand still then leap, and every leap would add
 * distance never actually run.
 */
function positionAt(metres: number): { lat: number; lng: number } {
  const wrapped = metres % ROUTE_LENGTH_M;
  let high = WAYPOINTS.length - 1;
  let low = 0;
  while (low < high - 1) {
    const middle = (low + high) >> 1;
    if (WAYPOINTS[middle].along <= wrapped) low = middle;
    else high = middle;
  }
  const from = WAYPOINTS[low];
  const to = WAYPOINTS[high];
  const span = to.along - from.along;
  const ratio = span > 0 ? (wrapped - from.along) / span : 0;
  return {
    lat: from.lat + (to.lat - from.lat) * ratio,
    lng: from.lng + (to.lng - from.lng) * ratio,
  };
}

/** Deterministic pseudo-random noise, so two demo runs are never identical. */
function noise(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648 - 0.5;
  };
}

export function buildDemoPoints(targetM: number, startedAt: number): TrackPoint[] {
  const jitter = noise(Math.floor(startedAt / 1000));
  const points: TrackPoint[] = [];

  let covered = 0;
  let elapsedS = 0;
  let segment = 0;
  let pauseTaken = false;

  // GPS error wanders slowly, it does not jump about from one second to the
  // next. Drawing an independent offset per fix inflated the measured distance
  // by nearly half, because every step then zig-zagged. A random walk pulled
  // back towards zero keeps a realistic few metres of wander without adding
  // any length to the track.
  let driftX = 0;
  let driftY = 0;

  while (covered < targetM) {
    // Pace drifts from about 5'00 to 5'40 per kilometre as the legs tire,
    // with a small ripple so no two kilometres are identical.
    const fatigue = covered / targetM;
    const speed = 3.35 - 0.35 * fatigue + 0.12 * Math.sin(covered / 180);

    const { lat, lng } = positionAt(covered);
    const metresPerDegLng = METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

    // The climb up the Montagne Sainte-Geneviève and back down, plus the metre
    // or so of wobble any GPS shows.
    const altitude = 38 + 24 * Math.sin((covered / targetM) * Math.PI * 2) + jitter() * 2.5;

    driftX = driftX * 0.99 + jitter() * 1.2;
    driftY = driftY * 0.99 + jitter() * 1.2;

    points.push({
      ts: startedAt + Math.round(elapsedS * 1000),
      lat: lat + driftY / METRES_PER_DEG_LAT,
      lng: lng + driftX / metresPerDegLng,
      alt: altitude,
      accuracy: 4 + Math.abs(jitter()) * 6,
      speed,
      segment,
    });

    // A crossing just past halfway: a new segment, and ninety seconds gone
    // from the clock without a metre covered.
    if (!pauseTaken && covered > targetM * 0.52) {
      pauseTaken = true;
      segment += 1;
      elapsedS += 90;
    }

    covered += speed;
    elapsedS += 1;
  }
  return points;
}
