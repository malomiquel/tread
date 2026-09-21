import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEnergy, formatSpeed } from "./format.ts";
import { timeAgo, weeklyVolumeKm, weekStart, weekTotals } from "./stats.ts";

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
