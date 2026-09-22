// Extension spelled out, as in archive.ts: this module is loaded by a plain
// node test, and node resolves a relative import literally.
import { distanceM } from "./geo.ts";

/**
 * Drawing a route before running it.
 *
 * A route is a plan, where a run is a record: nothing here has a timestamp,
 * a pace or a heart rate, and nothing here is evidence of anything. It is
 * where you intend to go, drawn on a map with a finger.
 *
 * Two lists, not one. The waypoints are what a finger put down, and they are
 * what an undo takes back; the legs are the paths between them, as the
 * streets actually run. Keeping only the drawn line would make every mistake
 * unpickable — you would have to start again to move one corner.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
}

/** A route as it is being drawn, and as it is stored. */
export interface Route {
  /** What the finger put down, in order. */
  waypoints: RoutePoint[];
  /**
   * The path between each waypoint and the next, so `legs[i]` joins
   * `waypoints[i]` to `waypoints[i + 1]`. One shorter than the waypoints.
   */
  legs: RoutePoint[][];
}

/** A route on disk, with what it is called. */
export interface StoredRoute extends Route {
  id: number;
  name: string;
  createdAt: number;
  distanceM: number;
}

export const emptyRoute = (): Route => ({ waypoints: [], legs: [] });

/** Every drawn point, end to end, for a map to draw in one line. */
export function drawnLine(route: Route): RoutePoint[] {
  if (route.waypoints.length === 0) return [];
  const line: RoutePoint[] = [route.waypoints[0]];
  route.legs.forEach((leg, index) => {
    // The leg already ends on the next waypoint; its first point is where we
    // already are.
    line.push(...leg.slice(1));
    if (leg.length === 0) line.push(route.waypoints[index + 1]);
  });
  return line;
}

/** How far the route runs, measured along what is drawn rather than as the crow flies. */
export function routeDistanceM(route: Route): number {
  const line = drawnLine(route);
  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += distanceM(line[i - 1], line[i]);
  return total;
}

/**
 * Add a waypoint, joined to the one before it by the given path.
 *
 * The path is whatever the router came back with, or empty when it could not
 * answer — in which case the two points are joined by a straight line, which
 * is wrong about the streets and right about the intention. A route drawn on
 * a train with no signal is still a route.
 */
export function withWaypoint(route: Route, point: RoutePoint, leg: RoutePoint[] = []): Route {
  if (route.waypoints.length === 0) return { waypoints: [point], legs: [] };
  return {
    waypoints: [...route.waypoints, point],
    legs: [...route.legs, leg.length > 1 ? leg : [route.waypoints[route.waypoints.length - 1], point]],
  };
}

/**
 * Put a leg's path in place, and move its two waypoints onto it.
 *
 * The router does not route from where a finger landed: it hooks the tap onto
 * the nearest way it can walk, which is a few metres off — seven here, ten
 * there. Left where they were tapped, the markers float beside the line they
 * are supposed to be on, and at close zoom that reads as a drawing that has
 * come apart.
 *
 * Moving them is also the truer answer. A waypoint is not a place somebody
 * aimed at, it is a place the route passes through, and after this it says
 * so. Both ends move, because the same tap is the end of one leg and the
 * start of the next, and the router hooks it to the same spot from either
 * side.
 */
export function snapped(route: Route, index: number, leg: RoutePoint[]): Route {
  if (index < 0 || index >= route.legs.length || leg.length < 2) return route;
  const waypoints = [...route.waypoints];
  waypoints[index] = leg[0];
  waypoints[index + 1] = leg[leg.length - 1];
  return {
    waypoints,
    legs: route.legs.map((existing, at) => (at === index ? leg : existing)),
  };
}

/** Take back the last waypoint, and the leg that came with it. */
export function withoutLast(route: Route): Route {
  if (route.waypoints.length <= 1) return emptyRoute();
  return { waypoints: route.waypoints.slice(0, -1), legs: route.legs.slice(0, -1) };
}

/** Where the next leg starts from, or null on an empty route. */
export function lastWaypoint(route: Route): RoutePoint | null {
  return route.waypoints[route.waypoints.length - 1] ?? null;
}

/**
 * Whether the route comes back to where it started.
 *
 * Within fifty metres, because a loop is drawn by tapping near the start
 * rather than on it, and nobody finishes a run on the exact paving stone
 * they set off from.
 */
export function isLoop(route: Route): boolean {
  const first = route.waypoints[0];
  const last = lastWaypoint(route);
  if (!first || !last || route.waypoints.length < 3) return false;
  return distanceM(first, last) < 50;
}

/**
 * The routing service: OSRM's walking profile, on the instance the
 * OpenStreetMap project runs.
 *
 * Keyless, like the weather, and for the same reason — an app that ships on
 * other people's phones cannot keep a secret. It is a shared public service
 * under fair use, so it is asked for one leg at a time, only when a finger
 * lands, and never in a loop.
 *
 * Walking rather than cycling or driving: this app records runs, and a
 * runner takes the footpath through the park that no car can use and no
 * cyclist is allowed on.
 */
const OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

export function legUrl(from: RoutePoint, to: RoutePoint): string {
  const place = (point: RoutePoint) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
  return `${OSRM}/${place(from)};${place(to)}?overview=full&geometries=geojson`;
}

/**
 * The drawn path out of a routing answer, or an empty one.
 *
 * Empty rather than thrown: every caller treats "no path" as "a straight
 * line for now", and there is nothing else to be done about a router that
 * cannot find a way between two points in a field.
 */
export function readLeg(payload: unknown): RoutePoint[] {
  const answer = payload as { code?: string; routes?: { geometry?: { coordinates?: unknown } }[] } | null;
  if (!answer || answer.code !== "Ok" || !Array.isArray(answer.routes)) return [];
  const coordinates = answer.routes[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];

  return coordinates
    .filter((pair): pair is [number, number] =>
      Array.isArray(pair) && pair.length >= 2
      && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    // GeoJSON is longitude first, which is the opposite of how everything
    // else in this app, and every map, says a coordinate.
    .map(([lng, lat]) => ({ lat, lng }));
}

/** A route back out of the database, where it is kept as two json columns. */
export function parseRoute(waypoints: string | null, legs: string | null): Route {
  const read = (raw: string | null): unknown => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const points = read(waypoints);
  if (!Array.isArray(points)) return emptyRoute();
  const kept = points.filter((point): point is RoutePoint =>
    !!point && typeof point === "object"
    && Number.isFinite((point as RoutePoint).lat) && Number.isFinite((point as RoutePoint).lng));

  const drawn = read(legs);
  return {
    waypoints: kept,
    legs: Array.isArray(drawn)
      ? drawn.slice(0, Math.max(0, kept.length - 1)).map((leg) =>
          (Array.isArray(leg) ? leg : []) as RoutePoint[])
      : [],
  };
}

/** What a route is called when nobody has named it. */
export function autoRouteName(at: number): string {
  return `Parcours du ${new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

/** Nothing here is worth making anyone wait for. */
const TIMEOUT_MS = 7000;

/**
 * Ask the router for the path between two taps.
 *
 * Answers an empty path rather than throwing, on any failure at all: no
 * network, a service having a bad day, or two points with no way between
 * them. The caller draws a straight line and the route stays drawable, which
 * is the whole bargain — the paths are a convenience, the intention is the
 * route.
 */
export async function fetchLeg(from: RoutePoint, to: RoutePoint): Promise<RoutePoint[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(legUrl(from, to), { signal: controller.signal });
    if (!response.ok) return [];
    return readLeg((await response.json()) as unknown);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
