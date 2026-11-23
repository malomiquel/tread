import assert from "node:assert/strict";
import { test } from "node:test";
import { climbAhead, daysUntil, goalVerdict, heatCost, hillFactor, planGapS, plannedAt, plannedPace, racePlan } from "./raceDay.ts";

/** A profile sampled every 100 m, from heights per sample. */
const profile = (heights: number[]) => heights.map((value, i) => ({ distanceM: i * 100, value }));

test("a flat course is run at an even pace that adds up to the goal", () => {
  const plan = racePlan(10_000, 3000, null)!;
  assert.equal(plan.splits.length, 10);
  for (const split of plan.splits) assert.ok(Math.abs(split.paceSKm - 300) < 1e-6);
  assert.ok(Math.abs(plan.splits[9].atS - 3000) < 1e-6);
});

test("a hill slows its kilometre, the rest is run a little faster, and the goal still holds", () => {
  // 3 km: flat, then 1 km rising 40 m (4 %), then flat.
  const heights = [
    ...Array.from({ length: 11 }, () => 0),
    ...Array.from({ length: 10 }, (_, i) => (i + 1) * 4),
    ...Array.from({ length: 10 }, () => 40),
  ];
  const plan = racePlan(3000, 900, profile(heights))!;
  const [first, hill, last] = plan.splits;
  assert.ok(hill.paceSKm > first.paceSKm, "slower uphill");
  assert.ok(first.paceSKm < 300 && last.paceSKm < 300, "faster than even on the flat");
  assert.ok(Math.abs(hill.grade - 0.04) < 0.001);
  assert.ok(Math.abs(plan.splits[2].atS - 900) < 1e-6);
  assert.equal(plan.climbs.length, 1);
  assert.equal(plan.climbs[0].gainM, 40);
  assert.ok(plan.climbs[0].costS > 0);
});

test("downhill gives back less than uphill costs, and nothing past 5 %", () => {
  assert.ok(hillFactor(0.03) - 1 > 1 - hillFactor(-0.03));
  assert.equal(hillFactor(-0.1), hillFactor(-0.05));
  assert.equal(hillFactor(0), 1);
});

test("the plan reads between splits, and the gap says ahead or behind", () => {
  const plan = racePlan(5000, 1500, null)!;
  assert.equal(plannedAt(plan, 2500), 750);
  assert.equal(plannedPace(plan, 2500), 300);
  assert.equal(planGapS(plan, 2500, 740), 10, "ten seconds ahead");
  assert.equal(planGapS(plan, 2500, 760), -10, "ten seconds behind");
});

test("a climb is announced within range, not before", () => {
  const heights = [...Array.from({ length: 11 }, () => 0), ...Array.from({ length: 5 }, (_, i) => (i + 1) * 5)];
  const plan = racePlan(1500, 450, profile(heights))!;
  assert.equal(climbAhead(plan, 500), null);
  const ahead = climbAhead(plan, 800);
  assert.ok(ahead);
  assert.equal(ahead.inM, 200);
  assert.equal(climbAhead(plan, 1200)!.inM, 0, "under way");
});

test("a short bump is not a climb", () => {
  const plan = racePlan(1000, 300, profile([0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3]))!;
  assert.equal(plan.climbs.length, 0);
});

test("the goal is judged against the runner's ordinary days", () => {
  const estimate = { timeS: 3000, paceSKm: 300, lowS: 2900, highS: 3100, runs: 6 };
  assert.equal(goalVerdict(2800, estimate), "ambitious");
  assert.equal(goalVerdict(3000, estimate), "realistic");
  assert.equal(goalVerdict(3200, estimate), "cautious");
  assert.equal(goalVerdict(3000, null), null);
});

test("heat costs nothing when cool, a little more each degree, and no more than a tenth", () => {
  assert.equal(heatCost(10), 0);
  assert.ok(Math.abs(heatCost(22) - 0.03) < 1e-9);
  assert.equal(heatCost(60), 0.1);
});

test("the countdown is in days, whatever the hour", () => {
  const now = new Date(2026, 3, 10, 22, 0).getTime();
  assert.equal(daysUntil(new Date(2026, 3, 12, 8, 30).getTime(), now), 2);
  assert.equal(daysUntil(new Date(2026, 3, 10, 6, 0).getTime(), now), 0);
});
