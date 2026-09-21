import assert from "node:assert/strict";
import { test } from "node:test";
import { clampTarget, paceDrift, TARGET_MAX_S, TARGET_MIN_S } from "./pace.ts";

test("drift is positive when slower than asked, negative when faster", () => {
  assert.equal(paceDrift(320, 300), 20, "twenty seconds slow");
  assert.equal(paceDrift(280, 300), -20, "twenty seconds fast");
});

test("a drift inside the tolerance is not worth saying", () => {
  assert.equal(paceDrift(305, 300), null, "five seconds is holding the pace");
  assert.equal(paceDrift(293, 300), null);
  assert.equal(paceDrift(308, 300), 8, "eight seconds is drifting");
});

test("nothing is said without a target or without a reading", () => {
  assert.equal(paceDrift(300, null), null);
  assert.equal(paceDrift(null, 300), null);
  assert.equal(paceDrift(Number.NaN, 300), null);
});

test("standing still is not running slowly", () => {
  assert.equal(paceDrift(45 * 60, 300), null);
});

test("a target is kept inside its bounds and on its step", () => {
  assert.equal(clampTarget(302), 300, "snapped to the step");
  assert.equal(clampTarget(10), TARGET_MIN_S, "no faster than the floor");
  assert.equal(clampTarget(99 * 60), TARGET_MAX_S, "no slower than the ceiling");
});
