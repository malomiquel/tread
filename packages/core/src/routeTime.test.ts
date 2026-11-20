import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateRouteTime, type RouteRun } from "./routeTime.ts";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 20);
const run = (daysAgo: number, km: number, paceSKm: number, gainM = 0, activity: RouteRun["activity"] = "run"): RouteRun => ({
  startedAt: now - daysAgo * DAY, activity, distanceM: km * 1000, durationS: km * paceSKm, elevationGainM: gainM,
});

test("a route the length of the runs takes their usual time", () => {
  const runs = [run(1, 10, 330), run(3, 10, 340), run(6, 10, 320)];
  const estimate = estimateRouteTime(runs, 10_000, 0, now);
  assert.ok(estimate);
  assert.equal(estimate.timeS, 3300);
  assert.equal(estimate.runs, 3);
  assert.ok(estimate.lowS <= estimate.timeS && estimate.timeS <= estimate.highS);
});

test("a longer route is slower per kilometre, and climbing costs time", () => {
  const runs = [run(1, 8, 330), run(4, 8, 330)];
  const flat = estimateRouteTime(runs, 16_000, 0, now)!;
  assert.ok(flat.paceSKm > 330);
  const hilly = estimateRouteTime(runs, 16_000, 300, now)!;
  assert.ok(hilly.timeS > flat.timeS);
});

test("rides, walks, short and old outings say nothing", () => {
  const runs = [
    run(1, 30, 120, 0, "ride"), run(2, 6, 600, 0, "walk"), run(3, 1, 300), run(200, 10, 300),
  ];
  assert.equal(estimateRouteTime(runs, 10_000, 0, now), null);
});

test("only the ten most recent runs count", () => {
  const runs = [...Array.from({ length: 10 }, (_, i) => run(i + 1, 10, 300)), run(30, 10, 600)];
  assert.equal(estimateRouteTime(runs, 10_000, 0, now)!.runs, 10);
  assert.equal(estimateRouteTime(runs, 10_000, 0, now)!.timeS, 3000);
});
