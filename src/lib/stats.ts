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

/** The runs of one calendar month, with what they add up to. */
export interface MonthGroup {
  /** "2026-09": sortable, and stable as a list key. */
  key: string;
  /** Midnight on the first of the month, local time. */
  start: number;
  runs: Run[];
  distanceM: number;
  durationS: number;
}

const monthKey = (ts: number): string => {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Runs gathered by the month they were run in, newest month first and the
 * runs inside each in the order they came.
 *
 * A history is read in months — "how did September go" — and a plain list
 * of a hundred rows gives no place to stop and take stock.
 */
export function byMonth(runs: Run[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const run of runs) {
    const key = monthKey(run.startedAt);
    let group = groups.get(key);
    if (!group) {
      const date = new Date(run.startedAt);
      group = {
        key,
        start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
        runs: [],
        distanceM: 0,
        durationS: 0,
      };
      groups.set(key, group);
    }
    group.runs.push(run);
    group.distanceM += run.distanceM;
    group.durationS += run.durationS;
  }
  return [...groups.values()].sort((a, b) => b.start - a.start);
}

/** This month and the one before, for the banner over the history. */
export interface MonthSummary {
  current: { distanceM: number; durationS: number; runs: number; start: number };
  previous: { distanceM: number; start: number };
}

export function monthSummary(runs: Run[], now = Date.now()): MonthSummary {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
  const groups = new Map(byMonth(runs).map((group) => [group.key, group]));
  const current = groups.get(monthKey(start));
  const previous = groups.get(monthKey(previousStart));
  return {
    current: {
      distanceM: current?.distanceM ?? 0,
      durationS: current?.durationS ?? 0,
      runs: current?.runs.length ?? 0,
      start,
    },
    previous: { distanceM: previous?.distanceM ?? 0, start: previousStart },
  };
}

/** Weeks in a row that counted, now and at best. */
export interface Streak {
  /** Up to this week; 0 when the last full week did not count. */
  current: number;
  /** The longest there has ever been. */
  best: number;
  /** What made a week count: the weekly goal met, or simply a run. */
  kind: "goal" | "active";
}

const DAY_MS = 86_400_000;

/**
 * How many weeks in a row have counted.
 *
 * With a weekly goal, a week counts when the goal was met; without one, when
 * there was a run at all — a habit is worth keeping before anyone sets a
 * figure on it. Measured against today's goal, since the app does not keep
 * the old ones: raising it can shorten a streak, which is what raising a
 * goal means.
 *
 * The week under way never breaks a streak: on a Tuesday it has barely
 * begun. It adds to it once it counts.
 */
export function weekStreak(runs: readonly Run[], goalM: number | null, now = Date.now()): Streak {
  const kind = goalM !== null && goalM > 0 ? "goal" : "active";
  const totals = new Map<number, number>();
  for (const run of runs) {
    const week = weekStart(run.startedAt);
    totals.set(week, (totals.get(week) ?? 0) + run.distanceM);
  }
  const counts = (week: number): boolean => {
    const covered = totals.get(week);
    if (covered === undefined) return false;
    return kind === "goal" ? covered >= (goalM ?? 0) : true;
  };
  // A day before a Monday is always in the week before, whatever the clocks
  // did in between; seven days of milliseconds is not, across a time change.
  const before = (week: number): number => weekStart(week - DAY_MS);

  const thisWeek = weekStart(now);
  let current = 0;
  let week = counts(thisWeek) ? thisWeek : before(thisWeek);
  while (counts(week)) {
    current += 1;
    week = before(week);
  }

  let best = 0;
  const counted = [...totals.keys()].filter((start) => start <= thisWeek && counts(start)).sort((a, b) => a - b);
  let run = 0;
  counted.forEach((start, i) => {
    run = i > 0 && before(start) === counted[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best, kind };
}
