import { test } from "node:test";
import assert from "node:assert/strict";
import { activeS, editRun, maxCutS, spanS, trimmed } from "./runEdit.ts";

// Due north, about 100 m every 30 s, for ten minutes.
const points = Array.from({ length: 21 }, (_, i) => ({
  ts: 1_000_000 + i * 30_000, lat: 48 + i * 0.0009, lng: 2,
  alt: null, accuracy: 5, speed: null, segment: 0,
}));
const run = { startedAt: 1_000_000, endedAt: 1_000_000 + 600_000, durationS: 600, laps: [] };

test("span and active time", () => {
  assert.equal(spanS(points), 600);
  assert.equal(activeS(points), 600);
  const paused = points.map((point, i) => ({ ...point, segment: i < 10 ? 0 : 1 }));
  // The 30 s between the two segments is a pause.
  assert.equal(activeS(paused), 570);
});

test("cutting takes fixes off by time from either end", () => {
  assert.equal(trimmed(points, 60, 0).length, 19);
  assert.equal(trimmed(points, 0, 90).length, 18);
  assert.equal(maxCutS(points, 0), 540);
  assert.equal(maxCutS(points, 500), 40);
});

test("a cut run loses the time and distance cut, and keeps the rest", () => {
  const edited = editRun(run, points, 60, 120, null);
  assert.equal(edited.durationS, 420);
  assert.equal(edited.startedAt, points[2].ts);
  assert.equal(edited.endedAt, points[16].ts);
  assert.ok(Math.abs(edited.distanceM - 14 * 100) < 5);
  assert.ok(edited.avgPaceSKm !== null && Math.abs(edited.avgPaceSKm - 300) < 2);
});

test("an uncut run keeps its own clock, and a corrected distance sets the pace", () => {
  const edited = editRun({ ...run, durationS: 610 }, points, 0, 0, 2500);
  assert.equal(edited.durationS, 610);
  assert.equal(edited.distanceM, 2500);
  assert.equal(edited.avgPaceSKm, 244);
  assert.equal(edited.startedAt, run.startedAt);
});

test("laps go when the start is cut, and past the finish when the end is", () => {
  const laps = [{ distanceM: 400, durationS: 120 }, { distanceM: 1800, durationS: 540 }];
  assert.deepEqual(editRun({ ...run, laps }, points, 30, 0, null).laps, []);
  assert.deepEqual(editRun({ ...run, laps }, points, 0, 120, null).laps, [laps[0]]);
});
