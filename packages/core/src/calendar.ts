/**
 * The training log laid out as a calendar: a month to a grid, Monday first,
 * each day with what was run on it.
 *
 * A list says what was run; a calendar says when, which is the question a
 * training log exists to answer — how regular, how many rest days, where the
 * gaps are.
 */

export interface CalendarDay {
  /** Midnight, local. */
  start: number;
  /** Day of the month. */
  date: number;
}

export interface CalendarWeek {
  /** Monday's midnight, even when Monday falls in the previous month. */
  start: number;
  /** Seven cells, Monday to Sunday; null outside the month. */
  days: (CalendarDay | null)[];
}

/** The weeks of a month (0-based), Monday first. */
export function monthWeeks(year: number, month: number): CalendarWeek[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0).getDate();
  const weeks: CalendarWeek[] = [];
  for (let cell = -lead; cell < length; cell += 7) {
    const monday = new Date(year, month, 1 + cell);
    const days = Array.from({ length: 7 }, (_, i): CalendarDay | null => {
      const date = cell + i + 1;
      if (date < 1 || date > length) return null;
      return { start: new Date(year, month, date).getTime(), date };
    });
    weeks.push({ start: monday.getTime(), days });
  }
  return weeks;
}

export interface DayRuns {
  distanceM: number;
  /** The runs of that day, first run first. */
  runIds: number[];
}

/** What was run on each day, by that day's midnight. */
export function runsByDay(runs: readonly { id: number; startedAt: number; distanceM: number }[]): Map<number, DayRuns> {
  const days = new Map<number, DayRuns>();
  for (const run of [...runs].sort((a, b) => a.startedAt - b.startedAt)) {
    const date = new Date(run.startedAt);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const day = days.get(start) ?? { distanceM: 0, runIds: [] };
    day.distanceM += run.distanceM;
    day.runIds.push(run.id);
    days.set(start, day);
  }
  return days;
}

/**
 * The months to show, newest first: from this one back to the month of the
 * oldest run.
 */
export function monthsSince(oldest: number, now: number): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const from = new Date(oldest);
  let year = new Date(now).getFullYear();
  let month = new Date(now).getMonth();
  while (year > from.getFullYear() || (year === from.getFullYear() && month >= from.getMonth())) {
    months.push({ year, month });
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return months;
}

/**
 * How big a day's mark is, from 0.35 to 1 of its cell: by the day's
 * distance against the longest day shown, so a long run stands out and a
 * short one still shows.
 */
export const markScale = (distanceM: number, longestM: number): number =>
  longestM > 0 ? 0.35 + 0.65 * Math.sqrt(Math.min(1, distanceM / longestM)) : 0.35;
