import { distanceM, type TrackPoint } from "./geo.ts";
import { decimal } from "./i18n.ts";
import { FEET_PER_METRE, getUnitSystem, METRES_PER_MILE } from "./units.ts";

/**
 * Keeping a front door off a shared picture.
 *
 * Most runs start and finish at home, and a map of one drawn to the metre is
 * an address. So the track that leaves the phone — on the picture, in the
 * GIF — is cut back near both ends: whatever lies within the chosen radius of
 * where the run set off and where it stopped is simply not drawn.
 *
 * Only the drawing changes. The distance, the time and the run itself stay
 * whole: the figures on the card are the run's, and nothing stored is
 * touched. A GPX export is left alone too — it is the runner's own copy, not
 * something shown to others.
 */

/** The radii offered, in metres. Zero shows the whole track. */
export const PRIVACY_RADII = [0, 200, 500, 1000] as const;
export type PrivacyRadius = (typeof PRIVACY_RADII)[number];

/** A radius that protects without swallowing a short run whole. */
export const DEFAULT_PRIVACY_RADIUS: PrivacyRadius = 200;

export function readPrivacyRadius(raw: string | undefined): PrivacyRadius {
  const value = Number(raw);
  return raw !== undefined && (PRIVACY_RADII as readonly number[]).includes(value)
    ? (value as PrivacyRadius)
    : DEFAULT_PRIVACY_RADIUS;
}

/**
 * The track without its two ends.
 *
 * Trimmed from the start until the first point outside the radius, and from
 * the finish back to the last one outside it. A run that never leaves the
 * radius at all comes back empty: nothing of it can be drawn without drawing
 * the place it was meant to hide.
 */
export function hideEnds(points: readonly TrackPoint[], radiusM: number): TrackPoint[] {
  if (radiusM <= 0 || points.length === 0) return [...points];
  const start = points[0];
  const finish = points[points.length - 1];

  let from = 0;
  while (from < points.length && distanceM(start, points[from]) < radiusM) from += 1;
  let to = points.length - 1;
  while (to >= from && distanceM(finish, points[to]) < radiusM) to -= 1;

  return from > to ? [] : points.slice(from, to + 1);
}

/** A radius said in the chosen units: "200 m", "1 km", "650 ft", "0.6 mi". */
export function radiusLabel(radiusM: number): string {
  if (getUnitSystem() === "metric") {
    return radiusM < 1000 ? `${radiusM} m` : `${decimal(String(radiusM / 1000))} km`;
  }
  const feet = radiusM * FEET_PER_METRE;
  return feet < 1500
    ? `${Math.round(feet / 50) * 50} ft`
    : `${decimal((radiusM / METRES_PER_MILE).toFixed(1))} mi`;
}
