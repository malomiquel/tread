/**
 * Training plans: a programme built backwards from a race date.
 *
 * Everything here is pure. A plan is a decision about the next three months
 * of someone's legs, so it has to be provable rather than merely plausible,
 * and that means no clock, no database and no navigation in this file.
 */

import type { Session, Step } from "./workout";

/** A race a plan can be built for. */
export type Goal = "fiveK" | "tenK" | "half" | "marathon";

export interface GoalSpec {
  id: Goal;
  /** Displayed. */
  name: string;
  distanceM: number;
  minWeeks: number;
  maxWeeks: number;
  /** Weeks of reduced load before the race, the last of which holds it. */
  taperWeeks: number;
  /** A first guess at a finish time, for someone with no history to go on. */
  defaultTimeS: number;
}

export const GOALS: GoalSpec[] = [
  { id: "fiveK", name: "5 km", distanceM: 5000, minWeeks: 6, maxWeeks: 12, taperWeeks: 1, defaultTimeS: 1500 },
  { id: "tenK", name: "10 km", distanceM: 10_000, minWeeks: 6, maxWeeks: 14, taperWeeks: 1, defaultTimeS: 3120 },
  { id: "half", name: "Semi-marathon", distanceM: 21_097, minWeeks: 8, maxWeeks: 16, taperWeeks: 2, defaultTimeS: 6900 },
  { id: "marathon", name: "Marathon", distanceM: 42_195, minWeeks: 12, maxWeeks: 20, taperWeeks: 3, defaultTimeS: 14_400 },
];

export const goalById = (id: string | null): GoalSpec | null =>
  GOALS.find((g) => g.id === id) ?? null;

/**
 * Riegel's exponent.
 *
 * The endurance term in T₂ = T₁ × (D₂/D₁)^n. At 1.06 it says that doubling
 * the distance costs a little more than doubling the time, which is what
 * every set of race tables agrees on and roughly what any runner finds out
 * the hard way. It holds well between 1500 m and the marathon and drifts
 * outside that, which is exactly the range this app offers.
 */
const RIEGEL_EXPONENT = 1.06;

