import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlan, clampWeeks, daysBetween, equivalentTimeS, GOALS, goalById, loadOfWeek, pacesFrom,
  phaseOfWeek, planProgress, projectedTimeS, schedule, slotDates, startOfDay,
  type Done, type PlannedSession,
} from "./plan.ts";

const half = goalById("half")!;

/** Monday 5 January 2026, local. */
const MONDAY = new Date(2026, 0, 5).getTime();
/** Sunday 29 March 2026, twelve weeks later to the day. */
const RACE = new Date(2026, 2, 29).getTime();

test("a race day twelve weeks out is twelve weeks of days away", () => {
  assert.equal(daysBetween(MONDAY, RACE), 83);
  assert.equal(new Date(RACE).getDay(), 0);
});

test("Riegel stretches time faster than distance", () => {
  const halfTime = equivalentTimeS(10_000, 2400, 21_097)!;
  // Forty minutes over ten kilometres is about an hour and twenty-eight over
  // a half, which is where the published tables put it.
  assert.ok(halfTime > 5200 && halfTime < 5400, `${halfTime}`);
  // Never merely proportional: twice the distance costs more than twice.
  assert.ok(halfTime > 2400 * 2.1097);
});

test("Riegel refuses nonsense rather than returning it", () => {
  assert.equal(equivalentTimeS(0, 2400, 10_000), null);
  assert.equal(equivalentTimeS(10_000, -1, 10_000), null);
  assert.equal(equivalentTimeS(10_000, 2400, Number.NaN), null);
});

test("the pace ladder runs in the only order it can", () => {
  const paces = pacesFrom(21_097, 5400)!;
  assert.ok(paces.easy > paces.long);
  assert.ok(paces.long > paces.marathon);
  assert.ok(paces.marathon > paces.half);
  assert.ok(paces.half > paces.tenK);
  assert.ok(paces.tenK > paces.fiveK);
  assert.ok(paces.fiveK > paces.interval);
});

test("the target time is the pace it asks for", () => {
  const paces = pacesFrom(21_097, 5400)!;
  // A ninety minute half is four minutes fifteen a kilometre, give or take.
  assert.ok(Math.abs(paces.half - 5400 / 21.097) < 0.5);
  assert.ok(Math.abs(projectedTimeS(half, paces) - 5400) < 1);
});

test("the taper is counted back from the race, never eaten by a short plan", () => {
  for (const weeks of [8, 10, 12, 16]) {
    assert.equal(phaseOfWeek(weeks, weeks, 2), "taper");
    assert.equal(phaseOfWeek(weeks - 1, weeks, 2), "taper");
    assert.equal(phaseOfWeek(weeks - 2, weeks, 2), "peak");
    assert.equal(phaseOfWeek(1, weeks, 2), "base");
  }
});

test("phases only ever move forwards", () => {
  const rank = { base: 0, build: 1, peak: 2, taper: 3 };
  let previous = -1;
  for (let week = 1; week <= 12; week += 1) {
    const current = rank[phaseOfWeek(week, 12, 2)];
    assert.ok(current >= previous, `week ${week} went backwards`);
    previous = current;
  }
});

test("every fourth week steps back, and the race week is the lightest of all", () => {
  assert.ok(loadOfWeek(4, 12, 2) < loadOfWeek(3, 12, 2));
  assert.ok(loadOfWeek(8, 12, 2) < loadOfWeek(7, 12, 2));
  const raceWeek = loadOfWeek(12, 12, 2);
  for (let week = 1; week < 12; week += 1) {
    assert.ok(raceWeek < loadOfWeek(week, 12, 2), `week ${week} was lighter than the race week`);
  }
});

test("a plan is as long as it says and ends on the race", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400 });
  assert.equal(sessions.length, 36);
  assert.equal(sessions.at(-1)!.kind, "race");
  assert.equal(sessions.filter((s) => s.kind === "race").length, 1);
  assert.deepEqual(sessions.map((s) => s.order), sessions.map((_, i) => i + 1));
});

test("four days a week is four sessions a week", () => {
  const sessions = buildPlan({ goal: "half", weeks: 10, perWeek: 4, targetTimeS: 5400 });
  // Nine ordinary weeks of four, then race week, which is its own shape at
  // any rhythm: two short runs to stay loose, and the race.
  assert.equal(sessions.length, 9 * 4 + 3);
  assert.equal(sessions.filter((s) => s.week === 10).length, 3);
  for (let week = 1; week < 10; week += 1) {
    const kinds = sessions.filter((s) => s.week === week).map((s) => s.kind);
    assert.ok(kinds.includes("interval"), `week ${week} had no repetitions`);
    assert.ok(kinds.includes("tempo"), `week ${week} had no threshold`);
    assert.ok(kinds.includes("long"), `week ${week} had no long run`);
  }
});

