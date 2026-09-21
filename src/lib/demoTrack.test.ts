import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoPoints } from "./demoTrack.ts";
import { DEMO_ROUTE } from "./demoRoute.ts";
import { distanceM, elevationGainM, segments, splits, totalDistanceM } from "./geo.ts";

const points = buildDemoPoints(5000, Date.UTC(2026, 8, 21, 8, 0));

test("demo: covers roughly the distance asked for", () => {
  const distance = totalDistanceM(points);
  assert.ok(Math.abs(distance - 5000) < 250, `got ${Math.round(distance)} m`);
});

test("demo: the pause splits the track in two", () => {
  assert.equal(segments(points).length, 2);
});

/**
 * Perpendicular distance from a point to a segment, in metres, using a flat
 * approximation. Over a few hundred metres in Paris the error is negligible,
 * and measuring to the nearest vertex instead would be wrong: OSRM leaves
 * vertices up to two hundred metres apart down a straight street, so a fix
 * interpolated midway is legitimately far from both ends.
 */
function distanceToSegmentM(
  p: { lat: number; lng: number },
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const scale = Math.cos((p.lat * Math.PI) / 180);
  const px = (p.lng - a[1]) * scale;
  const py = p.lat - a[0];
  const bx = (b[1] - a[1]) * scale;
  const by = b[0] - a[0];
  const lengthSq = bx * bx + by * by;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / lengthSq)) : 0;
  const dx = px - bx * t;
  const dy = py - by * t;
  return Math.hypot(dx, dy) * 111_320;
}

test("demo: the track stays on the real route, within GPS wander", () => {
  // Every fix must sit within a few metres of the route itself. If the walk
  // drifted off it, the map would betray it at once.
  const worst = Math.max(...points.map((p) => {
    let best = Infinity;
    for (let i = 1; i < DEMO_ROUTE.length; i++) {
      best = Math.min(best, distanceToSegmentM(p, DEMO_ROUTE[i - 1], DEMO_ROUTE[i]));
    }
    return best;
  }));
  assert.ok(worst < 15, `a fix sat ${Math.round(worst)} m off the route`);
});

test("demo: the route it follows is a real closed loop", () => {
  const [firstLat, firstLng] = DEMO_ROUTE[0];
  const [lastLat, lastLng] = DEMO_ROUTE[DEMO_ROUTE.length - 1];
  const gap = distanceM({ lat: firstLat, lng: firstLng }, { lat: lastLat, lng: lastLng });
  assert.ok(gap < 120, `the loop fails to close by ${Math.round(gap)} m`);
});

test("demo: pace is plausible and drifts as the legs tire", () => {
  const full = splits(points).filter((s) => !s.partial);
  assert.ok(full.length >= 4, `expected at least 4 full kilometres, got ${full.length}`);
  for (const split of full) {
    assert.ok(split.durationS > 260 && split.durationS < 400, `a kilometre in ${split.durationS}s`);
  }
  assert.ok(full[full.length - 1].durationS > full[0].durationS, "the last kilometre should be the slower");
});

test("demo: the hill produces a believable climb", () => {
  const gain = elevationGainM(points);
  assert.ok(gain > 15 && gain < 120, `got ${Math.round(gain)} m`);
});

test("demo: every fix carries an accuracy the filter would accept", () => {
  assert.ok(points.every((p) => p.accuracy !== null && p.accuracy < 30));
});
