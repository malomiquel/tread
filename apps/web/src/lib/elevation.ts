import { distanceM } from "@tread/core/geo";
import type { RoutePoint } from "@tread/core/route";

/**
 * A route's climb and its profile, from the heights of points along it.
 *
 * Routes carry no altitude: they are drawn, not recorded. The heights come
 * from Open-Meteo's elevation service (free, no key, open to the browser),
 * asked about at most a hundred points spread evenly along the line, one
 * request, and kept for the session so a route redrawn to the same line is
 * not asked about twice.
 */
export interface Elevation {
  gainM: number;
  lossM: number;
  /** Height against distance along the route, for the profile chart. */
  profile: { distanceM: number; value: number }[];
}

const SERVICE = "https://api.open-meteo.com/v1/elevation";
const SAMPLES = 100;
/** Rises smaller than this are the model's noise, not a hill. */
const STEP_M = 2;

const cache = new Map<string, Elevation>();

/** Up to `count` points evenly spaced along the line, with how far along each is. */
export function sampleLine(line: readonly RoutePoint[], count = SAMPLES): { point: RoutePoint; distanceM: number }[] {
  if (line.length < 2) return [];
  const along: number[] = [0];
  for (let i = 1; i < line.length; i += 1) along.push(along[i - 1] + distanceM(line[i - 1], line[i]));
  const total = along[along.length - 1];
  if (total === 0) return [];
  const samples: { point: RoutePoint; distanceM: number }[] = [];
  let segment = 1;
  for (let k = 0; k < count; k += 1) {
    const target = (total * k) / (count - 1);
    while (segment < line.length - 1 && along[segment] < target) segment += 1;
    const start = along[segment - 1];
    const span = along[segment] - start || 1;
    const t = Math.min(1, Math.max(0, (target - start) / span));
    const a = line[segment - 1];
    const b = line[segment];
    samples.push({ point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }, distanceM: target });
  }
  return samples;
}

/** Climb and descent from a series of heights, ignoring rises under a couple of metres. */
export function climbOf(heights: readonly number[]): { gainM: number; lossM: number } {
  let gainM = 0;
  let lossM = 0;
  let base = heights[0] ?? 0;
  for (const height of heights.slice(1)) {
    const change = height - base;
    if (change >= STEP_M) {
      gainM += change;
      base = height;
    } else if (change <= -STEP_M) {
      lossM -= change;
      base = height;
    }
  }
  return { gainM: Math.round(gainM), lossM: Math.round(lossM) };
}

/** The elevation of a line, or null when the service could not answer. */
export async function elevationOf(line: readonly RoutePoint[]): Promise<Elevation | null> {
  const samples = sampleLine(line);
  if (samples.length < 2) return null;
  const key = samples.map(({ point }) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join(";");
  const known = cache.get(key);
  if (known) return known;
  const url = `${SERVICE}?latitude=${samples.map(({ point }) => point.lat.toFixed(5)).join(",")}`
    + `&longitude=${samples.map(({ point }) => point.lng.toFixed(5)).join(",")}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { elevation?: unknown };
    const heights = Array.isArray(body.elevation) ? body.elevation.filter((h): h is number => typeof h === "number") : [];
    if (heights.length !== samples.length) return null;
    const elevation = {
      ...climbOf(heights),
      profile: samples.map(({ distanceM: along }, index) => ({ distanceM: along, value: heights[index] })),
    };
    cache.set(key, elevation);
    return elevation;
  } catch {
    return null;
  }
}
