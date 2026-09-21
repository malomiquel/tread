import assert from "node:assert/strict";
import { test } from "node:test";
import { cadenceSpm } from "./cadence.ts";

test("cadence counts every footfall, per minute", () => {
  // Nine hundred steps over five minutes is a hundred and eighty a minute.
  assert.equal(cadenceSpm(900, 300), 180);
  assert.equal(cadenceSpm(1600, 600), 160);
});

test("a run with no steps or no time has no cadence", () => {
  assert.equal(cadenceSpm(0, 300), null);
  assert.equal(cadenceSpm(900, 0), null);
  assert.equal(cadenceSpm(Number.NaN, 300), null);
});

test("a figure outside what a runner can hold is refused", () => {
  // Ten steps in ten minutes is someone who stopped, not someone slow.
  assert.equal(cadenceSpm(10, 600), null);
  // A thousand a minute is the sensor counting something else entirely.
  assert.equal(cadenceSpm(10_000, 60), null);
});
