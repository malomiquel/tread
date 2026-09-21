import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlan, clampWeeks, daysBetween, enduranceExponent, equivalentTimeS, GOALS, goalById,
  loadOfWeek, pacesFrom,
  longCeilingMin, longestReachedMin, LONG_PEAK_MIN, longMinutes, normaliseDays, phaseOfWeek, planProgress, projectedTimeS, schedule, SLOT_DAYS, slotDates,
  startOfDay,
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

test("time stretches faster than distance", () => {
  const halfTime = equivalentTimeS(10_000, 2400, 21_097)!;
  // Forty minutes over ten kilometres is a little over an hour and a half.
  assert.ok(halfTime > 5300 && halfTime < 5600, `${halfTime}`);
  // Never merely proportional: twice the distance costs more than twice.
  assert.ok(halfTime > 2400 * 2.1097);
});

test("the further the race, the more it costs to get there", () => {
  assert.equal(enduranceExponent(5000), 1.06);
  assert.equal(enduranceExponent(42_195), 1.15);
  // Below and above the anchors it holds rather than running away.
  assert.equal(enduranceExponent(1500), 1.06);
  assert.equal(enduranceExponent(100_000), 1.15);

  let previous = 0;
  for (const metres of [3000, 5000, 8000, 10_000, 15_000, 21_097, 30_000, 42_195]) {
    const exponent = enduranceExponent(metres);
    assert.ok(exponent >= previous, `${metres} went backwards`);
    previous = exponent;
  }
});

test("the flat exponent was optimistic, and measurably so", () => {
  // The defect this replaced: a forty minute ten kilometre runner was handed
  // a three hour four marathon, and three months of training paces to match.
  const marathon = equivalentTimeS(10_000, 2400, 42_195)!;
  const flat = 2400 * 4.2195 ** 1.06;
  assert.ok(marathon > flat + 20 * 60, `only ${Math.round((marathon - flat) / 60)} min slower`);
  // And still inside what the papers describe rather than off on its own.
  assert.ok(marathon < 2400 * 4.2195 ** 1.2);
});

test("a projection can be walked back to where it came from", () => {
  // The pace ladder projects one target out to four distances. If the
  // conversion were not reversible those four would describe four different
  // runners.
  for (const [from, to] of [[10_000, 42_195], [21_097, 5000], [5000, 21_097]] as const) {
    const there = equivalentTimeS(from, 2400, to)!;
    const back = equivalentTimeS(to, there, from)!;
    assert.ok(Math.abs(back - 2400) < 0.001, `${from} to ${to} came back as ${back}`);
  }
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
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 60 });
  assert.equal(sessions.length, 36);
  assert.equal(sessions.at(-1)!.kind, "race");
  assert.equal(sessions.filter((s) => s.kind === "race").length, 1);
  assert.deepEqual(sessions.map((s) => s.order), sessions.map((_, i) => i + 1));
});

test("four days a week is four sessions a week", () => {
  const sessions = buildPlan({ goal: "half", weeks: 10, perWeek: 4, targetTimeS: 5400, longestMin: 60 });
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

test("two days a week keeps the long run and the quality session", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 2, targetTimeS: 5400, longestMin: 60 });
  // Eleven ordinary weeks of two, then one short run and the race.
  assert.equal(sessions.length, 11 * 2 + 2);
  assert.equal(sessions.filter((s) => s.kind === "easy" && s.week < 12).length, 0);
  for (let week = 1; week < 12; week += 1) {
    const kinds = sessions.filter((s) => s.week === week).map((s) => s.kind);
    assert.ok(kinds.includes("long"), `week ${week} lost its long run`);
    assert.equal(kinds.length, 2);
  }
});

test("one day a week is the long run, with speed kept alive every third", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 1, targetTimeS: 5400, longestMin: 60 });
  assert.equal(sessions.length, 11 + 1);
  assert.equal(sessions.at(-1)!.kind, "race");
  // Nothing to stay loose from at this volume, so race week is the race alone.
  assert.equal(sessions.filter((s) => s.week === 12).length, 1);

  const longs = sessions.filter((s) => s.kind === "long").length;
  const quality = sessions.filter((s) => s.kind === "interval" || s.kind === "tempo").length;
  assert.ok(longs > quality * 2, "the long run stopped being the backbone");
  assert.ok(quality > 0, "a plan with no quality session at all");
});

