import { formatDistance, formatDuration, formatPace } from "./format.ts";
import { goalAmount, measure, type WeeklyGoal } from "./goals.ts";
import { defineStrings, intlLocale, plural } from "./i18n.ts";
import { distanceUnit, paceUnit } from "./units.ts";

/**
 * What the home-screen widget shows, written out in full by the app.
 *
 * The widget is a separate program that cannot read the database, the
 * language or the units. So the app hands it finished sentences — in the
 * language the app speaks, in the units the runner chose — and the widget
 * only lays them out. The same reasoning as the Live Activity's.
 */
export interface WidgetSnapshot {
  thisWeek: string;
  distance: string;
  unit: string;
  /** "3 courses · 2:41:10". */
  detail: string;
  /** Share of the weekly goal covered, 0 to 1, or null without a goal. */
  goalShare: number | null;
  /** "6,6 km to go of 25 km", or null without a goal. */
  goalText: string | null;
  nextTitle: string;
  /** The next planned session, or null without a programme. */
  next: { when: string; name: string; detail: string } | null;
  /** Said when there is no programme to show. */
  noPlan: string;
  /** When this was written, in milliseconds. */
  updatedAt: number;
}

export interface WidgetInput {
  weekDistanceM: number;
  weekRuns: number;
  weekDurationS: number;
  /** Metres climbed this week, for a goal that counts climb. */
  weekClimbM?: number;
  goal: WeeklyGoal | null;
  next: { at: number; name: string; kind: string; targetSKm: number } | null;
  now: number;
}

const widgetWords = defineStrings({
  fr: {
    thisWeek: "Cette semaine",
    runs: (n: number) => plural(n, "course", "courses"),
    goalLeft: (left: string, goal: string) => `${left} pour tenir ${goal}`,
    goalDone: (goal: string) => `Objectif de ${goal} atteint`,
    nextTitle: "Prochaine séance",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    noPlan: "Aucun programme en cours",
  },
  en: {
    thisWeek: "This week",
    runs: (n: number) => plural(n, "run", "runs"),
    goalLeft: (left: string, goal: string) => `${left} to go of ${goal}`,
    goalDone: (goal: string) => `${goal} goal reached`,
    nextTitle: "Next session",
    today: "Today",
    tomorrow: "Tomorrow",
    noPlan: "No training plan",
  },
});

const DAY_MS = 86_400_000;
const midnight = (ts: number) => new Date(new Date(ts).toDateString()).getTime();

/** "Today", "Tomorrow", or the weekday, for when the next session falls. */
function whenLabel(at: number, now: number): string {
  const words = widgetWords();
  const days = Math.round((midnight(at) - midnight(now)) / DAY_MS);
  if (days <= 0) return words.today;
  if (days === 1) return words.tomorrow;
  const name = new Date(at).toLocaleDateString(intlLocale(), { weekday: "long" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function widgetSnapshot(input: WidgetInput): WidgetSnapshot {
  const words = widgetWords();
  const unit = distanceUnit();
  const goal = input.goal;
  const covered = goal === null ? 0 : measure(goal.kind, {
    distanceM: input.weekDistanceM, durationS: input.weekDurationS, climbM: input.weekClimbM ?? 0,
  });
  const detail = input.weekRuns > 0
    ? `${words.runs(input.weekRuns)} · ${formatDuration(input.weekDurationS)}`
    : words.runs(0);

  return {
    thisWeek: words.thisWeek,
    distance: formatDistance(input.weekDistanceM),
    unit,
    detail,
    goalShare: goal === null ? null : Math.min(1, covered / goal.target),
    goalText: goal === null
      ? null
      : covered >= goal.target
        ? words.goalDone(goalAmount(goal.kind, goal.target))
        : words.goalLeft(goalAmount(goal.kind, goal.target - covered), goalAmount(goal.kind, goal.target)),
    nextTitle: words.nextTitle,
    next: input.next === null
      ? null
      : {
        when: whenLabel(input.next.at, input.now),
        name: input.next.name,
        detail: `${input.next.kind} · ${formatPace(input.next.targetSKm)}${paceUnit()}`,
      },
    noPlan: words.noPlan,
    updatedAt: input.now,
  };
}
