import assert from "node:assert/strict";
import { test } from "node:test";
import { climbOf, sampleLine } from "./elevation.ts";

test("the climb counts real rises and ignores the model's noise", () => {
  // Up 10, a metre of wobble, down 6, up 4.
  assert.deepEqual(climbOf([100, 110, 109, 110, 104, 108]), { gainM: 14, lossM: 6 });
  assert.deepEqual(climbOf([100, 101, 100, 101]), { gainM: 0, lossM: 0 });
});

test("samples are spread evenly along the line, ends included", () => {
  const line = Array.from({ length: 11 }, (_, i) => ({ lat: 48 + i * 0.001, lng: 2 }));
  const samples = sampleLine(line, 5);
  assert.equal(samples.length, 5);
  assert.equal(samples[0].distanceM, 0);
  assert.ok(Math.abs(samples[4].point.lat - 48.01) < 1e-9);
  const step = samples[1].distanceM;
  samples.forEach((sample, i) => assert.ok(Math.abs(sample.distanceM - step * i) < 1e-6));
});

test("a line too short to measure gives no samples", () => {
  assert.deepEqual(sampleLine([{ lat: 48, lng: 2 }], 5), []);
});
