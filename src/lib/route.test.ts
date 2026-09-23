import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoRouteName, drawnLine, emptyRoute, isLoop, lastWaypoint, legUrl, parseRoute, readLeg,
  legsAround, movedWaypoint, routeDistanceM, routeFromLine, snapped, thumbnail, withoutLast,
  withoutWaypoint, withWaypoint, type RoutePoint,
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

test("a thumbnail fits the shape in its box, and keeps its shape", () => {
  // A route twice as wide as it is tall, on the ground.
  const line = [at(48.450, 1.490), at(48.450, 1.494), at(48.4515, 1.494), at(48.450, 1.490)];
  const drawn = thumbnail(line, 48, 4);

  for (const point of drawn) {
    assert.ok(point.x >= 4 - 1e-9 && point.x <= 44 + 1e-9, `x ${point.x}`);
    assert.ok(point.y >= 4 - 1e-9 && point.y <= 44 + 1e-9, `y ${point.y}`);
  }

  // Wider than it is tall on the ground, and wider than it is tall in the
  // box: a shape stretched to fill the square would have come out even.
  const width = Math.max(...drawn.map((p) => p.x)) - Math.min(...drawn.map((p) => p.x));
  const height = Math.max(...drawn.map((p) => p.y)) - Math.min(...drawn.map((p) => p.y));
  assert.ok(width > height * 1.3, `${width} × ${height}`);
  // And it touches the side it is bound by.
  assert.ok(Math.abs(width - 40) < 1e-6, `width ${width}`);
});

test("north is up in a thumbnail too", () => {
  const line = [at(48.450, 1.490), at(48.452, 1.490)];
  const [south, north] = thumbnail(line, 48);
  assert.ok(north.y < south.y, `${north.y} < ${south.y}`);
});

test("a shape with nothing to draw draws nothing", () => {
  assert.deepEqual(thumbnail([], 48), []);
  assert.deepEqual(thumbnail([at(48.45, 1.49)], 48), []);
  // Two points at the same place have no extent, and must not divide by zero.
  const flat = thumbnail([at(48.45, 1.49), at(48.45, 1.49)], 48);
  assert.equal(flat.length, 2);
  assert.ok(Number.isFinite(flat[0].x) && Number.isFinite(flat[0].y));
});

/** Three taps: a start, a corner, an end, each leg following a path. */
function bentTwice() {
  const a = at(48.450, 1.490);
  const b = at(48.452, 1.492);
  const c = at(48.454, 1.490);
  return withWaypoint(
    withWaypoint(withWaypoint(emptyRoute(), a), b, [a, at(48.451, 1.4915), b]),
    c,
    [b, at(48.453, 1.4915), c],
  );
}

test("moving a waypoint straightens only the legs that touch it", () => {
  const route = bentTwice();
  const moved = movedWaypoint(route, 1, at(48.4525, 1.4950));

  assert.deepEqual(moved.waypoints[1], at(48.4525, 1.4950));
  // Both legs met at that corner, so both are guesses again.
  assert.equal(moved.legs[0].length, 2);
  assert.equal(moved.legs[1].length, 2);
  assert.deepEqual(moved.legs[0], [route.waypoints[0], at(48.4525, 1.4950)]);
  assert.deepEqual(moved.legs[1], [at(48.4525, 1.4950), route.waypoints[2]]);
});

test("moving an end straightens the one leg that reaches it", () => {
  const route = bentTwice();
  const moved = movedWaypoint(route, 2, at(48.456, 1.488));
  // The first leg never touched it and keeps the path it had.
  assert.equal(moved.legs[0].length, 3);
  assert.equal(moved.legs[1].length, 2);
  assert.equal(movedWaypoint(route, 9, at(1, 1)), route);
});

test("which legs have to be asked about again", () => {
  const route = bentTwice();
  assert.deepEqual(legsAround(route, 0), [0]);
  assert.deepEqual(legsAround(route, 1), [0, 1]);
  assert.deepEqual(legsAround(route, 2), [1]);
});