test("every volume has a day to run it on, and sunday is always one", () => {
  for (const perWeek of [1, 2, 3, 4] as const) {
    assert.equal(SLOT_DAYS[perWeek].length, perWeek);
    assert.ok(SLOT_DAYS[perWeek].includes(0), `${perWeek} a week has no sunday`);
    assert.equal(new Set(SLOT_DAYS[perWeek]).size, perWeek);
  }
});

test("chosen days are honoured, and nonsense falls back to the suggestion", () => {
  // Someone who works Sundays and trains Monday and Wednesday.
  const mine = [1, 3];
  const slots = slotDates(MONDAY, RACE, mine);
  assert.ok(slots.every((day) => mine.includes(new Date(day).getDay())));
  assert.ok(slots.length > 20);

  assert.deepEqual(normaliseDays([5, 1], 2), [1, 5]);
  // Wrong count, duplicates, and days that are not days.
  assert.deepEqual(normaliseDays([1], 2), SLOT_DAYS[2]);
  assert.deepEqual(normaliseDays([1, 1], 2), SLOT_DAYS[2]);
  assert.deepEqual(normaliseDays([1, 9], 2), SLOT_DAYS[2]);
  assert.deepEqual(normaliseDays(null, 3), SLOT_DAYS[3]);
});

test("a plan scheduled on its own days still ends on the race", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 2, targetTimeS: 5400, longestMin: 60 });
  const scheduled = schedule(sessions, new Map(), MONDAY, RACE, [1, 3]);
  assert.equal(scheduled.at(-1)!.kind, "race");
  assert.equal(scheduled.at(-1)!.at, startOfDay(RACE));
  assert.ok(scheduled.filter((s) => s.kind !== "race")
    .every((s) => [1, 3].includes(new Date(s.at).getDay())));
});

test("a plan at any volume still fits the calendar it was built for", () => {
  for (const perWeek of [1, 2, 3, 4] as const) {
    const sessions = buildPlan({ goal: "half", weeks: 12, perWeek, targetTimeS: 5400, longestMin: 60 });
    const scheduled = schedule(sessions, new Map(), MONDAY, RACE, SLOT_DAYS[perWeek]);
    assert.equal(scheduled.length, sessions.length, `${perWeek} a week lost sessions`);
    assert.equal(scheduled.at(-1)!.kind, "race");
  }
});

test("three days a week alternates the quality session instead of dropping one", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 60 });
  const quality = sessions.filter((s) => s.kind === "interval" || s.kind === "tempo");
  assert.ok(quality.some((s) => s.kind === "interval"));
  assert.ok(quality.some((s) => s.kind === "tempo"));
  // One a week, every week but the last.
  assert.equal(quality.length, 11);
});

test("the first long run is the one the runner can already do", () => {
  // The defect this replaced: a half marathon handed a ninety minute run in
  // week one to somebody whose longest was thirty.
  for (const start of [20, 30, 45, 75]) {
    assert.equal(longMinutes("half", 1, 12, 2, start, 105), start);
  }
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 2, targetTimeS: 5400, longestMin: 30 });
  const first = sessions.find((s) => s.kind === "long")!;
  assert.equal((first.session.steps[0].seconds ?? 0) / 60, 30);
});

test("the long run never grows faster than a body adapts", () => {
  const start = 30;
  let previous = start;
  for (let week = 2; week <= 10; week += 1) {
    const minutes = longMinutes("half", week, 12, 2, start, 105);
    // Allowing for rounding to five minutes on top of the eight percent.
    assert.ok(minutes <= previous * 1.1 + 5, `week ${week}: ${previous} to ${minutes}`);
    previous = Math.max(previous, minutes);
  }
});

test("a long run is capped by the race, however much time there is", () => {
  const huge = longMinutes("half", 10, 16, 2, 200, 105);
  assert.ok(huge <= LONG_PEAK_MIN.half, `${huge}`);
  assert.ok(longMinutes("marathon", 16, 20, 3, 200, 240) <= LONG_PEAK_MIN.marathon);
});

