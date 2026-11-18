import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readRunnerProfile, startingLongestMin, startingVolumeKm, startingWeeklyGoalM, suggestedFrequency,
  suggestedRace,
  type RunnerProfile,
} from "./runner.ts";

const profile = (over: Partial<RunnerProfile> = {}): RunnerProfile => ({
  goal: "regular", level: "occasional", perWeek: 3, ...over,
});

test("the weekly goal is what the runner already does, not more", () => {
  assert.equal(startingWeeklyGoalM(profile()), 15_000);
  assert.equal(startingWeeklyGoalM(profile({ level: "weekly", perWeek: 4 })), 28_000);
  assert.equal(startingWeeklyGoalM(profile({ level: "new", perWeek: 2 })), 6000);
});

test("coming back starts lower than the level alone would say", () => {
  const back = profile({ goal: "comeback", level: "weekly", perWeek: 3 });
  assert.ok(startingVolumeKm(back) < startingVolumeKm({ ...back, goal: "regular" }));
  assert.equal(startingVolumeKm(back), 13);
  assert.ok(startingLongestMin(back) < startingLongestMin({ ...back, goal: "regular" }));
});

test("nobody is handed less than a real outing", () => {
  assert.ok(startingVolumeKm(profile({ goal: "comeback", level: "new", perWeek: 2 })) >= 3);
  assert.ok(startingLongestMin(profile({ goal: "comeback", level: "new" })) >= 20);
});

test("one run a week is a real answer", () => {
  assert.equal(startingWeeklyGoalM(profile({ level: "new", perWeek: 1 })), 3000);
  assert.deepEqual(readRunnerProfile(JSON.stringify(profile({ perWeek: 1 })))?.perWeek, 1);
});

test("the slider starts where the level suggests", () => {
  assert.equal(suggestedFrequency("new"), 2);
  assert.equal(suggestedFrequency("occasional"), 2);
  assert.equal(suggestedFrequency("weekly"), 3);
});

test("the race suggested is one step up, and never a marathon", () => {
  assert.equal(suggestedRace(profile({ level: "new" })), "fiveK");
  assert.equal(suggestedRace(profile({ level: "occasional" })), "tenK");
  assert.equal(suggestedRace(profile({ level: "weekly" })), "half");
});

test("a stored profile comes back as it went in, and anything else is none", () => {
  const stored = profile({ goal: "race", level: "weekly", perWeek: 4 });
  assert.deepEqual(readRunnerProfile(JSON.stringify(stored)), stored);
  assert.equal(readRunnerProfile(undefined), null);
  assert.equal(readRunnerProfile("{"), null);
  assert.equal(readRunnerProfile(JSON.stringify({ ...stored, perWeek: 7 })), null);
  assert.equal(readRunnerProfile(JSON.stringify({ ...stored, level: "elite" })), null);
});
