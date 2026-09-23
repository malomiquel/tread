import { test } from "node:test";
import assert from "node:assert/strict";
import { changePercent, nextPeriod, previousPeriod, recapOf } from "./recap.ts";

const run = (startedAt: number, distanceM: number) =>
  ({ startedAt, distanceM, durationS: distanceM * 0.3, elevationGainM: 10 });

const runs = [
  run(new Date(2026, 8, 2, 8).getTime(), 5000),
  run(new Date(2026, 8, 2, 18).getTime(), 3000),
  run(new Date(2026, 8, 20, 8).getTime(), 12_000),
  run(new Date(2026, 7, 10, 8).getTime(), 10_000),
  run(new Date(2025, 8, 10, 8).getTime(), 7000),
];

test("a month's recap sums its runs, week by week", () => {
  const recap = recapOf(runs, { kind: "month", year: 2026, month: 8 });
  assert.equal(recap.distanceM, 20_000);
  assert.equal(recap.runs, 3);
  assert.equal(recap.activeDays, 2);
  assert.equal(recap.longestM, 12_000);
  assert.equal(recap.climbM, 30);
  // September 2026 touches five weeks, from Monday 31 August.
  assert.equal(recap.bars.length, 5);
  assert.equal(recap.bars[0], 8000);
  assert.equal(recap.previousDistanceM, 10_000);
  assert.equal(changePercent(recap), 100);
});

test("a year's recap has a bar per month", () => {
  const recap = recapOf(runs, { kind: "year", year: 2026, month: 0 });
  assert.equal(recap.bars.length, 12);
  assert.equal(recap.bars[8], 20_000);
  assert.equal(recap.previousDistanceM, 7000);
});

test("periods step across the new year", () => {
  assert.deepEqual(previousPeriod({ kind: "month", year: 2026, month: 0 }), { kind: "month", year: 2025, month: 11 });
  assert.deepEqual(nextPeriod({ kind: "month", year: 2025, month: 11 }), { kind: "month", year: 2026, month: 0 });
  assert.deepEqual(previousPeriod({ kind: "year", year: 2026, month: 3 }), { kind: "year", year: 2025, month: 3 });
});

test("nothing before means nothing to compare", () => {
  assert.equal(changePercent(recapOf(runs, { kind: "year", year: 2025, month: 0 })), null);
});
