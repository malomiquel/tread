import assert from "node:assert/strict";
import { test } from "node:test";
import { afterSync, batchRuns, keepPresent, MAX_PENDING, readPending, readSynced, runSignature, runsToSend, withPending } from "./sync.ts";

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

test("a broken map of sent runs reads as empty", () => {
  assert.deepEqual(readSynced(null), {});
  assert.deepEqual(readSynced("[1]"), {});
  assert.deepEqual(readSynced('{"1": "a", "2": 3}'), { 1: "a" });
});

test("a run is sent again once it changed, and only then", () => {
  const name = runSignature({ name: "Morning" }, 10);
  assert.equal(name, runSignature({ name: "Morning" }, 10));
  assert.notEqual(name, runSignature({ name: "Evening" }, 10));
  assert.notEqual(name, runSignature({ name: "Morning" }, 11));
  const synced = { 1: name, 2: "stale" };
  assert.deepEqual(runsToSend([
    { startedAt: 1, signature: name },
    { startedAt: 2, signature: name },
    { startedAt: 3, signature: name },
  ], synced), [2, 3]);
});

test("runs gone from the phone are forgotten", () => {
  assert.deepEqual(keepPresent({ 1: "a", 2: "b" }, [2, 3]), { 2: "b" });
});

test("batches stay under the cap, and a long run goes alone", () => {
  const sizes = (runs: { points: number }[][]) => runs.map((batch) => batch.map((run) => run.points));
  assert.deepEqual(sizes(batchRuns([{ points: 3 }, { points: 4 }, { points: 9 }, { points: 2 }, { points: 1 }], 7)), [[3, 4], [9], [2, 1]]);
  assert.deepEqual(batchRuns([], 7), []);
});
