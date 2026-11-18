import { test } from "node:test";
import assert from "node:assert/strict";
import { flatEquivalentM, gradeAdjustedPace, gradeFactor } from "./gradePace.ts";

test("the flat costs what it costs, a climb more, a descent less but not much less", () => {
  assert.equal(gradeFactor(0), 1);
  // Minetti: about 1.66 times the flat cost at +10 %.
  assert.ok(Math.abs(gradeFactor(0.1) - 1.66) < 0.01);
  // A gentle descent helps, down to the floor.
  assert.ok(gradeFactor(-0.02) < 1 && gradeFactor(-0.02) > 0.8);
  assert.equal(gradeFactor(-0.05), 0.8);
  assert.equal(gradeFactor(-0.3), 0.8);
});

// 20 fixes, 100 m apart due north, climbing `rise` metres each.
const track = (rise: number | null) => Array.from({ length: 21 }, (_, i) => ({
  ts: i * 30_000, lat: 48 + i * 0.0009, lng: 2,
  alt: rise === null ? null : 100 + i * rise, accuracy: 5, speed: null, segment: 0,
}));

test("a flat run's grade-adjusted pace is its pace", () => {
  const flat = flatEquivalentM(track(0));
  assert.ok(flat !== null && Math.abs(flat - 2000) < 10);
  const pace = gradeAdjustedPace(track(0), 600);
  assert.ok(pace !== null && Math.abs(pace - 300) < 2);
});

test("a climb makes the adjusted pace quicker than the real one", () => {
  const pace = gradeAdjustedPace(track(5), 600);
  assert.ok(pace !== null && pace < 300);
});

test("no altitude, no adjusted pace", () => {
  assert.equal(gradeAdjustedPace(track(null), 600), null);
});
