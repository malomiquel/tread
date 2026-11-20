import { getLanguage } from "@tread/core/i18n";
import type { RoutePoint } from "@tread/core/route";

/**
 * "Chartres, France": the town a point is in, as the phone names a route's
 * place. From OpenStreetMap's Nominatim, asked once per saved route, in the
 * interface's language; null on any failure, a route needs no place.
 */
export async function placeName(point: RoutePoint): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${point.lat}&lon=${point.lng}`
    + `&accept-language=${getLanguage()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { address?: Record<string, string> };
    const address = body.address ?? {};
    const town = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
    return [town, address.country].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}