/** What the same runner would be expected to do over another distance. */
export function equivalentTimeS(
  refDistanceM: number,
  refTimeS: number,
  targetDistanceM: number,
): number | null {
  if (![refDistanceM, refTimeS, targetDistanceM].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  return refTimeS * (targetDistanceM / refDistanceM) ** RIEGEL_EXPONENT;
}

/** Every pace a plan needs, in seconds per kilometre. */
export interface Paces {
  /** Conversational. Most of the plan is run here. */
  easy: number;
  /** A shade quicker than easy, held for an hour or more. */
  long: number;
  marathon: number;
  half: number;
  tenK: number;
  fiveK: number;
  /** Short repetitions, quicker than 5 km pace. */
  interval: number;
}

/**
 * The whole pace ladder, derived from one target performance.
 *
 * From the time you mean to run, not the time you have run. A plan trains
 * the runner you intend to be on race day — that is its entire purpose — and
 * asking for a recent result instead would train the one you already are.
 * The projection stays anchored in reality all the same, because the target
 * time is itself prefilled from your best run.
 */
export function pacesFrom(goalDistanceM: number, goalTimeS: number): Paces | null {
  const at = (distanceM: number): number | null => {
    const time = equivalentTimeS(goalDistanceM, goalTimeS, distanceM);
    return time === null ? null : (time / distanceM) * 1000;
  };
  const fiveK = at(5000);
  const tenK = at(10_000);
  const half = at(21_097);
  const marathon = at(42_195);
  if (fiveK === null || tenK === null || half === null || marathon === null) return null;

  return {
    // Easy running is defined off marathon pace rather than off any race
    // result, because that is the pace a body can repeat day after day. A
    // minute and a bit slower is the range every coaching tradition lands on,
    // arrived at from different directions.
    easy: marathon + 70,
    long: marathon + 45,
    marathon,
    half,
    tenK,
    fiveK,
    interval: fiveK - 8,
  };
}

/**
 * How many days a week the runner actually turns up.
 *
 * One and two are offered because they are what many people will really do,
 * and a programme built for a rhythm nobody holds is worth nothing. What
 * changes at low volume is not the plan's ambition but what it gives up: the
 * easy run goes first, then the quality session, because the long run is the
 * one that prepares a distance.
 */
export type PerWeek = 1 | 2 | 3 | 4;

/** Where a week sits in the arc of the plan. */
export type Phase = "base" | "build" | "peak" | "taper";

/** Displayed. */
export const PHASE_NAMES: Record<Phase, string> = {
  base: "fondation",
  build: "développement",
  peak: "spécifique",
  taper: "affûtage",
};

/** What a given session is for. */
export type Kind = "easy" | "long" | "interval" | "tempo" | "race";

/** Displayed. */
export const KIND_NAMES: Record<Kind, string> = {
  easy: "Footing",
  long: "Sortie longue",
  interval: "Fractionné",
  tempo: "Seuil",
  race: "Course",
};

export interface PlannedSession {
  /** Position in the programme, and the key a finished run is tied to. */
  order: number;
  /** 1-based. */
  week: number;
  phase: Phase;
  kind: Kind;
  session: Session;
  /** The pace to hold through the session's paced blocks, in s/km. */
  targetSKm: number;
}

export interface PlanInput {
  goal: Goal;
  weeks: number;
  perWeek: PerWeek;
  /** The finish time the plan trains for. */
  targetTimeS: number;
}

/** Weeks a plan may run for, given its race. */
export function clampWeeks(goal: GoalSpec, weeks: number): number {
  if (!Number.isFinite(weeks)) return goal.minWeeks;
  return Math.min(goal.maxWeeks, Math.max(goal.minWeeks, Math.round(weeks)));
}

/**
 * Which phase a week belongs to.
 *
 * The taper is counted back from the race, so it is never eaten by a short
 * plan: what shrinks when there are only eight weeks is the foundation, which
 * can be shortened, and not the sharpening, which cannot.
 */
export function phaseOfWeek(week: number, weeks: number, taperWeeks: number): Phase {
  if (week > weeks - taperWeeks) return "taper";
  const working = weeks - taperWeeks;
  if (week <= Math.round(working * 0.4)) return "base";
  if (week <= Math.round(working * 0.75)) return "build";
  return "peak";
}

/**
 * How hard a week leans, as a multiplier on its volume.
 *
 * Every fourth week steps back. Fitness is built while recovering from work,
 * not while doing it, and a plan that only ever climbs produces a runner who
 * is tired on race day rather than sharp. The taper then falls away steeply:
 * the last week before a race is almost nothing, and that is not a wasted
 * week, it is the point of one.
 */
export function loadOfWeek(week: number, weeks: number, taperWeeks: number): number {
  const phase = phaseOfWeek(week, weeks, taperWeeks);
  if (phase === "taper") {
    const left = weeks - week; // 0 on the race week itself
    return left === 0 ? 0.35 : 0.5 + 0.15 * left;
  }
  const working = weeks - taperWeeks;
  const climb = 0.7 + 0.3 * ((week - 1) / Math.max(1, working - 1));
  return week % 4 === 0 ? climb * 0.75 : climb;
}

const repeat = (times: number, ...block: Step[]): Step[] =>
  Array.from({ length: times }, () => block).flat();

/** "1 h 15", "45 min" — displayed. */
function durationName(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Longest run of the plan, in minutes, by race. */
const LONG_PEAK_MIN: Record<Goal, number> = {
  fiveK: 70,
  tenK: 85,
  half: 105,
  marathon: 150,
};

/** A session before it knows where in the programme it sits. */
type Unplaced = Omit<PlannedSession, "order" | "week" | "phase">;

function easySession(load: number, paces: Paces): Unplaced {
  const minutes = Math.round((35 + 20 * load) / 5) * 5;
  return {
    kind: "easy",
    targetSKm: paces.easy,
    session: {
      id: `easy-${minutes}`,
      name: `Footing ${durationName(minutes)}`,
      steps: [{ effort: "allure", seconds: minutes * 60 }],
    },
  };
}

function longSession(goal: Goal, load: number, paces: Paces): Unplaced {
  const minutes = Math.round((LONG_PEAK_MIN[goal] * (0.55 + 0.45 * load)) / 5) * 5;
  return {
    kind: "long",
    targetSKm: paces.long,
    session: {
      id: `long-${minutes}`,
      name: `Sortie longue ${durationName(minutes)}`,
      // One block, as the catalogue's long run already is: splitting it into
      // a warm-up and a cool-down announces three things where there is only
      // one to do.
      steps: [{ effort: "allure", seconds: minutes * 60 }],
    },
  };
}

function intervalSession(phase: Phase, load: number, paces: Paces): Unplaced {
  // Repetitions lengthen as the plan goes on: short and sharp to build speed
  // while there is time, longer and closer to race pace once there is not.
  const shape = phase === "base"
    ? { metres: 400, recovery: 200, base: 5 }
    : phase === "build"
      ? { metres: 800, recovery: 300, base: 4 }
      : { metres: 1000, recovery: 300, base: 4 };
  const reps = shape.base + Math.round(load * 2);

  return {
    kind: "interval",
    targetSKm: phase === "peak" ? paces.tenK : paces.interval,
    session: {
      id: `interval-${shape.metres}-${reps}`,
      name: `${reps} × ${shape.metres} m`,
      steps: [
        { effort: "échauffement", seconds: 900 },
        ...repeat(
          reps,
          { effort: "rapide", metres: shape.metres },
          { effort: "récupération", metres: shape.recovery },
        ),
        { effort: "retour au calme", seconds: 600 },
      ],
    },
  };
}

function tempoSession(phase: Phase, load: number, paces: Paces): Unplaced {
  // Threshold work consolidates: fewer, longer blocks as race day nears,
  // until it is simply the pace, held for a stretch.
  const blocks = phase === "peak" ? 2 : 3;
  const minutes = Math.round(phase === "peak" ? 12 + 8 * load : 6 + 4 * load);

  return {
    kind: "tempo",
    targetSKm: phase === "base" ? paces.tenK : paces.half,
    session: {
      id: `tempo-${blocks}-${minutes}`,
      name: `${blocks} × ${minutes} min au seuil`,
      steps: [
        { effort: "échauffement", seconds: 900 },
        ...repeat(
          blocks,
          { effort: "allure", seconds: minutes * 60 },
          { effort: "récupération", seconds: 180 },
        ),
        { effort: "retour au calme", seconds: 600 },
      ],
    },
  };
}

function racePace(goal: Goal, paces: Paces): number {
  if (goal === "fiveK") return paces.fiveK;
  if (goal === "tenK") return paces.tenK;
  if (goal === "half") return paces.half;
  return paces.marathon;
}

function raceSession(goal: GoalSpec, paces: Paces): Unplaced {
  return {
    kind: "race",
    targetSKm: racePace(goal.id, paces),
    session: {
      id: `race-${goal.id}`,
      name: goal.name,
      steps: [{ effort: "allure", metres: goal.distanceM }],
    },
  };
}

/**
 * What an ordinary week holds, by volume.
 *
 * The order of sacrifice is deliberate. At four there is room for everything.
 * At three the second quality session goes, so repetitions and threshold
 * alternate week by week. At two the easy run goes, since a run whose only
 * job is to add mileage is the first thing that stops earning its place. At
 * one only the long run remains, interrupted every third week by a quality
 * session — without it a runner loses all their speed, and with too much of
 * it they never build the endurance the race asks for.
 */
function weekBody(
  perWeek: PerWeek,
  week: number,
  phase: Phase,
  load: number,
  paces: Paces,
  goal: Goal,
): Unplaced[] {
  const quality = week % 2 === 1
    ? intervalSession(phase, load, paces)
    : tempoSession(phase, load, paces);
  const long = longSession(goal, load, paces);

  if (perWeek === 1) return [week % 3 === 0 ? quality : long];
  if (perWeek === 2) return [quality, long];
  if (perWeek === 3) return [quality, easySession(load, paces), long];
  return [
    intervalSession(phase, load, paces),
    easySession(load, paces),
    tempoSession(phase, load, paces),
    long,
  ];
}

/**
 * The programme, as an ordered list of sessions without dates.
 *
 * Dates are deliberately absent. They belong to `schedule`, which lays this
 * list onto a calendar afresh every time it is asked — that is what lets a
 * missed week slide instead of piling up as a column of failures.
 */
export function buildPlan(input: PlanInput): PlannedSession[] {
  const goal = goalById(input.goal);
  if (!goal) return [];
  const paces = pacesFrom(goal.distanceM, input.targetTimeS);
  if (!paces) return [];

  const weeks = clampWeeks(goal, input.weeks);
  const sessions: PlannedSession[] = [];
  let order = 0;

  for (let week = 1; week <= weeks; week += 1) {
    const phase = phaseOfWeek(week, weeks, goal.taperWeeks);
    const load = loadOfWeek(week, weeks, goal.taperWeeks);

    // Race week is its own shape at any volume: a couple of short runs to
    // stay loose, then the race. At one session a week there is nothing to
    // stay loose from, so it is the race alone.
    const body: Unplaced[] = week === weeks
      ? [
          ...Array.from({ length: Math.min(2, input.perWeek - 1) }, () => easySession(load, paces)),
          raceSession(goal, paces),
        ]
      : weekBody(input.perWeek, week, phase, load, paces, goal.id);

    for (const part of body) {
      order += 1;
      sessions.push({ order, week, phase, ...part });
    }
  }
  return sessions;
}

/** Projected finish, for the line under the goal. */
export function projectedTimeS(goal: GoalSpec, paces: Paces): number {
  return (racePace(goal.id, paces) * goal.distanceM) / 1000;
}

const DAY_MS = 86_400_000;

/** Midnight local, so two days compare as days and not as instants. */
export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Whole days from one to the other, by calendar and not by elapsed time. */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / DAY_MS);
}

