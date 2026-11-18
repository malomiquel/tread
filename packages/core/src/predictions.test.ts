import { test } from "node:test";
import assert from "node:assert/strict";
import { effortSamples, PREDICTION_WINDOW_MS, predictRaces } from "./predictions.ts";

const NOW = new Date(2026, 8, 23, 12).getTime();
const DAY = 86_400_000;

test("a 5K predicts itself and everything within reach", () => {
  const predictions = predictRaces([{ key: "5000", seconds: 1500, at: NOW - DAY }], NOW);
  assert.deepEqual(predictions.map((p) => p.goal), ["fiveK", "tenK", "half", "marathon"]);
  assert.equal(predictions[0].timeS, 1500);
  assert.equal(predictions[0].paceSKm, 300);
  // Further always costs more per kilometre.
  for (let i = 1; i < predictions.length; i += 1) {
    assert.ok(predictions[i].paceSKm > predictions[i - 1].paceSKm);
  }
});

test("a mile only reaches as far as 10K", () => {
  const predictions = predictRaces([{ key: "1609", seconds: 420, at: NOW - DAY }], NOW);
  assert.deepEqual(predictions.map((p) => p.goal), ["fiveK", "tenK"]);
});

test("short efforts and old ones predict nothing", () => {
  assert.deepEqual(predictRaces([{ key: "1000", seconds: 240, at: NOW - DAY }], NOW), []);
  assert.deepEqual(predictRaces([{ key: "5000", seconds: 1500, at: NOW - PREDICTION_WINDOW_MS - DAY }], NOW), []);
});

test("the fastest projection wins", () => {
  const predictions = predictRaces([
    { key: "5000", seconds: 1500, at: NOW - 2 * DAY },
    { key: "10000", seconds: 2900, at: NOW - DAY },
  ], NOW);
  const tenK = predictions.find((p) => p.goal === "tenK");
  assert.ok(tenK);
  assert.equal(tenK.from.key, "10000");
  assert.equal(tenK.timeS, 2900);
});

test("more weekly volume means a quicker marathon", () => {
  const sample = [{ key: "10000", seconds: 3000, at: NOW - DAY }];
  const low = predictRaces(sample, NOW, 15).find((p) => p.goal === "marathon");
  const high = predictRaces(sample, NOW, 80).find((p) => p.goal === "marathon");
  assert.ok(low && high && high.timeS < low.timeS);
});

test("samples come from every run's efforts", () => {
  const samples = effortSamples([
    { startedAt: 1, bestEfforts: { "1000": 250, "5000": 1400 } },
    { startedAt: 2, bestEfforts: null },
  ]);
  assert.equal(samples.length, 2);
  assert.deepEqual(samples[1], { key: "5000", seconds: 1400, at: 1 });
});
