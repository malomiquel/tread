import { distanceM } from "./geo.ts";
import { defineStrings } from "./i18n.ts";

/**
 * Following a drawn route while running: where along it the runner is, how
 * much is left, which way the next turn goes, and whether they have left it.
 *
 * Everything is measured on the route's own line, flattened around each
 * segment — at the scale of a street the earth is flat, and a projection per
 * segment keeps a route across a whole city just as exact.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type TurnDirection = "left" | "right" | "sharpLeft" | "sharpRight" | "uturn";

export interface Turn {
  /** Distance along the route where it happens, in metres. */
  alongM: number;
  direction: TurnDirection;
}

export interface RouteLine {
  points: LatLng[];
  /** Distance along the route at each point. */
  along: number[];
  totalM: number;
  turns: Turn[];
}

/** Where the runner stands against the route. */
export interface Position {
  alongM: number;
  /** How far from the line, in metres. */
  offM: number;
}

/** Further than this from the line, the runner is off it. GPS alone wanders 10 to 20 m. */
export const OFF_ROUTE_M = 40;

/**
 * How far behind and ahead of the last position the runner is looked for.
 *
 * An out-and-back passes the same street twice, and a figure of eight
 * crosses itself: the nearest point of the whole line would jump between the
 * two. Looking near where they were first keeps them on the leg they are
 * actually running.
 */
const LOOK_BEHIND_M = 150;
const LOOK_AHEAD_M = 600;

/** Flat metres from `origin`: east, north. */
function flat(point: LatLng, origin: LatLng): { x: number; y: number } {
  const x = (point.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * 111_320;
  const y = (point.lat - origin.lat) * 110_540;
  return { x, y };
}

/** Bearing from a to b, in degrees clockwise from north. */
function bearing(a: LatLng, b: LatLng): number {
  const { x, y } = flat(b, a);
  return (Math.atan2(x, y) * 180) / Math.PI;
}

/** The point `metres` along the line, interpolated. */
function pointAt(line: { points: LatLng[]; along: number[] }, metres: number): LatLng {
  const { points, along } = line;
  if (metres <= 0) return points[0];
  const last = points.length - 1;
  if (metres >= along[last]) return points[last];
  let i = 1;
  while (along[i] < metres) i += 1;
  const share = (metres - along[i - 1]) / Math.max(1e-9, along[i] - along[i - 1]);
  return {
    lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * share,
    lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * share,
  };
}

/** How sharp a change of heading is, as a word to say. Null for going straight on. */
function turnOf(change: number): TurnDirection | null {
  const size = Math.abs(change);
  if (size < 40) return null;
  if (size >= 150) return "uturn";
  if (size >= 110) return change > 0 ? "sharpRight" : "sharpLeft";
  return change > 0 ? "right" : "left";
}

/** Measured over this much line either side, so a kink in a drawn street is not a turn. */
const HEADING_OVER_M = 25;

/**
 * The turns of a route: wherever the heading 25 m before a point and 25 m
 * after it differ by 40° or more. A bend spread over several points is found
 * several times over; only the sharpest reading of each is kept.
 */
function turnsOf(line: { points: LatLng[]; along: number[]; totalM: number }): Turn[] {
  const found: (Turn & { size: number })[] = [];
  for (let i = 1; i < line.points.length - 1; i += 1) {
    const at = line.along[i];
    if (at < HEADING_OVER_M || at > line.totalM - HEADING_OVER_M) continue;
    const before = bearing(pointAt(line, at - HEADING_OVER_M), line.points[i]);
    const after = bearing(line.points[i], pointAt(line, at + HEADING_OVER_M));
    const change = ((after - before + 540) % 360) - 180;
    const direction = turnOf(change);
    if (!direction) continue;
    const previous = found[found.length - 1];
    if (previous && at - previous.alongM < HEADING_OVER_M * 1.5) {
      if (Math.abs(change) > previous.size) found[found.length - 1] = { alongM: at, direction, size: Math.abs(change) };
      continue;
    }
    found.push({ alongM: at, direction, size: Math.abs(change) });
  }
  return found.map(({ alongM, direction }) => ({ alongM, direction }));
}

export function routeLine(points: readonly LatLng[]): RouteLine | null {
  if (points.length < 2) return null;
  const along = [0];
  for (let i = 1; i < points.length; i += 1) along.push(along[i - 1] + distanceM(points[i - 1], points[i]));
  const line = { points: [...points], along, totalM: along[along.length - 1] };
  return line.totalM > 0 ? { ...line, turns: turnsOf(line) } : null;
}

/**
 * Where the runner is along the route: the nearest point of the line, looked
 * for first near where they were last, then anywhere.
 */
export function locate(line: RouteLine, point: LatLng, previousAlongM: number | null): Position {
  let best: Position | null = null;
  let bestNear: Position | null = null;
  for (let i = 1; i < line.points.length; i += 1) {
    const a = line.points[i - 1];
    const b = flat(line.points[i], a);
    const p = flat(point, a);
    const length2 = b.x * b.x + b.y * b.y;
    const t = length2 > 0 ? Math.max(0, Math.min(1, (p.x * b.x + p.y * b.y) / length2)) : 0;
    const offM = Math.hypot(p.x - b.x * t, p.y - b.y * t);
    const alongM = line.along[i - 1] + (line.along[i] - line.along[i - 1]) * t;
    const candidate = { alongM, offM };
    if (!best || offM < best.offM) best = candidate;
    const near = previousAlongM !== null
      && alongM >= previousAlongM - LOOK_BEHIND_M && alongM <= previousAlongM + LOOK_AHEAD_M;
    if (near && (!bestNear || offM < bestNear.offM)) bestNear = candidate;
  }
  // The nearby reading wins while it is on the route; once the runner has
  // truly left that stretch, wherever they are nearest is the answer.
  if (bestNear && bestNear.offM <= OFF_ROUTE_M) return bestNear;
  return best ?? { alongM: 0, offM: Infinity };
}

/** The next turn ahead, and how far to it, or null past the last one. */
export function nextTurn(line: RouteLine, alongM: number): { turn: Turn; inM: number } | null {
  const turn = line.turns.find((held) => held.alongM > alongM + 5);
  return turn ? { turn, inM: turn.alongM - alongM } : null;
}

const turnWords = defineStrings({
  fr: {
    left: "à gauche", right: "à droite", sharpLeft: "serré à gauche", sharpRight: "serré à droite",
    uturn: "demi-tour",
  } as Record<TurnDirection, string>,
  en: {
    left: "left", right: "right", sharpLeft: "sharp left", sharpRight: "sharp right", uturn: "U-turn",
  },
});

/** How a turn is said: "à gauche", "demi-tour". */
export const turnName = (direction: TurnDirection): string => turnWords()[direction];
