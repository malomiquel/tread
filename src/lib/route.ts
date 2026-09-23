// Extension spelled out, as in archive.ts: this module is loaded by a plain
// node test, and node resolves a relative import literally.
import { distanceM } from "./geo.ts";
import { getLanguage, intlLocale } from "./i18n.ts";
import { services } from "./services.ts";

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

/** A route on disk, with what it is called and what it looks like. */
export interface StoredRoute extends Route {
  id: number;
  name: string;
  createdAt: number;
  distanceM: number;
  /** "Chartres, France", or null when the lookup could not answer. */
  place: string | null;
  /**
   * A picture of the route on its map, taken once when it was drawn.
   *
   * Once, and kept: a live map on every row of a list would want tiles, a
   * network and a view of its own for each. This is one file, written when
   * there is already a map on screen with the route on it — which is exactly
   * the moment somebody finishes drawing one.
   */
  preview: string | null;
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

/**
 * Move one waypoint, and put the legs touching it back to straight lines.
 *
 * Straight because they are wrong now and honestly wrong: the paths they held
 * went somewhere this point no longer is. The screen asks the router about
 * them again, and until it answers the drawing says plainly that those two
 * stretches are guesses.
 *
 * Which legs touch it is the whole of the arithmetic: the one arriving and
 * the one leaving, either of which may not exist at the ends of the route.
 */
export function movedWaypoint(route: Route, index: number, to: RoutePoint): Route {
  if (index < 0 || index >= route.waypoints.length) return route;
  const waypoints = route.waypoints.map((point, at) => (at === index ? to : point));

  return {
    waypoints,
    legs: route.legs.map((leg, at) => {
      if (at === index - 1) return [waypoints[at], to];
      if (at === index) return [to, waypoints[at + 1]];
      return leg;
    }),
  };
}

/**
 * Take one waypoint out, wherever it sits.
 *
 * The two legs that met there become one, which is a straight line until the
 * router says otherwise — the same bargain as moving a point. Removing an end
 * is simpler: the leg that reached it goes with it.
 */
export function withoutWaypoint(route: Route, index: number): Route {
  if (index < 0 || index >= route.waypoints.length) return route;
  if (route.waypoints.length <= 1) return emptyRoute();

  const waypoints = route.waypoints.filter((_, at) => at !== index);
  if (index === 0) return { waypoints, legs: route.legs.slice(1) };
  if (index === route.waypoints.length - 1) return { waypoints, legs: route.legs.slice(0, -1) };

  const legs = [...route.legs];
  // The leg arriving and the leg leaving become the one that joins their two
  // far ends.
  legs.splice(index - 1, 2, [route.waypoints[index - 1], route.waypoints[index + 1]]);
  return { waypoints, legs };
}

/** Which legs a waypoint touches, and so which have to be asked about again. */
export function legsAround(route: Route, index: number): number[] {
  return [index - 1, index].filter((at) => at >= 0 && at < route.legs.length);
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
 * The routing service: OSRM's walking profile — by default on the instance
 * the OpenStreetMap project runs, or on whichever server the build names
 * (see services.ts).
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

export function legUrl(from: RoutePoint, to: RoutePoint): string {
  const place = (point: RoutePoint) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
  return `${services().routingUrl}/${place(from)};${place(to)}?overview=full&geometries=geojson`;
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

/**
 * A camera framing a whole route, for a map opening on one.
 *
 * The same job `regionAround` does for a run, and deliberately not the same
 * function: that one takes the points of a track and this one takes a route,
 * and giving either of them the other's shape would only make both harder to
 * read.
 */
export function regionAroundRoute(route: Route, margin = 1.4) {
  const line = drawnLine(route);
  if (line.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const point of line) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  // A floor, so a route around one block does not open magnified to the point
  // where the street names crowd it out.
  const FLOOR = 0.004;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * margin, FLOOR),
    longitudeDelta: Math.max((maxLng - minLng) * margin, FLOOR),
  };
}

/**
 * The shape of a route, fitted into a small square.
 *
 * A thumbnail on a list row, drawn as a line rather than as a map. A map
 * needs tiles, a network and a view of its own per row; the shape needs none
 * of that, and the shape is what anybody recognises — nobody identifies their
 * saturday loop by the street names on it.
 *
 * The aspect is kept, so an out-and-back along a canal stays flat and a loop
 * stays round. Stretching each to fill the box would make every route look
 * like every other one, which is the one thing a thumbnail must not do.
 */
export function thumbnail(line: RoutePoint[], size: number, padding = 4): { x: number; y: number }[] {
  if (line.length < 2) return [];

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const point of line) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  // A degree of longitude is shorter than a degree of latitude everywhere but
  // the equator, so a square in degrees is a rectangle on the ground.
  const squash = Math.max(0.01, Math.cos(((minLat + maxLat) / 2 * Math.PI) / 180));
  const wide = Math.max((maxLng - minLng) * squash, 1e-9);
  const tall = Math.max(maxLat - minLat, 1e-9);

  const box = size - padding * 2;
  const scale = Math.min(box / wide, box / tall);
  // Centred in whichever direction has room left over.
  const left = padding + (box - wide * scale) / 2;
  const top = padding + (box - tall * scale) / 2;

  return line.map((point) => ({
    x: left + (point.lng - minLng) * squash * scale,
    // Latitude grows northwards and a screen grows downwards.
    y: top + (maxLat - point.lat) * scale,
  }));
}

/**
 * How far apart the waypoints of an imported route are put, at the closest.
 *
 * Five hundred metres. Closer than that and a ten-kilometre file arrives as
 * twenty markers nobody can drag apart; further and a route has too few
 * handles to be worth editing at all.
 */
const IMPORT_SPACING_M = 500;

/** At most this many handles, however long the file is. */
const IMPORT_WAYPOINTS = 12;

/**
 * Turn a line from a file into a route somebody can edit.
 *
 * A file has no taps in it — it is a few hundred points and no decisions —
 * so the decisions are invented: handles are placed along the line at even
 * intervals, and the real geometry between them becomes the legs. That gives
 * an imported route the same shape as a drawn one, which is what lets it be
 * dragged about, cut and extended like any other.
 *
 * The line itself is never simplified. What was imported is what will be
 * run; the handles are only somewhere to take hold of it.
 */
export function routeFromLine(
  line: RoutePoint[],
  { spacingM = IMPORT_SPACING_M, most = IMPORT_WAYPOINTS } = {},
): Route {
  if (line.length < 2) return line.length === 1 ? { waypoints: [line[0]], legs: [] } : emptyRoute();

  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += distanceM(line[i - 1], line[i]);
  // Whichever is the coarser: the floor above, or the spacing that keeps the
  // count down on a long route.
  const spacing = Math.max(spacingM, total / Math.max(1, most - 1));

  const cuts = [0];
  let since = 0;
  for (let i = 1; i < line.length - 1; i += 1) {
    since += distanceM(line[i - 1], line[i]);
    if (since < spacing) continue;
    cuts.push(i);
    since = 0;
  }
  cuts.push(line.length - 1);

  return {
    waypoints: cuts.map((at) => line[at]),
    legs: cuts.slice(1).map((to, index) => line.slice(cuts[index], to + 1)),
  };
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
  const day = new Date(at).toLocaleDateString(intlLocale(), { day: "numeric", month: "long" });
  return getLanguage() === "fr" ? `Parcours du ${day}` : `Route of ${day}`;
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
