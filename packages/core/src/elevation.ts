// Extension spelled out: this module is loaded by a plain node test.
import { distanceM } from "./geo.ts";
import type { RoutePoint } from "./route.ts";

/**
 * A route's climb and its profile, from the heights of points along it.
 *
 * Routes carry no altitude: they are drawn, not recorded. The heights come
 * from Open-Meteo's elevation service (free, no key), asked about at most a
 * hundred points spread evenly along the line, in one request. The phone and
 * the web ask it the same way, so a route has the same profile on both.
 */

/** Height against distance along the route, in metres. */
export type ElevationProfile = { distanceM: number; value: number }[];

export interface Elevation {
  gainM: number;
  lossM: number;
  profile: ElevationProfile;
}

const SERVICE = "https://api.open-meteo.com/v1/elevation";
/** The most points the service answers for in one request. */
export const ELEVATION_SAMPLES = 100;
/** Rises smaller than this are the model's noise, not a hill. */
const STEP_M = 2;

/** Up to `count` points evenly spaced along the line, with how far along each is. */
export function sampleLine(line: readonly RoutePoint[], count = ELEVATION_SAMPLES): { point: RoutePoint; distanceM: number }[] {
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

/** The request for the heights of these samples. */
export function elevationUrl(samples: readonly { point: RoutePoint }[]): string {
  return `${SERVICE}?latitude=${samples.map(({ point }) => point.lat.toFixed(5)).join(",")}`
    + `&longitude=${samples.map(({ point }) => point.lng.toFixed(5)).join(",")}`;
}

/** The service's answer laid along the samples, or null when it does not fit them. */
export function elevationFrom(
  samples: readonly { distanceM: number }[],
  body: unknown,
): Elevation | null {
  const raw = (body as { elevation?: unknown } | null)?.elevation;
  const heights = Array.isArray(raw) ? raw.filter((h): h is number => typeof h === "number") : [];
  if (heights.length !== samples.length || heights.length < 2) return null;
  return {
    ...climbOf(heights),
    profile: samples.map(({ distanceM: along }, index) => ({ distanceM: along, value: heights[index] })),
  };
}

/** A loop's profile run `laps` times, each lap carried on from the last. */
export function repeatProfile(profile: ElevationProfile, laps: number): ElevationProfile {
  if (profile.length < 2 || laps <= 1) return profile;
  const lapM = profile[profile.length - 1].distanceM;
  const out: ElevationProfile = [...profile];
  for (let lap = 1; lap < Math.round(laps); lap += 1) {
    out.push(...profile.slice(1).map((point) => ({ distanceM: point.distanceM + lap * lapM, value: point.value })));
  }
  return out;
}