test("three days a week alternates the quality session instead of dropping one", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400 });
  const quality = sessions.filter((s) => s.kind === "interval" || s.kind === "tempo");
  assert.ok(quality.some((s) => s.kind === "interval"));
  assert.ok(quality.some((s) => s.kind === "tempo"));
  // One a week, every week but the last.
  assert.equal(quality.length, 11);
});

test("the long run grows and then gives way", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400 });
  const minutes = sessions
    .filter((s) => s.kind === "long")
    .map((s) => (s.session.steps[0].seconds ?? 0) / 60);
  assert.ok(minutes.at(-1)! < Math.max(...minutes), "the last long run was the longest");
  assert.ok(Math.max(...minutes) <= 105);
});

test("a plan is clamped to what its race can carry", () => {
  assert.equal(clampWeeks(half, 2), half.minWeeks);
  assert.equal(clampWeeks(half, 40), half.maxWeeks);
  assert.equal(clampWeeks(half, Number.NaN), half.minWeeks);
  for (const goal of GOALS) assert.ok(goal.minWeeks < goal.maxWeeks);
});

test("an impossible target yields no plan rather than a broken one", () => {
  assert.deepEqual(buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 0 }), []);
});

test("training days are the days the plan says, and never race day", () => {
  const slots = slotDates(MONDAY, RACE, 3);
  assert.ok(slots.every((day) => [2, 4, 0].includes(new Date(day).getDay())));
  assert.ok(slots.every((day) => day < startOfDay(RACE)));
  assert.equal(slots.length, 35);
  assert.deepEqual(slots, [...slots].sort((a, b) => a - b));
  assert.equal(new Set(slots).size, slots.length);
});

const plan = (): PlannedSession[] =>
  buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400 });

test("a plan started on time fits its calendar exactly", () => {
  const scheduled = schedule(plan(), new Map(), MONDAY, RACE, 3);
  assert.equal(scheduled.length, 36, "sessions were dropped from a plan that fits");
  assert.equal(scheduled.at(-1)!.kind, "race");
  assert.equal(scheduled.at(-1)!.at, startOfDay(RACE));
});

test("what is left slides towards the race instead of piling up behind", () => {
  // Two weeks gone by, nothing done.
  const late = new Date(2026, 0, 19).getTime();
  const scheduled = schedule(plan(), new Map(), late, RACE, 3);

  assert.ok(scheduled.every((s) => s.at >= startOfDay(late)), "a session was left in the past");
  // The six sessions there is no longer room for went from the front.
  const kept = scheduled.filter((s) => s.kind !== "race");
  assert.equal(kept.length, 29);
  assert.equal(kept[0].order, 7);
  // And the sharpening still lands where it has to.
  assert.equal(scheduled.at(-1)!.kind, "race");
  assert.equal(scheduled.at(-2)!.week, 12);
});

test("skipping the foundation is what costs you, never the taper", () => {
  const veryLate = new Date(2026, 2, 2).getTime();
  const scheduled = schedule(plan(), new Map(), veryLate, RACE, 3);
  const weeks = scheduled.map((s) => s.week);
  assert.ok(Math.min(...weeks) > 6, `kept week ${Math.min(...weeks)}`);
  assert.equal(scheduled.at(-1)!.kind, "race");
});

test("a finished session keeps the day it was actually run", () => {
  const ranAt = new Date(2026, 0, 6, 18, 30).getTime();
  const done = new Map<number, Done>([[1, { runId: 42, at: ranAt }]]);
  const scheduled = schedule(plan(), done, MONDAY, RACE, 3);

  const first = scheduled.find((s) => s.order === 1)!;
  assert.equal(first.runId, 42);
  assert.equal(first.at, startOfDay(ranAt));
  // And it is not handed a slot one of the remaining sessions needs.
  const slots = scheduled.filter((s) => s.runId === null && s.kind !== "race").map((s) => s.at);
  assert.equal(new Set(slots).size, slots.length);
});

test("progress is a fraction and stays one", () => {
  const all = plan();
  assert.equal(planProgress(all, 0), 0);
  assert.equal(planProgress(all, 36), 1);
  assert.equal(planProgress(all, 99), 1);
  assert.equal(planProgress(all, -1), 0);
  assert.equal(planProgress([], 3), 0);
});
