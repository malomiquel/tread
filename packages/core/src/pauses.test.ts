import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrackPoint } from "./geo.ts";
import { pausedS, pausesOf } from "./pauses.ts";

/** A fix every second heading north, about 3.3 m apart. */
const fix = (s: number, step: number, segment: number): TrackPoint => ({
  ts: s * 1000, lat: 48 + step * 0.00003, lng: 2, alt: null, accuracy: 5, speed: 3, segment,
});

test("a run never paused has no pauses", () => {
  const points = Array.from({ length: 10 }, (_, i) => fix(i, i, 0));
  assert.deepEqual(pausesOf(points), []);
});

test("each resume after a stop is a pause, with where and when it began", () => {
  const points = [
    ...Array.from({ length: 61 }, (_, i) => fix(i, i, 0)), // 60 s moving
    ...Array.from({ length: 31 }, (_, i) => fix(150 + i, 61 + i, 1)), // stopped 90 s, then 30 s
    ...Array.from({ length: 11 }, (_, i) => fix(200 + i, 92 + i, 2)), // stopped 20 s
  ];
  const pauses = pausesOf(points);
  assert.equal(pauses.length, 2);
  assert.equal(pauses[0].durationS, 90);
  assert.equal(pauses[0].afterS, 60);
  assert.ok(pauses[0].atM > 190 && pauses[0].atM < 210);
  assert.equal(pauses[1].durationS, 20);
  assert.equal(pauses[1].afterS, 90);
  assert.equal(pausedS(pauses), 110);
});

test("a gap of a second or two between segments is not a pause", () => {
  const points = [fix(0, 0, 0), fix(1, 1, 0), fix(3, 2, 1), fix(4, 3, 1)];
  assert.deepEqual(pausesOf(points), []);
});
