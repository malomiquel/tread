/**
 * Reminders for the sessions a programme has planned.
 *
 * A plan that only exists inside an app is a plan you have to remember to go
 * and look at, which is the same as no plan at the moment it matters. A line
 * on the lock screen the evening before is the whole difference between a
 * programme somebody follows and one somebody admires.
 *
 * Everything above the last section is arithmetic and wording, and is tested
 * without a phone. Only the bottom of this file knows notifications exist.
 */

/** When the reminder lands, relative to the session it is about. */
export type ReminderWhen = "off" | "evening" | "morning";

/**
 * The session a reminder is about, in parts rather than as a finished line.
 *
 * In parts because a notification is set differently from a row in a list: a
 * screen can carry a chain of middots, a lock screen reads better as two
 * short sentences. Handing over the pieces lets this file decide that, and
 * lets the decision be tested.
 */
export interface Plannable {
  /** Midnight of the day it falls on. */
  at: number;
  /** "6 × 400 m" — what the session is called. */
  name: string;
  /** "Intervalles", "Sortie longue" — what kind of session it is. */
  kind: string;
  /** How long it is meant to take. */
  minutes: number;
  /** The pace to hold, already formatted — `4'30"`. */
  pace: string;
  /** The day's weather as a sentence, or null when nothing is known. */
  weather: string | null;
  /** Already run or already passed: nothing left to remind anybody about. */
  settled: boolean;
}

export interface Reminder {
  /** A stable name, so rescheduling replaces rather than duplicates. */
  id: string;
  at: number;
  title: string;
  body: string;
}

/** Seven in the evening the day before: late enough to be home, early enough to act on. */
const EVENING_HOUR = 19;
/** Half past six: before the morning it is about, and before most alarms. */
const MORNING_HOUR = 6.5;

/**
 * How many reminders are ever pending at once.
 *
 * iOS keeps sixty-four scheduled notifications per app and silently drops the
 * rest, so a programme of ninety sessions has to be rationed. Ten is a
 * fortnight of running at worst, and the list is rebuilt every time the plan
 * screen is opened — which is far more often than a fortnight.
 */
export const MAX_PENDING = 10;

/** The moment a session's reminder should land, or null when it never should. */
export function reminderAt(sessionAt: number, when: ReminderWhen): number | null {
  if (when === "off") return null;
  const at = new Date(sessionAt);
  at.setHours(0, 0, 0, 0);
  if (when === "evening") {
    at.setDate(at.getDate() - 1);
    at.setHours(EVENING_HOUR, 0, 0, 0);
  } else {
    at.setHours(Math.floor(MORNING_HOUR), (MORNING_HOUR % 1) * 60, 0, 0);
  }
  return at.getTime();
}

/**
 * What the notification says, in three tiers.
 *
 * The day and the session's name are the title, because a notification is
 * read in the half-second before it is dismissed and those are the only two
 * things that decide whether it gets opened. What the session is comes next,
 * as a sentence rather than a chain of middots. The weather goes on its own
 * line below: it is a different kind of fact — nothing anybody chose — and
 * folding it into the same line made every reminder look like a readout.
 *
 * The line break earns its place on both platforms: iOS shows the first line
 * collapsed and the rest on a long press, so the session survives the glance
 * and the weather rewards the look.
 */
export function reminderText(session: Plannable, when: ReminderWhen): { title: string; body: string } {
  const lead = when === "evening" ? "Demain" : "Aujourd'hui";
  const work = `${session.kind}, ${session.minutes} min, allure ${session.pace}/km`;
  return {
    title: `${lead} · ${session.name}`,
    body: session.weather ? `${work}\n${session.weather}` : work,
  };
}

/**
 * The reminders to have pending, for a programme as it stands.
 *
 * Anything already settled is skipped, and so is anything whose moment has
 * been and gone: a notification scheduled for last tuesday at seven either
 * fires at once or never, and both are worse than silence.
 */
