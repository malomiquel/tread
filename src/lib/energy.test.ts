import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateActiveEnergyKcal } from "./energy.ts";

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
    assert.equal(estimateActiveEnergyKcal(5_000, weight), null, `poids ${weight}`);
  }
});

test("refuses a run that covered no ground", () => {
  assert.equal(estimateActiveEnergyKcal(0, 70), null);
  assert.equal(estimateActiveEnergyKcal(-100, 70), null);
  assert.equal(estimateActiveEnergyKcal(Number.NaN, 70), null);
});
