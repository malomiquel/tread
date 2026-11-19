import { activityName, type ActivityType } from "@tread/core/activity";
import { formatDistance, formatPace, formatSpeed, autoName } from "@tread/core/format";
import { distanceUnit, paceUnit, speedUnit } from "@tread/core/units";

/**
 * How an outing is named and measured in a line, on every page alike.
 * Client side only: it reads the language and units set by `<Locale>`.
 */
export const outingName = (outing: { name: string | null; startedAt: number; activity: ActivityType }): string =>
  outing.name ?? autoName(outing.startedAt, outing.activity === "ride");

/** Its rate: a speed on a ride, a pace otherwise. */
export function outingRate(outing: { activity: ActivityType; distanceM: number; durationS: number; avgPaceSKm: number | null }): { value: string; unit: string } {
  if (outing.activity === "ride") {
    return { value: formatSpeed(outing.durationS > 0 ? outing.distanceM / outing.durationS : 0), unit: speedUnit() };
  }
  return { value: formatPace(outing.avgPaceSKm), unit: paceUnit() };
}

export const distance = (metres: number): { value: string; unit: string } => ({ value: formatDistance(metres), unit: distanceUnit() });

/** The type in words, for a chip, except on a plain run, which needs none. */
export const typeChip = (activity: ActivityType): string | null => (activity === "run" ? null : activityName(activity));
