import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoRouteName, drawnLine, emptyRoute, isLoop, lastWaypoint, legUrl, parseRoute, readLeg,
  routeDistanceM, snapped, withoutLast, withWaypoint, type RoutePoint,
} from "./route.ts";

const at = (lat: number, lng: number): RoutePoint => ({ lat, lng });

/** Two taps, joined by a path that goes round three sides of a square. */
function bent() {
  const start = at(48.45, 1.49);
  const end = at(48.452, 1.492);
  const leg = [start, at(48.451, 1.49), at(48.451, 1.492), end];
  return withWaypoint(withWaypoint(emptyRoute(), start), end, leg);
}

test("a route starts empty and takes its first tap whole", () => {
  const one = withWaypoint(emptyRoute(), at(48.45, 1.49));
  assert.equal(one.waypoints.length, 1);
  assert.equal(one.legs.length, 0);
  assert.equal(routeDistanceM(one), 0);
  assert.deepEqual(drawnLine(one), [at(48.45, 1.49)]);
});

test("the drawn line follows the legs, not the taps", () => {
  const route = bent();
  const line = drawnLine(route);
  assert.equal(line.length, 4);
  // The corner the router found is on the line; a straight join would miss it.
  assert.ok(line.some((point) => point.lat === 48.451 && point.lng === 1.492));
  // And the distance is measured along it, so it is longer than the crow flies.
  assert.ok(routeDistanceM(route) > 300, `${routeDistanceM(route)} m`);
});

test("a leg the router could not answer is a straight line, not a gap", () => {
  const route = withWaypoint(withWaypoint(emptyRoute(), at(48.45, 1.49)), at(48.46, 1.49));
  assert.equal(route.legs.length, 1);
  assert.deepEqual(drawnLine(route), [at(48.45, 1.49), at(48.46, 1.49)]);
  assert.ok(routeDistanceM(route) > 1000);
});

test("undo takes back the tap and the path that came with it", () => {
  const route = bent();
  const back = withoutLast(route);
  assert.equal(back.waypoints.length, 1);
  assert.equal(back.legs.length, 0);
  assert.equal(routeDistanceM(back), 0);

  // Undoing the last one left empties the route rather than leaving a point
  // nobody can join anything to.
  assert.deepEqual(withoutLast(back), emptyRoute());
  assert.deepEqual(withoutLast(emptyRoute()), emptyRoute());
});

test("the next leg starts where the last one ended", () => {
  assert.equal(lastWaypoint(emptyRoute()), null);
  assert.deepEqual(lastWaypoint(bent()), at(48.452, 1.492));
});

test("a loop is a route that comes back, not one that crosses itself", () => {
  const start = at(48.45, 1.49);
  const out = withWaypoint(withWaypoint(emptyRoute(), start), at(48.46, 1.49));
  const there = withWaypoint(out, at(48.46, 1.50));
  assert.equal(isLoop(there), false);

  // Back to within a few metres of the start.
  const home = withWaypoint(there, at(48.4500, 1.49002));
  assert.equal(isLoop(home), true);

  // Two points are an out and back, never a loop.
  assert.equal(isLoop(withWaypoint(withWaypoint(emptyRoute(), start), start)), false);
});

test("the routing service is asked in its own order, longitude first", () => {
  const url = legUrl(at(48.447, 1.489), at(48.452, 1.495));
  assert.match(url, /\/foot\/1\.489000,48\.447000;1\.495000,48\.452000\?/);
  assert.match(url, /geometries=geojson/);
});

test("a routing answer is read back the right way round", () => {
  const answer = {
    code: "Ok",
    routes: [{ geometry: { coordinates: [[1.489076, 48.447044], [1.489234, 48.446924]] } }],
  };
  assert.deepEqual(readLeg(answer), [
    { lat: 48.447044, lng: 1.489076 },
    { lat: 48.446924, lng: 1.489234 },
  ]);
});

test("a routing answer that says no is an empty path, never an exception", () => {
  assert.deepEqual(readLeg({ code: "NoRoute", routes: [] }), []);
  assert.deepEqual(readLeg({ code: "Ok" }), []);
  assert.deepEqual(readLeg(null), []);
  assert.deepEqual(readLeg("<html>502</html>"), []);
  assert.deepEqual(readLeg({ code: "Ok", routes: [{ geometry: { coordinates: [[1], "nope"] } }] }), []);
});

test("a stored route comes back as it went in", () => {
  const route = bent();
  const back = parseRoute(JSON.stringify(route.waypoints), JSON.stringify(route.legs));
  assert.deepEqual(back, route);
});

test("a half-written route comes back as much of itself as is readable", () => {
  assert.deepEqual(parseRoute(null, null), emptyRoute());
  assert.deepEqual(parseRoute("{", "["), emptyRoute());
  // Points that are not points are dropped, and the legs follow the count.
  const mangled = parseRoute('[{"lat":48.45,"lng":1.49},{"lat":"nord"},{"lat":48.46,"lng":1.49}]', "[]");
  assert.equal(mangled.waypoints.length, 2);
  assert.equal(mangled.legs.length, 0);
});

test("a route nobody named is named after the day", () => {
  assert.equal(autoRouteName(new Date(2026, 8, 24).getTime()), "Parcours du 24 septembre");
});

test("a leg pulls its two waypoints onto the path it found", () => {
  // The router hooks a tap onto the nearest way, a few metres off.
  const tapped = withWaypoint(withWaypoint(emptyRoute(), at(48.4470, 1.4890)), at(48.4520, 1.4950));
  const found = [at(48.447044, 1.489076), at(48.4495, 1.4920), at(48.451939, 1.495092)];

  const route = snapped(tapped, 0, found);
  assert.deepEqual(route.waypoints, [found[0], found[2]]);
  assert.deepEqual(route.legs[0], found);
  // Which is the point of it: the markers are now on the line.
  assert.deepEqual(drawnLine(route)[0], route.waypoints[0]);
  assert.deepEqual(drawnLine(route).at(-1), route.waypoints[1]);
});

test("snapping one leg leaves every other leg where it was", () => {
  const first = [at(48.4470, 1.4890), at(48.4495, 1.4920)];
  const middle = withWaypoint(
    withWaypoint(emptyRoute(), at(48.4470, 1.4890)),
    at(48.4495, 1.4920),
    first,
  );
  const three = withWaypoint(middle, at(48.4520, 1.4950));
  const second = [at(48.4495, 1.4921), at(48.4510, 1.4940), at(48.451939, 1.495092)];

  const route = snapped(three, 1, second);
  assert.deepEqual(route.legs[0], first);
  assert.deepEqual(route.legs[1], second);
  // The shared waypoint follows the leg that just answered about it.
  assert.deepEqual(route.waypoints[1], second[0]);
  assert.equal(route.waypoints.length, 3);
});

test("an answer about a leg that is not there changes nothing", () => {
  const route = bent();
  assert.equal(snapped(route, 5, [at(1, 1), at(2, 2)]), route);
  assert.equal(snapped(route, -1, [at(1, 1), at(2, 2)]), route);
  assert.equal(snapped(route, 0, [at(1, 1)]), route);
});
