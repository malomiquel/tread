import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEnergy, formatSpeed } from "./format.ts";
import {
  byMonth, monthSummary,
  goalProgress, suggestedWeeklyGoalM, timeAgo, weeklyVolumeKm, weekStart, weekTotals,
} from "./stats.ts";

const run = (startedAt: number, distanceM = 5000, durationS = 1500) =>
  ({
    id: 1, startedAt, endedAt: startedAt + durationS * 1000, distanceM, durationS,
    avgPaceSKm: 300, name: null, elevationGainM: 0, fastestKmS: 290,
  }) as const;

test("week starts on Monday at midnight", () => {
  // Wednesday 23 September 2026, 15:40 local time.
  const wednesday = new Date(2026, 8, 23, 15, 40).getTime();
  const start = new Date(weekStart(wednesday));
  assert.equal(start.getDay(), 1, "must land on a Monday");
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getDate(), 21);
});

test("a Sunday belongs to the week that began six days earlier", () => {
  const sunday = new Date(2026, 8, 27, 11, 0).getTime();
  assert.equal(new Date(weekStart(sunday)).getDate(), 21);
});

test("weekly totals count this week only", () => {
  const now = new Date(2026, 8, 23, 12, 0).getTime();
  const totals = weekTotals(
    [
      run(new Date(2026, 8, 22, 8, 0).getTime(), 5000, 1500),
      run(new Date(2026, 8, 23, 7, 0).getTime(), 8000, 2400),
      run(new Date(2026, 8, 19, 9, 0).getTime(), 10_000, 3000), // week before
    ],
    now,
  );
  assert.equal(totals.runs, 2);
  assert.equal(totals.distanceM, 13_000);
  assert.equal(totals.durationS, 3900);
});

test("weekly totals on an empty history", () => {
  assert.deepEqual(weekTotals([]), { distanceM: 0, durationS: 0, runs: 0 });
});

test("time ago reads naturally at every scale", () => {
  const now = Date.UTC(2026, 8, 23, 12, 0);
  const ago = (minutes: number) => timeAgo(now - minutes * 60_000, now);
  assert.equal(ago(0), "à l'instant");
  assert.equal(ago(25), "il y a 25 min");
  assert.equal(ago(180), "il y a 3 h");
  assert.equal(ago(60 * 24), "hier");
  assert.equal(ago(60 * 24 * 3), "il y a 3 jours");
  assert.equal(ago(60 * 24 * 7), "il y a une semaine");
  assert.equal(ago(60 * 24 * 21), "il y a 3 semaines");
});

test("formatSpeed reads a pace the other way round", () => {
  // 3 m/s is 10.8 km/h, and a 5'33" kilometre.
  assert.equal(formatSpeed(3), "10,8");
  assert.equal(formatSpeed(0), "–", "standing still has no speed");
  assert.equal(formatSpeed(Number.NaN), "–");
});

test("formatEnergy refuses to pretend to a decimal", () => {
  assert.equal(formatEnergy(412.6), "413");
  assert.equal(formatEnergy(0), "0");
});


const DAY_MS = 86_400_000;
/** Wednesday 23 September 2026. */
const WEDNESDAY = new Date(2026, 8, 23, 12, 0).getTime();

test("weekly volume averages over the weeks, not over the outings", () => {
  // Four runs of ten kilometres, all inside the eight weeks before this one.
  const runs = [1, 2, 3, 4].map((n) => run(WEDNESDAY - n * 7 * DAY_MS, 10_000));
  // Forty kilometres spread over eight weeks, whatever weeks were skipped.
  assert.equal(weeklyVolumeKm(runs, WEDNESDAY, 8), 5);
});

test("a week off counts as a week, because the figure describes a habit", () => {
  const busy = [1, 2].map((n) => run(WEDNESDAY - n * 7 * DAY_MS, 20_000));
  const spread = [1, 5].map((n) => run(WEDNESDAY - n * 7 * DAY_MS, 20_000));
  // The same forty kilometres either way: nobody is flattered for bunching.
  assert.equal(weeklyVolumeKm(busy, WEDNESDAY, 8), weeklyVolumeKm(spread, WEDNESDAY, 8));
});

