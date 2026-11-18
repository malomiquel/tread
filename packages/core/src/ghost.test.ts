import { test } from "node:test";
import assert from "node:assert/strict";
import { ghostAt, ghostGapS, ghostOf } from "./ghost.ts";

// Due north, 0.0009° of latitude (about 100 m) every 30 s.
const point = (i: number, segment = 0, pauseS = 0) => ({
  ts: (i * 30 + pauseS) * 1000, lat: 48 + i * 0.0009, lng: 2,
  alt: null, accuracy: 5, speed: null, segment,
});

test("a ghost needs a run to follow", () => {
  assert.equal(ghostOf([]), null);
  assert.equal(ghostOf([point(0)]), null);
});

test("the ghost is where the run was after the same active time", () => {
  const ghost = ghostOf([0, 1, 2, 3].map((i) => point(i)));
  assert.ok(ghost);
  const halfway = ghostAt(ghost, 45);
  assert.ok(Math.abs(halfway.distanceM - 150) < 1);
  assert.ok(Math.abs(halfway.lat - (48 + 1.5 * 0.0009)) < 1e-9);
  // Waits at the finish once its run is over.
  assert.equal(ghostAt(ghost, 500).distanceM, ghost.metres[3]);
});

test("a pause in the record does not freeze the ghost", () => {
  // Stopped 60 s between the second and third fixes.
  const ghost = ghostOf([point(0), point(1), point(2, 1, 60), point(3, 1, 60)]);
  assert.ok(ghost);
  // The pause itself is neither run nor timed: the jump across it is skipped.
  assert.equal(ghost.seconds[ghost.seconds.length - 1], 60);
});

test("the gap is in seconds, positive when ahead", () => {
  const ghost = ghostOf([0, 1, 2, 3].map((i) => point(i)));
  assert.ok(ghost);
  const at = ghost.metres[2];
  // The ghost reached this point after 60 s.
  assert.ok(Math.abs((ghostGapS(ghost, at, 55) ?? 0) - 5) < 1e-6);
  assert.ok(Math.abs((ghostGapS(ghost, at, 70) ?? 0) + 10) < 1e-6);
  assert.equal(ghostGapS(ghost, ghost.metres[3] + 10, 100), null);
  assert.equal(ghostGapS(ghost, 0, 0), null);
});