test("the race is never run before the race", () => {
  // A ninety minute half: the longest training run must stay clear of it.
  const ceiling = longCeilingMin("half", 90);
  assert.ok(ceiling < 90, `${ceiling}`);
  // Four hours for a marathon stops around three, which is where every
  // serious plan stops.
  assert.ok(longCeilingMin("marathon", 240) <= 180);

  for (const [goal, raceMin] of [["half", 90], ["marathon", 240]] as const) {
    const weeks = goal === "half" ? 16 : 20;
    const taper = goalById(goal)!.taperWeeks;
    // Even a runner who could already do far more is held below the race.
    assert.ok(longestReachedMin(goal, weeks, taper, 300, raceMin) < raceMin);
  }
});

test("a short race may be out-run in training, because the effort is nothing alike", () => {
  // Fifty minutes over ten kilometres, and eighty five minutes easy is fine.
  assert.equal(longCeilingMin("tenK", 50), LONG_PEAK_MIN.tenK);
  assert.equal(longCeilingMin("fiveK", 25), LONG_PEAK_MIN.fiveK);
});

test("what the plan reaches depends on where it started", () => {
  const fromLittle = longestReachedMin("half", 12, 2, 25, 105);
  const fromMore = longestReachedMin("half", 12, 2, 60, 105);
  assert.ok(fromLittle < fromMore);
  assert.ok(fromLittle >= 25, "the plan went backwards");
  assert.ok(fromMore <= longCeilingMin("half", 105));
});

test("a beginner is never handed an hour of easy running either", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 25 });
  const easy = sessions.filter((s) => s.kind === "easy");
  assert.ok(easy.length > 0);
  for (const session of easy) {
    assert.ok((session.session.steps[0].seconds ?? 0) / 60 <= 30, "an easy run out of proportion");
  }
});

test("the long run grows and then gives way", () => {
  const sessions = buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 60 });
  const minutes = sessions
    .filter((s) => s.kind === "long")
    .map((s) => (s.session.steps[0].seconds ?? 0) / 60);
  assert.ok(minutes.at(-1)! < Math.max(...minutes), "the last long run was the longest");
  assert.ok(Math.max(...minutes) <= LONG_PEAK_MIN.half);
});

test("a plan is clamped to what its race can carry", () => {
  assert.equal(clampWeeks(half, 2), half.minWeeks);
  assert.equal(clampWeeks(half, 40), half.maxWeeks);
  assert.equal(clampWeeks(half, Number.NaN), half.minWeeks);
  for (const goal of GOALS) assert.ok(goal.minWeeks < goal.maxWeeks);
});

test("an impossible target yields no plan rather than a broken one", () => {
  assert.deepEqual(buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 0, longestMin: 60 }), []);
});

test("training days are the days the plan says, and never race day", () => {
  const slots = slotDates(MONDAY, RACE, SLOT_DAYS[3]);
  assert.ok(slots.every((day) => [2, 4, 0].includes(new Date(day).getDay())));
  assert.ok(slots.every((day) => day < startOfDay(RACE)));
  assert.equal(slots.length, 35);
  assert.deepEqual(slots, [...slots].sort((a, b) => a - b));
  assert.equal(new Set(slots).size, slots.length);
});

const plan = (): PlannedSession[] =>
  buildPlan({ goal: "half", weeks: 12, perWeek: 3, targetTimeS: 5400, longestMin: 60 });

test("a plan started on time fits its calendar exactly", () => {
  const scheduled = schedule(plan(), new Map(), MONDAY, RACE, SLOT_DAYS[3]);
  assert.equal(scheduled.length, 36, "sessions were dropped from a plan that fits");
  assert.equal(scheduled.at(-1)!.kind, "race");
  assert.equal(scheduled.at(-1)!.at, startOfDay(RACE));
});

test("what is left slides towards the race instead of piling up behind", () => {
  // Two weeks gone by, nothing done.
  const late = new Date(2026, 0, 19).getTime();
  const scheduled = schedule(plan(), new Map(), late, RACE, SLOT_DAYS[3]);

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
  const scheduled = schedule(plan(), new Map(), veryLate, RACE, SLOT_DAYS[3]);
  const weeks = scheduled.map((s) => s.week);
  assert.ok(Math.min(...weeks) > 6, `kept week ${Math.min(...weeks)}`);
  assert.equal(scheduled.at(-1)!.kind, "race");
});

test("a finished session keeps the day it was actually run", () => {
  const ranAt = new Date(2026, 0, 6, 18, 30).getTime();
  const done = new Map<number, Done>([[1, { runId: 42, at: ranAt }]]);
  const scheduled = schedule(plan(), done, MONDAY, RACE, SLOT_DAYS[3]);

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