test("removing a corner joins what it separated", () => {
  const route = bentTwice();
  const without = withoutWaypoint(route, 1);

  assert.equal(without.waypoints.length, 2);
  assert.equal(without.legs.length, 1);
  assert.deepEqual(without.legs[0], [route.waypoints[0], route.waypoints[2]]);
});

test("removing an end takes its leg with it", () => {
  const route = bentTwice();
  const first = withoutWaypoint(route, 0);
  assert.equal(first.waypoints.length, 2);
  assert.equal(first.legs.length, 1);
  assert.deepEqual(first.legs[0], route.legs[1]);

  const last = withoutWaypoint(route, 2);
  assert.equal(last.legs.length, 1);
  assert.deepEqual(last.legs[0], route.legs[0]);
});

test("removing the only point leaves nothing, and a point that is not there changes nothing", () => {
  const one = withWaypoint(emptyRoute(), at(48.45, 1.49));
  assert.deepEqual(withoutWaypoint(one, 0), emptyRoute());
  const route = bentTwice();
  assert.equal(withoutWaypoint(route, 7), route);
  assert.equal(withoutWaypoint(route, -1), route);
});

test("a route stays consistent however it is cut about", () => {
  // One leg fewer than waypoints, always: that invariant is what lets undo
  // take back a decision rather than a few hundred points of pavement.
  const shapes = [
    bentTwice(),
    withoutWaypoint(bentTwice(), 1),
    movedWaypoint(bentTwice(), 0, at(48.449, 1.489)),
    withoutWaypoint(withoutWaypoint(bentTwice(), 0), 0),
  ];
  for (const route of shapes) {
    assert.equal(route.legs.length, Math.max(0, route.waypoints.length - 1));
  }
});

/** A line of `count` points, twenty metres apart, running north. */
function imported(count: number): RoutePoint[] {
  return Array.from({ length: count }, (_, i) => at(48.45 + i * 0.00018, 1.49));
}

test("an imported line keeps every metre of itself", () => {
  const line = imported(400);
  const route = routeFromLine(line);

  // The legs, joined end to end, are the file back again.
  const joined = route.legs.reduce<RoutePoint[]>(
    (all, leg, index) => all.concat(index === 0 ? leg : leg.slice(1)), [],
  );
  assert.deepEqual(joined, line);
});

test("an imported route gets handles, not too many", () => {
  const route = routeFromLine(imported(400));
  assert.ok(route.waypoints.length >= 3, `${route.waypoints.length} handles`);
  assert.ok(route.waypoints.length <= 12, `${route.waypoints.length} handles`);
  assert.equal(route.legs.length, route.waypoints.length - 1);
  // Every handle sits on the line, since that is what it is a handle for.
  for (const waypoint of route.waypoints) {
    assert.ok(imported(400).some((point) => point.lat === waypoint.lat), "a handle off the line");
  }
});

test("the handles start and end where the file does", () => {
  const line = imported(400);
  const route = routeFromLine(line);
  assert.deepEqual(route.waypoints[0], line[0]);
  assert.deepEqual(route.waypoints.at(-1), line.at(-1));
});

test("a short file gets the two handles it deserves", () => {
  const route = routeFromLine(imported(6));
  assert.equal(route.waypoints.length, 2);
  assert.equal(route.legs.length, 1);
  assert.equal(route.legs[0].length, 6);
});

test("a file with nothing in it is no route", () => {
  assert.deepEqual(routeFromLine([]), emptyRoute());
  assert.deepEqual(routeFromLine([at(48.45, 1.49)]), { waypoints: [at(48.45, 1.49)], legs: [] });
});

test("a run counts for its route once it covers nine tenths of it", async () => {
  const { coversRoute } = await import("./route.ts");
  assert.equal(coversRoute(4600, 5000), true);
  assert.equal(coversRoute(4400, 5000), false);
  assert.equal(coversRoute(8000, 5000), true);
  assert.equal(coversRoute(100, 0), false);
});
