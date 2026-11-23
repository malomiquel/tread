import { elevationFrom, elevationUrl, sampleLine, type Elevation } from "@tread/core/elevation";
import { racePlan, type RacePlan } from "@tread/core/raceDay";
import { drawnLine, type StoredRoute } from "@tread/core/route";
import { unitLengthM } from "@tread/core/units";
import { deleteSettings, listRoutes, readSettings, writeSetting } from "./db";

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
  /**
   * When the gun goes, local time, or null for a plan with no race day. A
   * route with a date to come is a race: it is listed apart, counted down
   * to, and told its weather once the forecast reaches it.
   */
  date: number | null;
}

const key = (routeId: number) => `racePlan.${routeId}`;

export async function readRacePlan(routeId: number): Promise<StoredRacePlan> {
  return parsePlan((await readSettings())[key(routeId)]);
}

function parsePlan(raw: string | undefined): StoredRacePlan {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredRacePlan>) : {};
    return {
      goalS: typeof parsed.goalS === "number" && parsed.goalS > 0 ? parsed.goalS : null,
      elevation: parsed.elevation && Array.isArray(parsed.elevation.profile) ? parsed.elevation : null,
      date: typeof parsed.date === "number" && parsed.date > 0 ? parsed.date : null,
    };
  } catch {
    return { goalS: null, elevation: null, date: null };
  }
}

/** Change part of a route's plan, keeping the rest as it is. */
export async function updateRacePlan(routeId: number, change: Partial<StoredRacePlan>): Promise<StoredRacePlan> {
  const next = { ...(await readRacePlan(routeId)), ...change };
  await writeRacePlan(routeId, next);
  return next;
}

export interface UpcomingRace {
  route: StoredRoute;
  plan: StoredRacePlan & { date: number };
}

/**
 * The races still to run, soonest first: every route whose plan has a date
 * from today on. A race is kept through its whole day, so it is still there
 * on the morning, and after the start.
 */
export async function upcomingRaces(now = Date.now()): Promise<UpcomingRace[]> {
  const settings = await readSettings();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const routes = await listRoutes();
  return routes
    .map((route) => ({ route, plan: parsePlan(settings[key(route.id)]) }))
    .filter((race): race is UpcomingRace => race.plan.date !== null && race.plan.date >= today.getTime())
    .sort((a, b) => a.plan.date - b.plan.date);
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
