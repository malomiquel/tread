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

/** How long ago, in plain French, for a run's start time. */
export function timeAgo(ts: number, now = Date.now()): string {
  const minutes = Math.round((now - ts) / 60_000);
  if (minutes < 2) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "il y a une semaine" : `il y a ${weeks} semaines`;
}
