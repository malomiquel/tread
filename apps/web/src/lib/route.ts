import { distanceM } from "@tread/core/geo";
import type { RoutePoint } from "@tread/core/route";

/** A route's length, along its line. */
export const routeLengthM = (line: readonly RoutePoint[]): number =>
  line.reduce((total, point, index) => (index === 0 ? 0 : total + distanceM(line[index - 1], point)), 0);

/** About sixty points of it, as [lat, lng], for its tile. */
export function routeShape(line: readonly RoutePoint[]): [number, number][] {
  const step = Math.max(1, Math.floor(line.length / 60));
  return line.filter((_, index) => index % step === 0 || index === line.length - 1).map((p) => [p.lat, p.lng]);
}