export function plannedReminders(
  sessions: Plannable[], when: ReminderWhen, now = Date.now(), limit = MAX_PENDING,
): Reminder[] {
  if (when === "off") return [];
  return sessions
    .filter((session) => !session.settled)
    .map((session) => ({ session, at: reminderAt(session.at, when) }))
    .filter((planned): planned is { session: Plannable; at: number } =>
      planned.at !== null && planned.at > now)
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map(({ session, at }) => ({
      // The day, not the session's place in the programme: a plan that slides
      // by a week would otherwise reschedule everything under new names and
      // leave the old ones pending alongside.
      id: `session-${new Date(at).toISOString().slice(0, 10)}-${when}`,
      at,
      ...reminderText(session, when),
    }));
}

/** A stored preference, or off. Anything unrecognised means off. */
export function readReminderWhen(raw: string | undefined): ReminderWhen {
  return raw === "evening" || raw === "morning" ? raw : "off";
}

/** How the choice reads on screen. French, because it is read there. */
export const REMINDER_NAMES: Record<ReminderWhen, string> = {
  off: "Aucun",
  evening: "La veille au soir",
  morning: "Le matin même",
};

/**
 * Notifications sit behind a lazy require, for the same reason HealthKit
 * does: the module binds to a native counterpart that a build made before it
 * was added simply does not have, and a plain import would take the whole
 * screen down rather than the one feature it belongs to.
 */
type Api = typeof import("expo-notifications");

let loaded: Api | null | undefined;

function notifications(): Api | null {
  if (loaded !== undefined) return loaded;
  try {
    // Nothing above this line touches React Native, which is what lets the
    // arithmetic in this file be tested by plain node.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("expo-notifications") as Api;
    // Without this, a reminder that fires while the app happens to be open is
    // delivered silently and never seen — which reads exactly like a reminder
    // that was never scheduled.
    loaded.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    loaded = null;
  }
  return loaded;
}

/**
 * Ask for permission to interrupt somebody, and say whether it was given.
 *
 * Asked only when a reminder is actually turned on, never at launch: the one
 * thing that guarantees a refusal is a notification prompt on a screen nobody
 * asked a question on.
 */
export async function askReminders(): Promise<boolean> {
  const api = notifications();
  if (!api) return false;
  try {
    const existing = await api.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const asked = await api.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Make the pending notifications match the programme, whatever they were.
 *
 * Everything is cancelled and rewritten rather than reconciled. A plan
 * reshapes itself constantly — a missed week slides every date, a hard
 * session lightens the next one, a run ticks one off — so working out which
 * of yesterday's notifications are still right would cost more than simply
 * asking again, and would be wrong in ways nobody could see from inside the
 * app.
 *
 * Silent throughout. A reminder that could not be scheduled is a reminder
 * that does not arrive, and there is nothing a runner could do about it from
 * here.
 */
export async function syncReminders(reminders: Reminder[]): Promise<void> {
  const api = notifications();
  if (!api) return;
  try {
    await api.cancelAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
      await api.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body },
        trigger: { type: api.SchedulableTriggerInputTypes.DATE, date: new Date(reminder.at) },
      });
    }
  } catch {
    /* no reminders this time; the next visit to the plan will try again */
  }
}

/**
 * How long the test notification takes to arrive. Long enough to put the
 * phone down, short enough not to wonder whether it worked.
 */
export const TEST_DELAY_S = 5;

/**
 * Fire one reminder now, to prove the whole chain works.
 *
 * Temporary, and meant to be deleted: it exists because a feature whose only
 * proof arrives at seven o'clock tomorrow evening is a feature nobody can
 * check. It writes the same shape of notification a real session would, so
 * what turns up on the lock screen is what will turn up for real.
 *
 * Deliberately not part of the scheduled list: it is scheduled on its own and
 * never cancels the reminders that matter.
 */
export async function testReminder(): Promise<boolean> {
  const api = notifications();
  if (!api) return false;
  try {
    await api.scheduleNotificationAsync({
      identifier: "test-reminder",
      content: reminderText(
        {
          at: Date.now(),
          name: "6 × 400 m",
          kind: "Intervalles",
          minutes: 42,
          pace: "4'30\"",
          weather: "Couvert, 8° à 12°, vent 12 km/h",
          settled: false,
        },
        "evening",
      ),
      trigger: {
        type: api.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: TEST_DELAY_S,
        repeats: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}
