import { elevationFrom, elevationUrl, sampleLine, type Elevation } from "@tread/core/elevation";
import type { RoutePoint } from "@tread/core/route";

export { climbOf, sampleLine, type Elevation } from "@tread/core/elevation";

/**
 * A route's climb and its profile, asked of Open-Meteo once per line and
 * kept for the session, so a route redrawn to the same line is not asked
 * about twice. The sampling and the reading are shared with the phone.
 */

const cache = new Map<string, Elevation>();

/** The elevation of a line, or null when the service could not answer. */
export async function elevationOf(line: readonly RoutePoint[]): Promise<Elevation | null> {
  const samples = sampleLine(line);
  if (samples.length < 2) return null;
  const key = samples.map(({ point }) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join(";");
  const known = cache.get(key);
  if (known) return known;
  try {
    const response = await fetch(elevationUrl(samples));
    if (!response.ok) return null;
    const elevation = elevationFrom(samples, await response.json());
    if (!elevation) return null;
    cache.set(key, elevation);
    return elevation;
  } catch {
    return null;
  }
}
