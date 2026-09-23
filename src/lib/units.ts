import { useSyncExternalStore } from "react";

/**
 * Kilometres or miles.
 *
 * Everything the app stores is metric — metres, seconds per kilometre,
 * degrees Celsius — and stays so: a unit is how a figure is shown, not what
 * it is. The conversion happens at the last moment, in the formatters, so a
 * runner who switches units sees every run they ever recorded in the new
 * ones, and nothing on disk changes.
 *
 * Free of anything native, like the language: which system the phone uses is
 * decided at startup and handed in here, and the formatters stay testable in
 * plain Node, where everything is metric.
 */

export type UnitSystem = "metric" | "imperial";

export const METRES_PER_MILE = 1609.344;
export const FEET_PER_METRE = 3.28084;
const MPH_PER_MS = 2.236936;
const KMH_PER_MS = 3.6;

let current: UnitSystem = "metric";
const listeners = new Set<() => void>();

export const getUnitSystem = (): UnitSystem => current;

export function setUnitSystem(next: UnitSystem): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeUnits(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The unit system, for a component that has to redraw when it changes. */
export function useUnitSystem(): UnitSystem {
  return useSyncExternalStore(subscribeUnits, getUnitSystem, getUnitSystem);
}

const metric = () => current === "metric";

/**
 * The length of one distance unit, in metres: what a split measures, what
 * the voice announces, what a goal steps by.
 */
export const unitLengthM = (): number => (metric() ? 1000 : METRES_PER_MILE);

/** "km" or "mi". */
export const distanceUnit = (): string => (metric() ? "km" : "mi");

/** "/km" or "/mi". */
export const paceUnit = (): string => `/${distanceUnit()}`;

/** "m" or "ft", for climbing. */
export const elevationUnit = (): string => (metric() ? "m" : "ft");

/** "km/h" or "mph". */
export const speedUnit = (): string => (metric() ? "km/h" : "mph");

/** Metres into the distance unit. */
export const toDistanceUnits = (metres: number): number => metres / unitLengthM();

/** The distance unit back into metres. */
export const fromDistanceUnits = (units: number): number => units * unitLengthM();

/** Seconds per kilometre into seconds per distance unit. */
export const toPaceUnits = (secPerKm: number): number => secPerKm * (unitLengthM() / 1000);

/** Metres of climb into the elevation unit. */
export const toElevationUnits = (metres: number): number => (metric() ? metres : metres * FEET_PER_METRE);

/** Metres per second into the speed unit. */
export const toSpeedUnits = (metresPerSecond: number): number =>
  metresPerSecond * (metric() ? KMH_PER_MS : MPH_PER_MS);

/** Kilometres per hour, as the weather reports wind, into the speed unit. */
export const windToSpeedUnits = (kmh: number): number => (metric() ? kmh : kmh / 1.609344);

/** Degrees Celsius into the temperature scale that goes with the system. */
export const toTemperatureUnits = (celsius: number): number => (metric() ? celsius : celsius * 1.8 + 32);
