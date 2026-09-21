// Extension explicite : ce module est exerce par des tests sous Node seul.
import type { TrackPoint } from "./geo.ts";

/**
 * Builds a believable run and stores it, so the screens can be judged without
 * going outside first.
 *
 * Everything a real track has is reproduced: a closed loop rather than a
 * straight line, pace drifting the way legs actually tire, a hill, GPS jitter,
 * and a pause at a crossing. A tidy synthetic line would flatter the app and
 * teach us nothing about how it copes with real data.
 */

const METRES_PER_DEG_LAT = 111_320;

/** Centre of the loop: a stretch of Paris with enough room for five kilometres. */
const CENTRE = { lat: 48.86, lng: 2.34 };

interface Offset {
  x: number;
  y: number;
}

const toLatLng = ({ x, y }: Offset) => ({
  lat: CENTRE.lat + y / METRES_PER_DEG_LAT,
  lng: CENTRE.lng + x / (METRES_PER_DEG_LAT * Math.cos((CENTRE.lat * Math.PI) / 180)),
});

/**
 * A rounded rectangle, which looks like running round a park or a block.
 * A plain circle of the same length reads as obviously machine made.
 */
function loopPath(halfWidth: number, halfHeight: number, radius: number, stepM = 5): Offset[] {
  const path: Offset[] = [];
  const straight = (from: Offset, to: Offset) => {
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.round(span / stepM));
    for (let i = 0; i < steps; i++) {
      path.push({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    }
  };
  const arc = (cx: number, cy: number, from: number, to: number) => {
    const steps = Math.max(1, Math.round((Math.abs(to - from) * radius) / stepM));
    for (let i = 0; i < steps; i++) {
      const angle = from + ((to - from) * i) / steps;
      path.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
  };

  const w = halfWidth - radius;
  const h = halfHeight - radius;
  straight({ x: -w, y: -halfHeight }, { x: w, y: -halfHeight });
  arc(w, -h, -Math.PI / 2, 0);
  straight({ x: halfWidth, y: -h }, { x: halfWidth, y: h });
  arc(w, h, 0, Math.PI / 2);
  straight({ x: w, y: halfHeight }, { x: -w, y: halfHeight });
  arc(-w, h, Math.PI / 2, Math.PI);
  straight({ x: -halfWidth, y: h }, { x: -halfWidth, y: -h });
  arc(-w, -h, Math.PI, (3 * Math.PI) / 2);
  return path;
}

/** Deterministic pseudo-random noise, so two demo runs are never identical. */
function noise(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648 - 0.5;
  };
}

export interface DemoOptions {
  /** Roughly how far the run should cover, in metres. */
  targetM?: number;
  /** When the run took place. Defaults to two hours ago. */
  startedAt?: number;
}

export function buildDemoPoints(targetM: number, startedAt: number): TrackPoint[] {
  const path = loopPath(800, 450, 200);
  const jitter = noise(Math.floor(startedAt / 1000));

  // Step length between consecutive path nodes, used to walk the loop.
  const nodeSpacing = 5;
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

    // Interpolation between two nodes rather than snapping to the nearest.
    // Snapping made the runner stand still for a third of the steps then jump
    // five metres, and every one of those jumps added length that was never
    // actually run.
    const exact = covered / nodeSpacing;
    const from = path[Math.floor(exact) % path.length];
    const to = path[(Math.floor(exact) + 1) % path.length];
    const ratio = exact - Math.floor(exact);
    const { lat, lng } = toLatLng({
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    });

    // One hill per lap, plus the metre or so of wobble any GPS shows.
    const altitude = 48 + 22 * Math.sin((covered / targetM) * Math.PI * 2) + jitter() * 2.5;

    driftX = driftX * 0.99 + jitter() * 1.2;
    driftY = driftY * 0.99 + jitter() * 1.2;

    points.push({
      ts: startedAt + Math.round(elapsedS * 1000),
      lat: lat + driftY / METRES_PER_DEG_LAT,
      lng: lng + driftX / (METRES_PER_DEG_LAT * Math.cos((CENTRE.lat * Math.PI) / 180)),
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
