import assert from "node:assert/strict";
import { test } from "node:test";
import { hasMovedOn, hasStopped, STILL_AFTER_S } from "./autoPause.ts";
import type { TrackPoint } from "./geo.ts";

const T0 = 1_758_520_800_000;
/** About 1.1 m per 0.00001° of latitude. */
const at = (seconds: number, north = 0, over: Partial<TrackPoint> = {}): TrackPoint => ({
  ts: T0 + seconds * 1000, lat: 48.45 + north * 0.00001, lng: 1.49,
  alt: null, accuracy: 5, speed: null, segment: 0, ...over,
});

test("no position for ten seconds is a runner standing still", () => {
  // The GPS reports nothing while nothing moves: the last fix is 12 s old.
  const points = [at(0), at(3, 10), at(6, 20)];
  assert.equal(hasStopped(points, 0, T0, T0 + 18_000), true);
});

test("drifting in place is still a stop", () => {
  const points = [at(0), at(20, 1), at(22, -2), at(25, 3), at(28, 0)];
  assert.equal(hasStopped(points, 0, T0, T0 + 30_000), true);
});

test("running on is not a stop", () => {
  const points = Array.from({ length: 30 }, (_, i) => at(i, i * 3));
  assert.equal(hasStopped(points, 0, T0, T0 + 30_000), false);
});

test("the first seconds after a start or a resume are never a stop", () => {
  const points = [at(0)];
  assert.equal(hasStopped(points, 0, T0, T0 + (STILL_AFTER_S - 1) * 1000), false);
});

test("a GPS still searching is not a runner standing", () => {
  assert.equal(hasStopped([], 0, T0, T0 + 60_000), false);
  // Points from before the last resume do not count either.
  assert.equal(hasStopped([at(0)], 1, T0, T0 + 60_000), false);
});

test("setting off again is read from distance or from speed", () => {
  const stop = at(0);
  assert.equal(hasMovedOn(stop, at(5, 5)), false);
  assert.equal(hasMovedOn(stop, at(5, 15)), true);
  assert.equal(hasMovedOn(stop, at(5, 2, { speed: 2.6 })), true);
  // A fix too blurred to trust moves nothing.
  assert.equal(hasMovedOn(stop, at(5, 40, { accuracy: 80 })), false);
});
