import { test } from "node:test";
import assert from "node:assert/strict";
import { lapsOf, parseLaps } from "./laps.ts";

test("no mark, no laps", () => {
  assert.deepEqual(lapsOf([], 5000, 1500), []);
});

test("laps are the gaps between marks, the rest to the finish is partial", () => {
  const laps = lapsOf(
    [{ distanceM: 400, durationS: 90 }, { distanceM: 800, durationS: 184 }],
    1000, 260,
  );
  assert.equal(laps.length, 3);
  assert.deepEqual(laps.map((lap) => lap.distanceM), [400, 400, 200]);
  assert.deepEqual(laps.map((lap) => lap.durationS), [90, 94, 76]);
  assert.equal(laps[0].paceSKm, 225);
  assert.deepEqual(laps.map((lap) => lap.partial), [false, false, true]);
  assert.deepEqual(laps.map((lap) => lap.number), [1, 2, 3]);
});

test("finishing on a lap press leaves no empty last lap", () => {
  const laps = lapsOf([{ distanceM: 400, durationS: 90 }], 400, 90.4);
  assert.equal(laps.length, 1);
  assert.equal(laps[0].partial, false);
});

test("a lap too short for a pace has none", () => {
  const laps = lapsOf([{ distanceM: 400, durationS: 90 }, { distanceM: 405, durationS: 92 }], 800, 180);
  assert.equal(laps[1].paceSKm, null);
});

test("stored marks survive a round trip and junk reads as none", () => {
  const marks = [{ distanceM: 400, durationS: 90 }];
  assert.deepEqual(parseLaps(JSON.stringify(marks)), marks);
  assert.deepEqual(parseLaps("{"), []);
  assert.deepEqual(parseLaps(null), []);
  assert.deepEqual(parseLaps('[{"distanceM":"x"}]'), []);
});
