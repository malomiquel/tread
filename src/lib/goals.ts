import { formatDistance, formatDuration, formatElevation } from "./format.ts";
import { defineStrings } from "./i18n.ts";
import { distanceUnit, elevationUnit, getUnitSystem, toDistanceUnits, unitLengthM } from "./units.ts";

/**
 * A week's goal, in whatever the runner counts in.
 *
 * Distance suits most people. Time suits a trail runner, whose kilometres
 * vary by the hour with the ground, and anybody building up from nothing,
 * for whom "three hours this week" is kinder than a distance. Climb is the
 * mountain runner's week. One at a time: a week measured three ways at once
 * is a week that is always failing at something.
 */
export type GoalKind = "distance" | "time" | "climb";

export const GOAL_KINDS: readonly GoalKind[] = ["distance", "time", "climb"];

export interface WeeklyGoal {
  kind: GoalKind;
  /** Metres, seconds or metres climbed. */
  target: number;
}

/** What a week covered, every way it can be counted. */
export interface Covered {
  distanceM: number;
  durationS: number;
  climbM: number;
}

export const readGoalKind = (raw: string | undefined): GoalKind =>
  GOAL_KINDS.find((kind) => kind === raw) ?? "distance";

/** The goal in force, from the stored settings, or null for none. */
export function goalFromSettings(settings: {
  goalKind: GoalKind; weeklyGoalM: number | null; weeklyGoalS: number | null; weeklyGoalClimbM: number | null;
}): WeeklyGoal | null {
  const target = settings.goalKind === "time"
    ? settings.weeklyGoalS
    : settings.goalKind === "climb" ? settings.weeklyGoalClimbM : settings.weeklyGoalM;
  return target !== null && target > 0 ? { kind: settings.goalKind, target } : null;
}

/** What a week covered, in the goal's own measure. */
export const measure = (kind: GoalKind, covered: Covered): number =>
  kind === "time" ? covered.durationS : kind === "climb" ? covered.climbM : covered.distanceM;

/** "3 h 30" or "45 min": a week's time, said the way it is aimed at. */
export function hoursText(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** An amount in the goal's measure, with its unit: "25 km", "3 h 30", "400 m". */
export function goalAmount(kind: GoalKind, value: number): string {
  if (kind === "time") return hoursText(value);
  if (kind === "climb") return `${formatElevation(value)} ${elevationUnit()}`;
  // Goals move a whole unit at a time, so they read without a decimal.
  const units = toDistanceUnits(value);
  const whole = Math.abs(units - Math.round(units)) < 0.01;
  return `${whole ? String(Math.round(units)) : formatDistance(value)} ${distanceUnit()}`;
}

/** One step of the goal: a kilometre or a mile, a quarter of an hour, fifty metres or a hundred feet. */
export function goalStep(kind: GoalKind): number {
  if (kind === "time") return 15 * 60;
  if (kind === "climb") return getUnitSystem() === "metric" ? 50 : 30.48;
  return unitLengthM();
}

export const GOAL_MAX: Record<GoalKind, number> = { distance: 300_000, time: 30 * 3600, climb: 20_000 };

/** A first figure for a kind never set: what the runner would recognise. */
export const GOAL_START: Record<GoalKind, number> = { distance: 20_000, time: 3 * 3600, climb: 500 };

const kindWords = defineStrings({
  fr: { distance: "Distance", time: "Temps", climb: "Dénivelé" } as Record<GoalKind, string>,
  en: { distance: "Distance", time: "Time", climb: "Climb" },
});

export const goalKindName = (kind: GoalKind): string => kindWords()[kind];
