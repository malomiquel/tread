import type { ActivityType } from "./activity.ts";
import { effortKm } from "./geo.ts";
import { equivalentTimeS } from "./plan.ts";
import { PREDICTION_WINDOW_MS } from "./predictions.ts";

/**
 * How long a route should take this runner, from how they have run lately.
 *
 * Each recent run is carried over to the route: both are put in effort
 * kilometres (a kilometre per 100 m of climb on top of the distance, as for
 * trails), and the run's time projected onto the route's with the same
 * endurance curve the plans use, so a 5 km run does not promise a 20 km
 * route at the same pace. The middle of those projections is the estimate,
 * the middle half of them its range: a runner's ordinary day, not their best.
 */

export interface RouteRun {
  startedAt: number;
  activity: ActivityType;
  distanceM: number;
  durationS: number;
  elevationGainM: number | null;
}

export interface RouteEstimate {
  timeS: number;
  /** The estimate per kilometre of the route's distance. */
  paceSKm: number;
  /** The middle half of the runs' projections. */
  lowS: number;
  highS: number;
  /** How many runs it was made from. */
  runs: number;
}

/** The runs worth asking: on foot and running, long enough to say something. */
const RUNNING: readonly ActivityType[] = ["run", "trail", "treadmill"];
const SHORTEST_M = 2000;
/** The most recent, at most: enough to steady it, few enough to stay current. */
const MOST = 10;

const quantile = (sorted: readonly number[], share: number): number => {
  const at = (sorted.length - 1) * share;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};

export function estimateRouteTime(
  runs: readonly RouteRun[],
  distanceM: number,
  gainM: number,
  now = Date.now(),
): RouteEstimate | null {
  if (!(distanceM > 0)) return null;
  const target = effortKm(distanceM, Math.max(0, gainM)) * 1000;
  const recent = runs
    .filter((run) => RUNNING.includes(run.activity) && run.distanceM >= SHORTEST_M && run.durationS > 0)
    .filter((run) => run.startedAt <= now && now - run.startedAt <= PREDICTION_WINDOW_MS)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MOST);
  const projected = recent
    .map((run) => equivalentTimeS(effortKm(run.distanceM, run.elevationGainM ?? 0) * 1000, run.durationS, target))
    .filter((time): time is number => time !== null)
    .sort((a, b) => a - b);
  if (projected.length === 0) return null;
  const timeS = Math.round(quantile(projected, 0.5));
  return {
    timeS,
    paceSKm: timeS / (distanceM / 1000),
    lowS: Math.round(quantile(projected, 0.25)),
    highS: Math.round(quantile(projected, 0.75)),
    runs: projected.length,
  };
}
