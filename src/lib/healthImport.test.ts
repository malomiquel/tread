import { test } from "node:test";
import assert from "node:assert/strict";
import { alreadyHere, toImportedRun } from "./healthImport.ts";

const START = new Date(2026, 8, 23, 7).getTime();
// 21 fixes 100 m apart, one every 30 s: 2 km in 10 min.
const locations = Array.from({ length: 21 }, (_, i) => ({
  ts: START + i * 30_000, lat: 48 + i * 0.0009, lng: 2, alt: 100, accuracy: 5, speed: 3.3,
}));

test("a watch's workout becomes a run with its track and figures", () => {
  const run = toImportedRun({
    uuid: "A", startedAt: START, endedAt: START + 600_000, durationS: 600, distanceM: 2010,
    indoor: false, ride: false, sourceName: "Apple Watch", locations,
  });
  assert.equal(run.distanceM, 2010);
  assert.equal(run.durationS, 600);
  assert.ok(run.avgPaceSKm !== null && Math.abs(run.avgPaceSKm - 298.5) < 1);
  assert.equal(run.points.length, 21);
  assert.equal(run.activity, "run");
  assert.ok(run.bestEfforts["1000"] > 0);
});

test("a treadmill workout has no track and keeps Health's distance", () => {
  const run = toImportedRun({
    uuid: "B", startedAt: START, endedAt: START + 1_800_000, durationS: 1800, distanceM: 5000,
    indoor: true, ride: false, sourceName: "Apple Watch", locations: [],
  });
  assert.equal(run.activity, "treadmill");
  assert.equal(run.points.length, 0);
  assert.equal(run.avgPaceSKm, 360);
});

test("a ride from the watch comes in as a ride, without a runner's measures", () => {
  const ride = toImportedRun({
    uuid: "C", startedAt: START, endedAt: START + 600_000, durationS: 600, distanceM: 2010,
    indoor: false, ride: true, sourceName: "Apple Watch", locations,
  });
  assert.equal(ride.activity, "ride");
  assert.equal(ride.fastestKmS, null);
  assert.deepEqual(ride.bestEfforts, {});
  assert.equal(ride.points.length, 21);
});

test("the same outing on the phone and the watch is kept once", () => {
  const runs = [{ startedAt: START + 40_000, distanceM: 2000 }];
  assert.equal(alreadyHere(runs, { startedAt: START, distanceM: 2050 }), true);
  assert.equal(alreadyHere(runs, { startedAt: START, distanceM: 8000 }), false);
  assert.equal(alreadyHere(runs, { startedAt: START + 3_600_000, distanceM: 2000 }), false);
});
