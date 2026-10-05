import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateActiveEnergyKcal, estimateRideEnergyKcal, outingEnergyKcal } from "./energy.ts";

test("one kilocalorie per kilogram per kilometre", () => {
  assert.equal(estimateActiveEnergyKcal(10_000, 70), 700);
  assert.equal(estimateActiveEnergyKcal(5_000, 60), 300);
});

test("scales with both weight and distance", () => {
  const base = estimateActiveEnergyKcal(5_000, 70)!;
  assert.equal(estimateActiveEnergyKcal(10_000, 70), base * 2);
  assert.equal(estimateActiveEnergyKcal(5_000, 140), base * 2);
});

test("refuses a weight it cannot believe", () => {
  for (const weight of [0, -70, 12, 400, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(estimateActiveEnergyKcal(5_000, weight), null, `weight ${weight}`);
  }
});

test("refuses a run that covered no ground", () => {
  assert.equal(estimateActiveEnergyKcal(0, 70), null);
  assert.equal(estimateActiveEnergyKcal(-100, 70), null);
  assert.equal(estimateActiveEnergyKcal(Number.NaN, 70), null);
});

test("a ride costs more the faster it goes", () => {
  const easy = estimateRideEnergyKcal(15_000, 3600, 70)!;
  const brisk = estimateRideEnergyKcal(27_000, 3600, 70)!;
  assert.equal(easy, 3 * 70);
  assert.equal(brisk, 11 * 70);
  assert.equal(estimateRideEnergyKcal(20_000, 0, 70), null);
  assert.equal(estimateRideEnergyKcal(20_000, 3600, 12), null);
});

test("each outing takes its own estimate", () => {
  assert.equal(outingEnergyKcal("run", 10_000, 3000, 70), 700);
  assert.equal(outingEnergyKcal("ride", 15_000, 3600, 70), 210);
});
