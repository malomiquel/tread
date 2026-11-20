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

test("a steep climb at a walk is not a stop", () => {
  // 2.5 km/h is 0.7 m/s: under 8 m in ten seconds, but the GPS says it moves.
  const points = [0, 2, 4, 6, 8, 10].map((s) => at(s, s * 0.63, { speed: 0.7 }));
  assert.equal(hasStopped(points, 0, T0, T0 + 11_000), false);
});

test("drift with no measured speed is still a stop", () => {
  const points = [at(0), at(3, 3, { speed: 0.1 }), at(6, 1, { speed: 0 })];
  assert.equal(hasStopped(points, 0, T0, T0 + 30_000), true);
});

test("an imprecise fix claiming a walk does not hold a stop off", () => {
  const points = [at(0), at(4, 2, { speed: 0.9, accuracy: 80 })];
  assert.equal(hasStopped(points, 0, T0, T0 + 30_000), true);
});

test("walking off up a hill resumes after a few metres", () => {
  const stop = at(0);
  assert.equal(hasMovedOn(stop, at(5, 6, { speed: 0.7 })), true);
  assert.equal(hasMovedOn(stop, at(5, 3, { speed: 0.7 })), false, "two or three metres is still drift");
  assert.equal(hasMovedOn(stop, at(5, 6, { speed: 0.2 })), false, "six metres without a walk is drift");
});