test("the week under way is left out of the average", () => {
  // A single run today would otherwise read as a whole week of training.
  assert.equal(weeklyVolumeKm([run(WEDNESDAY - DAY_MS, 12_000)], WEDNESDAY, 8), null);
});

test("no runs means no figure rather than a zero", () => {
  assert.equal(weeklyVolumeKm([], WEDNESDAY, 8), null);
  // And runs older than the window do not count.
  assert.equal(weeklyVolumeKm([run(WEDNESDAY - 200 * DAY_MS)], WEDNESDAY, 8), null);
});

test("a week without a goal has no progress to report", () => {
  assert.equal(goalProgress(12_000, null), null);
  assert.equal(goalProgress(12_000, 0), null);
  assert.equal(goalProgress(12_000, Number.NaN), null);
});

test("the bar stops at full and the percentage does not", () => {
  const good = goalProgress(39_000, 30_000);
  assert.equal(good?.share, 1);
  assert.equal(good?.percent, 130);
  assert.equal(good?.remainingM, 0);
  assert.equal(good?.reached, true);
});

test("an unfinished week says what is left of it", () => {
  const half = goalProgress(12_000, 30_000);
  assert.equal(half?.share, 0.4);
  assert.equal(half?.percent, 40);
  assert.equal(half?.remainingM, 18_000);
  assert.equal(half?.reached, false);
});

test("a week that has not started yet is empty, never negative", () => {
  const none = goalProgress(0, 30_000);
  assert.equal(none?.share, 0);
  assert.equal(none?.remainingM, 30_000);
  assert.equal(goalProgress(-5, 30_000)?.share, 0);
});

test("the goal suggested is their own average, to the nearest five", () => {
  const now = new Date(2026, 8, 22).getTime();
  const lastWeek = weekStart(now) - 3 * 86_400_000;
  // Four weeks back, 32 km in one of them: an average of 4 km a week rounds
  // to five, which is also the floor.
  assert.equal(suggestedWeeklyGoalM([run(lastWeek, 32_000)], now), 5000);

  // Eight weeks at roughly 27 km each rounds to 25.
  const weekly = Array.from({ length: 8 }, (_, i) =>
    run(weekStart(now) - (i + 1) * 7 * 86_400_000, 27_000));
  assert.equal(suggestedWeeklyGoalM(weekly, now), 25_000);
});

test("somebody who has never run is offered five kilometres, not zero", () => {
  assert.equal(suggestedWeeklyGoalM([], Date.now()), 5000);
});

test("runs are gathered by month, newest first, with their totals", () => {
  const sep = run(new Date(2026, 8, 20, 8).getTime(), 8000, 2400);
  const sepEarly = run(new Date(2026, 8, 2, 8).getTime(), 5000, 1500);
  const aug = run(new Date(2026, 7, 30, 8).getTime(), 10_000, 3000);
  const groups = byMonth([sep, sepEarly, aug]);
  assert.deepEqual(groups.map((g) => g.key), ["2026-09", "2026-08"]);
  assert.equal(groups[0].runs.length, 2);
  assert.equal(groups[0].distanceM, 13_000);
  assert.equal(groups[0].durationS, 3900);
  assert.equal(groups[0].start, new Date(2026, 8, 1).getTime());
  assert.deepEqual(byMonth([]), []);
});

test("the month banner counts this month and names the last one", () => {
  const now = new Date(2026, 8, 23, 12).getTime();
  const summary = monthSummary([
    run(new Date(2026, 8, 20, 8).getTime(), 8000, 2400),
    run(new Date(2026, 7, 30, 8).getTime(), 10_000, 3000),
    run(new Date(2026, 6, 1, 8).getTime(), 21_000, 7000),
  ], now);
  assert.equal(summary.current.distanceM, 8000);
  assert.equal(summary.current.runs, 1);
  assert.equal(summary.previous.distanceM, 10_000);
  assert.equal(summary.previous.start, new Date(2026, 7, 1).getTime());
});

test("a month with no runs yet is zero, not missing", () => {
  const now = new Date(2026, 0, 3).getTime();
  const summary = monthSummary([run(new Date(2025, 11, 28).getTime())], now);
  assert.equal(summary.current.runs, 0);
  assert.equal(summary.previous.distanceM, 5000);
});
