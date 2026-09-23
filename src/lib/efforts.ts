import { distanceM, segments, type TrackPoint } from "./geo.ts";
import { defineStrings } from "./i18n.ts";

/**
 * The fastest stretch of each classic distance inside a run.
 *
 * A 10 km run holds a 5 km, a mile and a kilometre, and the fastest of each
 * is a record whether or not the run was meant as one. Found with a window
 * sliding along the run's cumulative distance, its start interpolated between
 * two fixes rather than snapped to either, so a best kilometre is not a few
 * seconds out because the GPS happened to report late. Paused time is left
 * out: the window moves through active time only.
 */

/** The distances looked for, in metres. */
export const EFFORT_DISTANCES = [400, 1000, 1609.344, 5000, 10_000, 21_097.5, 42_195] as const;

/** Best efforts by distance key ("400", "1000", "1609"…), in seconds. */
export type BestEfforts = Record<string, number>;

/** The key a distance is stored under: whole metres. */
export const effortKey = (metres: number): string => String(Math.round(metres));

export function bestEfforts(
  points: readonly TrackPoint[],
  distances: readonly number[] = EFFORT_DISTANCES,
): BestEfforts {
  // Cumulative distance and active time at every fix. Crossing into a new
  // segment adds neither: a pause is neither run nor timed.
  const covered: number[] = [];
  const elapsed: number[] = [];
  let metres = 0;
  let seconds = 0;
  for (const segment of segments([...points])) {
    segment.forEach((point, i) => {
      if (i > 0) {
        metres += distanceM(segment[i - 1], point);
        seconds += (point.ts - segment[i - 1].ts) / 1000;
      }
      covered.push(metres);
      elapsed.push(seconds);
    });
  }

  const result: BestEfforts = {};
  for (const target of distances) {
    if (metres < target) continue;
    let best = Infinity;
    let from = 0;
    for (let to = 1; to < covered.length; to += 1) {
      const startAt = covered[to] - target;
      if (startAt < 0) continue;
      // The window's start lies between fix `from` and fix `from + 1`.
      while (from + 1 < to && covered[from + 1] <= startAt) from += 1;
      const span = covered[from + 1] - covered[from];
      const share = span > 0 ? (startAt - covered[from]) / span : 0;
      const startedS = elapsed[from] + share * (elapsed[from + 1] - elapsed[from]);
      const took = elapsed[to] - startedS;
      if (took > 0 && took < best) best = took;
    }
    if (Number.isFinite(best)) result[effortKey(target)] = Math.round(best * 10) / 10;
  }
  return result;
}

/** A stored set of efforts, or null for anything unreadable. */
export function parseEfforts(raw: string | null): BestEfforts | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0),
    );
  } catch {
    return null;
  }
}

const effortNames = defineStrings({
  fr: {
    "400": "400 m", "1000": "1 km", "1609": "1 mile", "5000": "5 km",
    "10000": "10 km", "21098": "Semi-marathon", "42195": "Marathon",
  } as Record<string, string>,
  en: {
    "400": "400 m", "1000": "1 km", "1609": "1 mile", "5000": "5K",
    "10000": "10K", "21098": "Half marathon", "42195": "Marathon",
  },
});

/** How a distance key is said. */
export const effortName = (key: string): string => effortNames()[key] ?? `${key} m`;

/** The keys in order of distance, for anything that lists them. */
export const EFFORT_KEYS = EFFORT_DISTANCES.map(effortKey);
