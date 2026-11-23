// Extension spelled out: this module is loaded by a plain node test.
import type { ElevationProfile } from "./elevation.ts";
import type { RouteEstimate } from "./routeTime.ts";

/**
 * A race run to a plan: a goal time spread over the course, kilometre by
 * kilometre, so that the effort stays even while the pace follows the hills.
 *
 * PUBLISHED. The rule of thumb road coaches give for hills: each 1 % of
 * climb costs about 12–15 s a mile, and each 1 % of descent gives back a
 * little more than half of that (Daniels, Running Formula). At an ordinary
 * pace that is about 3 % of time per 1 % up, and 1.7 % per 1 % down.
 *
 * CHOSEN. The descent stops giving past 5 %: steeper than that, legs brake
 * rather than gain, and a plan that banks time on a steep drop asks a runner
 * to wreck their thighs for it. The climb is capped at 15 %, past which a
 * road is a wall and a walk.
 */

const UP_PER_GRADE = 3;
const DOWN_PER_GRADE = 1.7;
const STEEPEST_GAIN = -0.05;
const STEEPEST_COST = 0.15;

/** How much longer a metre at this grade takes than a flat one, for the same effort. */
export function hillFactor(grade: number): number {
  if (grade >= 0) return 1 + UP_PER_GRADE * Math.min(grade, STEEPEST_COST);
  return 1 + DOWN_PER_GRADE * Math.max(grade, STEEPEST_GAIN);
}

/** One stretch of the plan: a kilometre (or a mile), the last one shorter. */
export interface Split {
  fromM: number;
  toM: number;
  /** Average grade over it, as a fraction (0.02 is 2 %). */
  grade: number;
  /** The pace to run it at. */
  paceSKm: number;
  /** The clock when it ends. */
  atS: number;
}

/** A climb worth being told about before reaching it. */
export interface Climb {
  fromM: number;
  toM: number;
  gainM: number;
  grade: number;
  /** What it costs over running the same distance at the plan's flat pace. */
  costS: number;
}

export interface RacePlan {
  distanceM: number;
  goalS: number;
  /** The pace the same effort would give on the flat. */
  flatPaceSKm: number;
  splits: Split[];
  climbs: Climb[];
  /** Distance along the course and the planned clock there, to read the plan between splits. */
  marks: { distanceM: number; atS: number }[];
}

/** A rise worth a word: at least this steep, this long and this high. */
const CLIMB_GRADE = 0.02;
const CLIMB_SHORTEST_M = 200;
const CLIMB_LOWEST_M = 8;

/**
 * The course cut where the profile was measured, each piece with its grade.
 * Without a profile the course is one flat piece: the plan is then an even
 * pace, which is what it should be on a course nobody could measure.
 */
function pieces(profile: ElevationProfile | null, distanceM: number): { fromM: number; toM: number; grade: number }[] {
  if (!profile || profile.length < 2) return [{ fromM: 0, toM: distanceM, grade: 0 }];
  // The profile was measured along the drawn line: stretched onto the
  // course's own length, in case the two were measured a little apart.
  const scale = distanceM / (profile[profile.length - 1].distanceM || distanceM);
  const out: { fromM: number; toM: number; grade: number }[] = [];
  for (let i = 1; i < profile.length; i += 1) {
    const fromM = profile[i - 1].distanceM * scale;
    const toM = profile[i].distanceM * scale;
    if (toM <= fromM) continue;
    out.push({ fromM, toM, grade: (profile[i].value - profile[i - 1].value) / (toM - fromM) });
  }
  return out.length > 0 ? out : [{ fromM: 0, toM: distanceM, grade: 0 }];
}

/**
 * The plan for a goal time over a course: every metre given the time its
 * grade asks for, scaled so that the whole adds up to the goal.
 */
export function racePlan(
  distanceM: number,
  goalS: number,
  profile: ElevationProfile | null,
  splitM = 1000,
): RacePlan | null {
  if (!(distanceM > 0) || !(goalS > 0) || !(splitM > 0)) return null;
  const course = pieces(profile, distanceM);
  const weighted = course.reduce((sum, piece) => sum + (piece.toM - piece.fromM) * hillFactor(piece.grade), 0);
  /** Seconds a flat metre takes at the effort the goal asks. */
  const flatSM = goalS / weighted;

  const marks: { distanceM: number; atS: number }[] = [{ distanceM: 0, atS: 0 }];
  for (const piece of course) {
    const last = marks[marks.length - 1];
    marks.push({ distanceM: piece.toM, atS: last.atS + (piece.toM - piece.fromM) * hillFactor(piece.grade) * flatSM });
  }

  const plan: RacePlan = { distanceM, goalS, flatPaceSKm: flatSM * 1000, splits: [], climbs: [], marks };

  for (let fromM = 0; fromM < distanceM - 0.5; fromM += splitM) {
    const toM = Math.min(distanceM, fromM + splitM);
    const startS = plannedAt(plan, fromM);
    const endS = plannedAt(plan, toM);
    const climbed = course.reduce((sum, piece) => {
      const overlap = Math.min(piece.toM, toM) - Math.max(piece.fromM, fromM);
      return overlap > 0 ? sum + overlap * piece.grade : sum;
    }, 0);
    plan.splits.push({
      fromM, toM, grade: climbed / (toM - fromM), paceSKm: ((endS - startS) / (toM - fromM)) * 1000, atS: endS,
    });
  }

  // Neighbouring pieces that all rise make one climb.
  let open: Climb | null = null;
  const close = () => {
    if (open && open.toM - open.fromM >= CLIMB_SHORTEST_M && open.gainM >= CLIMB_LOWEST_M) {
      open.grade = open.gainM / (open.toM - open.fromM);
      plan.climbs.push(open);
    }
    open = null;
  };
  for (const piece of course) {
    if (piece.grade < CLIMB_GRADE) {
      close();
      continue;
    }
    const length = piece.toM - piece.fromM;
    open ??= { fromM: piece.fromM, toM: piece.fromM, gainM: 0, grade: 0, costS: 0 };
    open.toM = piece.toM;
    open.gainM += piece.grade * length;
    open.costS += (hillFactor(piece.grade) - 1) * length * flatSM;
  }
  close();
  for (const climb of plan.climbs) {
    climb.gainM = Math.round(climb.gainM);
    climb.costS = Math.round(climb.costS);
  }
  return plan;
}

