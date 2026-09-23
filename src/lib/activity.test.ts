import { test } from "node:test";
import assert from "node:assert/strict";
import { activityName, parseTags, readActivity, tagName, toggleTag } from "./activity.ts";

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