/**
 * The days a plan proposes, as `Date.getDay` numbers, before anyone says
 * otherwise.
 *
 * Sunday is the fixed point at every volume, because that is where the long
 * run goes. Tuesday joins it, then Thursday, then Friday. Monday and Saturday
 * are left alone even at four: one of them is where a missed session actually
 * gets made up, and a plan that fills every day leaves nowhere to put a life.
 *
 * All of it is only a suggestion. A runner who works Sundays needs a
 * programme that knows it, and a plan landing on days somebody cannot train
 * is a plan they stop opening.
 */
export const SLOT_DAYS: Record<PerWeek, number[]> = {
  1: [0],
  2: [2, 0],
  3: [2, 4, 0],
  4: [2, 4, 5, 0],
};

/**
 * Chosen days, made safe to schedule against.
 *
 * Stored days come back from a database and from older versions of this app,
 * so they are checked rather than trusted: anything that is not the right
 * count of real, distinct weekdays falls back to the suggestion.
 */
export function normaliseDays(days: readonly number[] | null | undefined, perWeek: PerWeek): number[] {
  const clean = [...new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return clean.length === perWeek ? clean.sort((a, b) => a - b) : SLOT_DAYS[perWeek];
}

/** Every training day between two dates, race day excluded. */
export function slotDates(fromMs: number, raceMs: number, days: readonly number[]): number[] {
  const wanted = new Set(days);
  const race = startOfDay(raceMs);
  const slots: number[] = [];
  for (let day = startOfDay(fromMs); day < race; day += DAY_MS) {
    if (wanted.has(new Date(day).getDay())) slots.push(day);
  }
  return slots;
}

export interface Done {
  runId: number;
  at: number;
}

export interface ScheduledSession extends PlannedSession {
  /** Midnight of the day it falls on. */
  at: number;
  runId: number | null;
}

/**
 * Lay the sessions still to do onto the days still left.
 *
 * The sliding rule, and the reason no date is ever stored. Whatever remains
 * is packed against the race rather than counted forward from the start, so
 * the sharpening always ends up where it has to be — the days before the
 * race — however much of the plan went by untouched. When more sessions
 * remain than there are days to hold them, the earliest are dropped rather
 * than crammed in: missing the foundation costs some of your ceiling, while
 * skipping the sharpening costs you the race itself.
 */
export function schedule(
  sessions: PlannedSession[],
  done: Map<number, Done>,
  todayMs: number,
  raceMs: number,
  days: readonly number[],
): ScheduledSession[] {
  const slots = slotDates(todayMs, raceMs, days);
  const remaining = sessions.filter((s) => !done.has(s.order) && s.kind !== "race");
  const kept = remaining.slice(Math.max(0, remaining.length - slots.length));
  const first = slots.length - kept.length;

  const placed = new Map<number, number>();
  kept.forEach((session, i) => placed.set(session.order, slots[first + i]));

  const out: ScheduledSession[] = [];
  for (const session of sessions) {
    const finished = done.get(session.order);
    if (finished) {
      out.push({ ...session, at: startOfDay(finished.at), runId: finished.runId });
      continue;
    }
    if (session.kind === "race") {
      out.push({ ...session, at: startOfDay(raceMs), runId: null });
      continue;
    }
    const at = placed.get(session.order);
    // Absent means dropped: more was missed than the remaining days can hold.
    if (at !== undefined) out.push({ ...session, at, runId: null });
  }
  return out.sort((a, b) => a.at - b.at || a.order - b.order);
}

/** The next thing to do, or null once the race is behind you. */
export function nextSession(scheduled: ScheduledSession[]): ScheduledSession | null {
  return scheduled.find((s) => s.runId === null) ?? null;
}

/** How much of the programme is behind you, 0 to 1. */
export function planProgress(sessions: PlannedSession[], doneCount: number): number {
  if (sessions.length === 0) return 0;
  return Math.min(1, Math.max(0, doneCount) / sessions.length);
}
