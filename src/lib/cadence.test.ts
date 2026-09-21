import assert from "node:assert/strict";
import { test } from "node:test";
import { cadenceSpm, stepsFrom} from "./cadence.ts";

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


test("steps come back out of the cadence they went into", () => {
  // Forty minutes at a hundred and seventy: the count the pedometer gave.
  const seconds = 40 * 60;
  const spm = cadenceSpm(6800, seconds);
  assert.equal(spm, 170);
  assert.equal(stepsFrom(spm, seconds), 6800);
});

test("the round trip stays within the rounding a cadence carries", () => {
  for (const steps of [5123, 7777, 9001, 12_345]) {
    const seconds = 2400;
    const spm = cadenceSpm(steps, seconds)!;
    const back = stepsFrom(spm, seconds)!;
    // A cadence is whole, so the return trip can only be out by less than
    // half a step a minute — a handful over a whole run.
    assert.ok(Math.abs(back - steps) <= seconds / 120, `${steps} came back ${back}`);
  }
});

test("no cadence means no step count rather than a zero", () => {
  assert.equal(stepsFrom(null, 2400), null);
  assert.equal(stepsFrom(170, 0), null);
  assert.equal(stepsFrom(0, 2400), null);
  assert.equal(stepsFrom(Number.NaN, 2400), null);
});
