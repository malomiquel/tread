import { elevationFrom, elevationUrl, sampleLine, type Elevation } from "@tread/core/elevation";
import { racePlan, type RacePlan } from "@tread/core/raceDay";
import { drawnLine, type StoredRoute } from "@tread/core/route";
import { unitLengthM } from "@tread/core/units";
import { deleteSettings, readSettings, writeSetting } from "./db";

/**
 * A race planned on a route: the goal time chosen for it, and the route's
 * profile, kept on the phone.
 *
 * The profile is asked for once, when the plan is first opened, and kept:
 * on race morning the phone may be in a crowd with no signal, and the plan
 * has to be there all the same.
 */
export interface StoredRacePlan {
  goalS: number | null;
  elevation: Elevation | null;
}

const key = (routeId: number) => `racePlan.${routeId}`;

export async function readRacePlan(routeId: number): Promise<StoredRacePlan> {
  const raw = (await readSettings())[key(routeId)];
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredRacePlan>) : {};
    return {
      goalS: typeof parsed.goalS === "number" && parsed.goalS > 0 ? parsed.goalS : null,
      elevation: parsed.elevation && Array.isArray(parsed.elevation.profile) ? parsed.elevation : null,
    };
  } catch {
    return { goalS: null, elevation: null };
  }
}

export async function writeRacePlan(routeId: number, plan: StoredRacePlan): Promise<void> {
  await writeSetting(key(routeId), JSON.stringify(plan));
}

export async function forgetRacePlan(routeId: number): Promise<void> {
  await deleteSettings([key(routeId)]);
}

/** The route's climb and profile, asked of the elevation service. Null offline. */
export async function fetchElevation(route: StoredRoute): Promise<Elevation | null> {
  const samples = sampleLine(drawnLine(route));
  if (samples.length < 2) return null;
  try {
    const response = await fetch(elevationUrl(samples));
    if (!response.ok) return null;
    return elevationFrom(samples, await response.json());
  } catch {
    return null;
  }
}

/**
 * The plan to run on this route, or null when no goal has been set. Split
 * in the runner's own unit, so a split ends where the voice says one has.
 */
export async function activeRacePlan(route: StoredRoute): Promise<RacePlan | null> {
  const stored = await readRacePlan(route.id);
  if (stored.goalS === null) return null;
  return racePlan(route.distanceM, stored.goalS, stored.elevation?.profile ?? null, unitLengthM());
}
