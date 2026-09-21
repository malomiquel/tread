import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoPoints } from "./demoTrack.ts";
import { elevationGainM, segments, splits, totalDistanceM } from "./geo.ts";

const points = buildDemoPoints(5000, Date.UTC(2026, 8, 21, 8, 0));

test("demo: covers roughly the distance asked for", () => {
  const distance = totalDistanceM(points);
  assert.ok(Math.abs(distance - 5000) < 250, `got ${Math.round(distance)} m`);
});

test("demo: the pause splits the track in two", () => {
  assert.equal(segments(points).length, 2);
});

test("demo: the loop comes back near where it started", () => {
  const first = points[0];
  const last = points[points.length - 1];
  // Five kilometres on a 4.6 km loop finishes a little past the start.
  assert.ok(Math.abs(last.lat - first.lat) < 0.02 && Math.abs(last.lng - first.lng) < 0.02);
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
