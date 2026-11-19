import assert from "node:assert/strict";
import { test } from "node:test";
import { afterSync, MAX_PENDING, readPending, withPending } from "./sync.ts";

test("an absent or broken list reads as empty", () => {
  assert.deepEqual(readPending(null), []);
  assert.deepEqual(readPending("{oops"), []);
  assert.deepEqual(readPending('[1, "x", 2]'), [1, 2]);
});

test("a deletion is kept once", () => {
  const once = withPending(null, 10);
  assert.deepEqual(readPending(withPending(once, 10)), [10]);
  assert.deepEqual(readPending(withPending(once, 20)), [10, 20]);
});

test("past the cap the oldest go first", () => {
  let raw: string | null = null;
  for (let i = 0; i < MAX_PENDING + 5; i += 1) raw = withPending(raw, i);
  const list = readPending(raw);
  assert.equal(list.length, MAX_PENDING);
  assert.equal(list[0], 5);
});

test("a sync clears what it sent, not what was deleted meanwhile", () => {
  assert.deepEqual(readPending(afterSync("[1,2,3]", [1, 2])), [3]);
});
