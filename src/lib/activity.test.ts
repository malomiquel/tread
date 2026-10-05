import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityName, ofSport, parseTags, readActivity, readSport, recordedActivity, sportOf, tagName, toggleTag,
} from "./activity.ts";

test("an unknown or missing type is a run", () => {
  assert.equal(readActivity(null), "run");
  assert.equal(readActivity("swim"), "run");
  assert.equal(readActivity("trail"), "trail");
});

test("tags keep their order and drop the unknown", () => {
  assert.deepEqual(parseTags('["long","nap","race"]'), ["race", "long"]);
  assert.deepEqual(parseTags("{"), []);
  assert.deepEqual(parseTags(null), []);
});

test("toggling a tag adds or removes it in place", () => {
  assert.deepEqual(toggleTag(["long"], "race"), ["race", "long"]);
  assert.deepEqual(toggleTag(["race", "long"], "race"), ["long"]);
});

test("types and tags are named in the interface's language", () => {
  assert.equal(activityName("treadmill"), "Tapis");
  assert.equal(tagName("long"), "Sortie longue");
});

test("a ride is cycling, everything on foot is running", () => {
  assert.equal(sportOf("ride"), "cycling");
  for (const type of ["run", "trail", "treadmill", "walk", "hike"] as const) assert.equal(sportOf(type), "running");
  assert.equal(recordedActivity("cycling"), "ride");
  assert.equal(recordedActivity("running"), "run");
  assert.equal(readActivity("ride"), "ride");
});

test("rides are kept apart from runs", () => {
  const outings = [{ activity: "run" }, { activity: "ride" }, { activity: "walk" }] as const;
  assert.deepEqual(ofSport(outings).map((outing) => outing.activity), ["run", "walk"]);
  assert.deepEqual(ofSport(outings, "cycling").map((outing) => outing.activity), ["ride"]);
  assert.equal(readSport("cycling"), "cycling");
  assert.equal(readSport("swimming"), "running");
  assert.equal(readSport(undefined), "running");
});
