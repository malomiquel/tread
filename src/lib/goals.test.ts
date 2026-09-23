import { test } from "node:test";
import assert from "node:assert/strict";
import { goalAmount, goalFromSettings, hoursText, measure, readGoalKind } from "./goals.ts";

const settings = { goalKind: "distance" as const, weeklyGoalM: 25_000, weeklyGoalS: 10_800, weeklyGoalClimbM: null };

test("the goal in force is the chosen kind's, and none without a figure", () => {
  assert.deepEqual(goalFromSettings(settings), { kind: "distance", target: 25_000 });
  assert.deepEqual(goalFromSettings({ ...settings, goalKind: "time" }), { kind: "time", target: 10_800 });
  assert.equal(goalFromSettings({ ...settings, goalKind: "climb" }), null);
  assert.equal(readGoalKind("nonsense"), "distance");
});

test("a week is measured in the goal's own terms", () => {
  const covered = { distanceM: 12_000, durationS: 4000, climbM: 150 };
  assert.equal(measure("distance", covered), 12_000);
  assert.equal(measure("time", covered), 4000);
  assert.equal(measure("climb", covered), 150);
});

test("amounts read the way they are aimed at", () => {
  assert.equal(hoursText(3 * 3600 + 30 * 60), "3 h 30");
  assert.equal(hoursText(45 * 60), "45 min");
  assert.equal(hoursText(2 * 3600), "2 h");
  assert.equal(goalAmount("time", 5400), "1 h 30");
  assert.equal(goalAmount("distance", 25_000), "25 km");
});
