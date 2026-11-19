import { weekStart } from "./stats.ts";

/**
 * A month or a year of running, summed up to be shared.
 *
 * The run card says "look what I ran today"; this says "look what I ran this
 * month", which is the post people actually make at the end of one. Only
 * sums and a shape — no map, since a month of tracks is either one street
 * drawn thirty times or a scribble.
 */

export type RecapKind = "month" | "year";

export interface RecapPeriod {
  kind: RecapKind;
  year: number;
  /** 0-based, for a month. */
  month: number;
}

export interface Recap {
  period: RecapPeriod;
  distanceM: number;
  durationS: number;
  climbM: number;
  runs: number;
  /** Days with at least one run. */
  activeDays: number;
  longestM: number;
  /** One bar per week of the month, or per month of the year, in metres. */
  bars: number[];
  /** The same sums over the period before, for the comparison. */
  previousDistanceM: number;
}

interface RunLike {
  startedAt: number;
  distanceM: number;
  durationS: number;
  elevationGainM: number | null;
}

export function periodBounds(period: RecapPeriod): { from: number; to: number } {
  return period.kind === "year"
    ? { from: new Date(period.year, 0, 1).getTime(), to: new Date(period.year + 1, 0, 1).getTime() }
    : { from: new Date(period.year, period.month, 1).getTime(), to: new Date(period.year, period.month + 1, 1).getTime() };
}

export function previousPeriod(period: RecapPeriod): RecapPeriod {
  if (period.kind === "year") return { ...period, year: period.year - 1 };
  return period.month === 0
    ? { kind: "month", year: period.year - 1, month: 11 }
    : { kind: "month", year: period.year, month: period.month - 1 };
}

export function nextPeriod(period: RecapPeriod): RecapPeriod {
  if (period.kind === "year") return { ...period, year: period.year + 1 };
  return period.month === 11
    ? { kind: "month", year: period.year + 1, month: 0 }
    : { kind: "month", year: period.year, month: period.month + 1 };
}

export function recapOf(runs: readonly RunLike[], period: RecapPeriod): Recap {
  const { from, to } = periodBounds(period);
  const inside = runs.filter((run) => run.startedAt >= from && run.startedAt < to);
  const days = new Set(inside.map((run) => new Date(run.startedAt).toDateString()));

  let bars: number[];
  if (period.kind === "year") {
    bars = Array.from({ length: 12 }, () => 0);
    for (const run of inside) bars[new Date(run.startedAt).getMonth()] += run.distanceM;
  } else {
    // The weeks that touch the month, Monday first.
    const weeks: number[] = [];
    for (let day = from; day < to; day += 86_400_000) {
      const week = weekStart(day);
      if (!weeks.includes(week)) weeks.push(week);
    }
    bars = weeks.map(() => 0);
    for (const run of inside) bars[weeks.indexOf(weekStart(run.startedAt))] += run.distanceM;
  }

  const before = periodBounds(previousPeriod(period));
  return {
    period,
    distanceM: inside.reduce((sum, run) => sum + run.distanceM, 0),
    durationS: inside.reduce((sum, run) => sum + run.durationS, 0),
    climbM: inside.reduce((sum, run) => sum + (run.elevationGainM ?? 0), 0),
    runs: inside.length,
    activeDays: days.size,
    longestM: inside.reduce((longest, run) => Math.max(longest, run.distanceM), 0),
    bars,
    previousDistanceM: runs
      .filter((run) => run.startedAt >= before.from && run.startedAt < before.to)
      .reduce((sum, run) => sum + run.distanceM, 0),
  };
}

/** The change against the period before, in whole percent, or null with nothing to compare. */
export const changePercent = (recap: Recap): number | null =>
  recap.previousDistanceM > 0 ? Math.round((recap.distanceM / recap.previousDistanceM - 1) * 100) : null;
