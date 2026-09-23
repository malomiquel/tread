import { ExtensionStorage } from "@bacons/apple-targets";
import { Platform } from "react-native";
import { activePlan, listRuns, planDone, recentExertions } from "./db";
import { easeFactor, kindName, nextSession, schedule, startOfDay } from "./plan";
import { weeklyGoal } from "./settings";
import { weekTotals } from "./stats";
import { widgetSnapshot, type WidgetSnapshot } from "./widgetSnapshot";
import { eased, sessionName } from "./workout";

/**
 * The app group the widget reads from. Declared in app.json for the app and
 * in the widget's target config; the three have to agree, byte for byte.
 */
export const APP_GROUP = "group.com.malomiquel.tread";

/** The key the widget reads its summary under. Same string in HomeWidget.swift. */
const SUMMARY_KEY = "summary";

const storage = new ExtensionStorage(APP_GROUP);

/**
 * What the widget should show right now, read from the database and the
 * settings. Both have to be loaded already: the app does it at launch, the
 * Android widget task (src/lib/widgetTask.ts) does it before calling this.
 */
export async function currentWidgetSnapshot(now = Date.now()): Promise<WidgetSnapshot> {
  const runs = await listRuns();
  const week = weekTotals(runs, now);

  let next: { at: number; name: string; kind: string; targetSKm: number } | null = null;
  const plan = await activePlan();
  if (plan) {
    const [done, recent] = await Promise.all([planDone(plan.id), recentExertions()]);
    const factor = easeFactor(recent);
    // Eased exactly as the plan screen eases it, so the widget never names
    // a session the programme has already lightened.
    const scheduled = schedule(plan.sessions, done, startOfDay(now), plan.raceAt, plan.days)
      .map((entry) => (factor < 1 && entry.runId === null && entry.kind !== "race"
        ? { ...entry, session: eased(entry.session, factor) }
        : entry));
    const upcoming = nextSession(scheduled);
    if (upcoming) {
      next = {
        at: upcoming.at,
        name: sessionName(upcoming.session),
        kind: kindName(upcoming.kind),
        targetSKm: upcoming.targetSKm,
      };
    }
  }

  return widgetSnapshot({
    weekDistanceM: week.distanceM,
    weekRuns: week.runs,
    weekDurationS: week.durationS,
    weekClimbM: week.climbM,
    goal: weeklyGoal(),
    next,
    now,
  });
}

/**
 * Redraw every copy of the Android widget on the home screen.
 *
 * The library is loaded here rather than at the top of the file: without its
 * native half (Expo Go) it throws as soon as it is imported, and this module
 * is imported by the root layout.
 */
async function drawAndroidWidget(snapshot: WidgetSnapshot): Promise<void> {
  const [{ requestWidgetUpdate }, { WEEK_WIDGET, weekWidget }] = await Promise.all([
    import("react-native-android-widget"),
    import("@/components/WeekWidget"),
  ]);
  await requestWidgetUpdate({
    widgetName: WEEK_WIDGET,
    renderWidget: (info) => weekWidget(snapshot, info.width),
  });
}

/**
 * Write what the home-screen widget shows, and ask it to redraw.
 *
 * Called when the app starts, when a run is finished and whenever the app
 * goes to the background — which is the moment anything the widget shows
 * could have changed: a goal set, a programme created, a language switched.
 * Where there is no widget to talk to (Expo Go) nothing happens.
 */
export async function refreshHomeWidget(now = Date.now()): Promise<void> {
  try {
    const snapshot = await currentWidgetSnapshot(now);
    if (Platform.OS === "android") {
      await drawAndroidWidget(snapshot);
    } else {
      storage.set(SUMMARY_KEY, JSON.stringify(snapshot));
      ExtensionStorage.reloadWidget();
    }
  } catch {
    /* the widget keeps what it last showed */
  }
}
