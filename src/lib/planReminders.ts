import { activePlan, planDone, recentExertions } from "./db";
import { lastKnownCoords } from "./location";
import { easeFactor, schedule, startOfDay, KIND_NAMES } from "./plan";
import { plannedReminders, syncReminders, type Plannable } from "./reminders";
import { formatPace } from "./format";
import { getSettings } from "./settings";
import { forecastDays, forecastOn, forecastSentence, type Forecast } from "./weather";
import { eased, sessionMinutes } from "./workout";

/**
 * Rebuild the pending reminders from the programme as it stands.
 *
 * This is deliberately not a hook and belongs to no screen. The setting that
 * turns reminders on lives in the profile and the sessions they are about
 * live in the plan, and a runner who flicks the switch in one place and never
 * opens the other would otherwise have asked to be reminded and heard
 * nothing. Both call this instead.
 *
 * Everything it reads is read afresh: the plan slides, sessions get ticked
 * off, the weather changes its mind. Silent throughout — a reminder that
 * could not be scheduled is one that does not arrive, and there is nothing
 * anybody could do about it from here.
 */
export async function refreshReminders(): Promise<void> {
  const when = getSettings().reminder;
  if (when === "off") {
    await syncReminders([]);
    return;
  }

  try {
    const plan = await activePlan();
    // No programme, nothing to be reminded of — and anything still pending
    // from an old one has to go.
    if (!plan) {
      await syncReminders([]);
      return;
    }

    const [done, recent] = await Promise.all([planDone(plan.id), recentExertions()]);
    const factor = easeFactor(recent);
    const sessions = schedule(plan.sessions, done, startOfDay(Date.now()), plan.raceAt, plan.days)
      // Eased exactly as the screen eases it. A notification announcing eight
      // repetitions of a session the plan has quietly cut to six would be the
      // app disagreeing with itself in public.
      .map((entry) => (factor < 1 && entry.runId === null && entry.kind !== "race"
        ? { ...entry, session: eased(entry.session, factor) }
        : entry));

    const forecasts = await weatherAhead();
    const plannable: Plannable[] = sessions.map((entry) => {
      const forecast = forecastOn(forecasts, entry.at);
      return {
        at: entry.at,
        name: entry.session.name,
        kind: KIND_NAMES[entry.kind],
        minutes: sessionMinutes(entry.session),
        pace: formatPace(entry.targetSKm),
        weather: forecast === null ? null : forecastSentence(forecast),
        settled: entry.settled,
      };
    });

    await syncReminders(plannedReminders(plannable, when));
  } catch {
    /* the next visit to either screen will try again */
  }
}

/**
 * The days ahead, where the phone last knew itself to be.
 *
 * Never prompts: a permission dialog raised by turning a reminder on would be
 * asking for the wrong thing at the wrong moment. Without a position the
 * reminders simply go out without their weather, which is what they said
 * before there was any.
 */
async function weatherAhead(): Promise<ReadonlyMap<string, Forecast>> {
  const coords = await lastKnownCoords();
  if (coords === null) return new Map();
  return forecastDays(coords.lat, coords.lng);
}
