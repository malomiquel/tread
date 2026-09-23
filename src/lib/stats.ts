import { defineStrings } from "./i18n.ts";
import type { Run } from "./db";

/** Monday, midnight, of the week containing that instant. */
export function weekStart(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

export interface WeekTotals {
  distanceM: number;
  durationS: number;
  runs: number;
}

/** Totals for the week containing `reference`, defaulting to the current one. */
export function weekTotals(runs: Run[], reference = Date.now()): WeekTotals {
  const start = weekStart(reference);
  return runs
    .filter((run) => run.startedAt >= start)
    .reduce<WeekTotals>(
      (totals, run) => ({
        distanceM: totals.distanceM + run.distanceM,
        durationS: totals.durationS + run.durationS,
        runs: totals.runs + 1,
      }),
      { distanceM: 0, durationS: 0, runs: 0 },
    );
}

const agoWords = defineStrings({
  fr: {
    now: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    yesterday: "hier",
    days: (n: number) => `il y a ${n} jours`,
    week: "il y a une semaine",
    weeks: (n: number) => `il y a ${n} semaines`,
  },
  en: {
    now: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    yesterday: "yesterday",
    days: (n: number) => `${n} days ago`,
    week: "a week ago",
    weeks: (n: number) => `${n} weeks ago`,
  },
});

/** How long ago, in plain words, for a run's start time. */
export function timeAgo(ts: number, now = Date.now()): string {
  const words = agoWords();
  const minutes = Math.round((now - ts) / 60_000);
  if (minutes < 2) return words.now;
  if (minutes < 60) return words.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return words.hours(hours);
  const days = Math.round(hours / 24);
  if (days === 1) return words.yesterday;
  if (days < 7) return words.days(days);
  const weeks = Math.round(days / 7);
  return weeks === 1 ? words.week : words.weeks(weeks);
}


/**
 * Kilometres a week, averaged over the recent past.
 *
 * Weeks without a run count as zero, deliberately. The figure is meant to
 * describe a habit, not a best effort, and averaging only over the weeks
 * somebody turned up would flatter everyone who trains in bursts — which is
 * the exact population it matters most not to flatter.
 *
 * The current week is left out: it is almost always partial, and a Monday
 * reading would say the habit had collapsed.
 */
export function weeklyVolumeKm(runs: Run[], nowMs = Date.now(), weeks = 8): number | null {
  if (weeks < 1) return null;
  const thisWeek = weekStart(nowMs);
  const from = thisWeek - weeks * 7 * 86_400_000;
  const counted = runs.filter((run) => run.startedAt >= from && run.startedAt < thisWeek);
  if (counted.length === 0) return null;
  const metres = counted.reduce((total, run) => total + run.distanceM, 0);
  return metres / 1000 / weeks;
}

/** Where a week stands against the distance it was meant to cover. */
export interface GoalProgress {
  /** Filled share of the bar, never past one however good the week was. */
  share: number;
  /** The same thing uncapped, for the figure beside it. */
  percent: number;
  /** What is left to cover, in metres, and zero once the goal is met. */
  remainingM: number;
  reached: boolean;
}

/**
 * A week measured against its goal.
 *
 * The bar stops at full and the percentage does not, which is the honest
 * division of labour between the two: a bar that overflows is a broken bar,
 * and a week at 130 % is worth saying out loud.
 */
export function goalProgress(distanceM: number, goalM: number | null): GoalProgress | null {
  if (goalM === null || !Number.isFinite(goalM) || goalM <= 0) return null;
  const covered = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  const ratio = covered / goalM;
  return {
    share: Math.min(1, ratio),
    percent: Math.round(ratio * 100),
    remainingM: Math.max(0, goalM - covered),
    reached: covered >= goalM,
  };
}

/**
 * A weekly goal worth suggesting to somebody who has never set one.
 *
 * Their own recent average, rounded to the nearest five kilometres and never
 * below five. Proposed rather than imposed, and taken from what they already
 * do rather than from what a table says they should: a first goal that is a
 * stranger's number is the one that gets dismissed.
 */
export function suggestedWeeklyGoalM(runs: Run[], nowMs = Date.now()): number {
  const average = weeklyVolumeKm(runs, nowMs) ?? 0;
  return Math.max(5, Math.round(average / 5) * 5) * 1000;
}