/** The clock the plan has for this point of the course. */
export function plannedAt(plan: RacePlan, alongM: number): number {
  const { marks } = plan;
  if (alongM <= 0) return 0;
  const last = marks[marks.length - 1];
  if (alongM >= last.distanceM) return last.atS;
  let i = 1;
  while (i < marks.length - 1 && marks[i].distanceM < alongM) i += 1;
  const a = marks[i - 1];
  const b = marks[i];
  const share = b.distanceM > a.distanceM ? (alongM - a.distanceM) / (b.distanceM - a.distanceM) : 1;
  return a.atS + (b.atS - a.atS) * share;
}

/** The pace the plan asks for here: the split's, so it holds still for a kilometre. */
export function plannedPace(plan: RacePlan, alongM: number): number | null {
  const split = plan.splits.find((s) => alongM < s.toM) ?? plan.splits[plan.splits.length - 1];
  return split ? split.paceSKm : null;
}

/** Seconds ahead of the plan (positive) or behind it (negative), here and now. */
export function planGapS(plan: RacePlan, alongM: number, activeS: number): number {
  return plannedAt(plan, alongM) - activeS;
}

/** The next climb starting within `withinM`, or the one under way, with how far off it starts. */
export function climbAhead(plan: RacePlan, alongM: number, withinM = 300): { climb: Climb; inM: number } | null {
  for (const climb of plan.climbs) {
    if (alongM >= climb.toM) continue;
    const inM = climb.fromM - alongM;
    if (inM <= withinM) return { climb, inM: Math.max(0, inM) };
    return null;
  }
  return null;
}

export type GoalVerdict = "ambitious" | "realistic" | "cautious";

/**
 * What the goal is worth against how this runner has run lately: faster
 * than their good days, among their ordinary ones, or slower than those.
 */
export function goalVerdict(goalS: number, estimate: RouteEstimate | null): GoalVerdict | null {
  if (!estimate) return null;
  if (goalS < estimate.lowS) return "ambitious";
  if (goalS > estimate.highS) return "cautious";
  return "realistic";
}

/**
 * What the heat forecast for the start will cost, as a share of the time.
 *
 * PUBLISHED. Marathon times slow steadily as it warms past the low teens
 * (Ely et al., Medicine & Science in Sports & Exercise, 2007), and more for
 * slower runners, who are out in it longer.
 *
 * CHOSEN. One simple rule rather than their tables: 0.3 % of the time per
 * degree felt above 12 °C, up to 10 %. It is a warning to adjust the goal,
 * not a change made to the plan behind the runner's back.
 */
const HEAT_FROM_C = 12;
const HEAT_PER_C = 0.003;
const HEAT_MOST = 0.1;

export function heatCost(feelsLikeC: number): number {
  return Math.min(HEAT_MOST, Math.max(0, feelsLikeC - HEAT_FROM_C) * HEAT_PER_C);
}

/** Whole days from today to the race's day: 0 on the day itself. */
export function daysUntil(date: number, now: number): number {
  const day = (at: number) => {
    const d = new Date(at);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((day(date) - day(now)) / 86_400_000);
}

/**
 * What a runner decides about a race, as it travels between the phone and
 * the web: the goal, the day, the laps of a loop. The profile does not
 * travel, each side asks for its own. `changedAt` settles which side wins
 * when both have changed it: the later.
 */
export interface RaceSettings {
  goalS: number | null;
  date: number | null;
  laps: number;
  changedAt: number;
}

/** The most laps of a loop a race can be (as `MOST_LAPS` in route.ts). */
const MOST_RACE_LAPS = 20;

/** Race settings from anything sent, or null when it is not them. */
export function readRaceSettings(value: unknown): RaceSettings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const positive = (field: unknown) => (typeof field === "number" && Number.isFinite(field) && field > 0 ? field : null);
  const changedAt = positive(raw.changedAt);
  if (changedAt === null) return null;
  const laps = positive(raw.laps);
  return {
    goalS: positive(raw.goalS),
    date: positive(raw.date),
    laps: laps === null ? 1 : Math.max(1, Math.min(MOST_RACE_LAPS, Math.round(laps))),
    changedAt,
  };
}

/** Whether `incoming` should replace `held`: it is newer, or there was nothing. */
export const isNewerRace = (incoming: RaceSettings, held: RaceSettings | null): boolean =>
  held === null || incoming.changedAt > held.changedAt;
