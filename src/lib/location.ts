import * as Location from "expo-location";
import { useEffect, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

export interface InitialLocation {
  coords: Coords | null;
  /** Null until permission has been decided either way. */
  granted: boolean | null;
}

/**
 * Current position, used to centre the map as soon as the screen appears
 * instead of showing a map of nowhere in particular.
 *
 * The fix arrives in two stages. The system's last known position comes back
 * instantly without waking the GPS chip, so the map jumps straight to the
 * right neighbourhood. A real fix then refines the centring a second or two
 * later, once the chip has locked onto satellites.
 *
 * Permission is requested here, on arrival, rather than when the run starts:
 * a map that does not know where you are is of no use at all.
 */
export function useInitialLocation(): InitialLocation {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const locate = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (permission.status !== "granted") {
        setGranted(false);
        return;
      }
      setGranted(true);

      const known = await Location.getLastKnownPositionAsync();
      if (active && known) {
        setCoords({ lat: known.coords.latitude, lng: known.coords.longitude });
      }

      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (active) {
        setCoords({ lat: fix.coords.latitude, lng: fix.coords.longitude });
      }
    };

    // Failing here is not fatal: the map keeps its default framing and the run
    // stays possible, since starting one asks for permission again.
    locate().catch(() => {
      if (active) setGranted(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return { coords, granted };
}

/**
 * One-off fix, for the recentre button.
 *
 * Unlike the hook, permission is only requested again when it has not already
 * been granted: tapping the button must not fire a system prompt every time.
 */
export async function getCurrentCoords(): Promise<Coords | null> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status !== "granted") {
    const asked = await Location.requestForegroundPermissionsAsync();
    if (asked.status !== "granted") return null;
  }
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: fix.coords.latitude, lng: fix.coords.longitude };
}


/**
 * Where the phone last knew itself to be, asked without ever prompting.
 *
 * The plan screen wants a forecast, and a forecast needs a position — but a
 * system prompt raised by a page of dates and distances is a prompt nobody
 * expected, asked at the one moment it is least likely to be granted. So this
 * takes the fix the system already has and settles for nothing when there is
 * none: permission is asked for on the screen that genuinely cannot work
 * without it, which is the map.
 */
export function useKnownLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    let active = true;

    const locate = async () => {
      const existing = await Location.getForegroundPermissionsAsync();
      if (!active || existing.status !== "granted") return;
      const known = await Location.getLastKnownPositionAsync();
      if (active && known) {
        setCoords({ lat: known.coords.latitude, lng: known.coords.longitude });
      }
    };

    locate().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return coords;
}

/**
 * Where a run happened, as a person would say it: "Chartres, France".
 *
 * Reverse geocoding goes through Apple or Google depending on the platform,
 * so it needs the network and can simply decline. Null then, and whatever
 * shows this says the date alone rather than an apology — a place name is a
 * pleasant detail on a picture, never information the run depends on.
 */
export async function placeName(lat: number, lng: number): Promise<string | null> {
  try {
    const [found] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!found) return null;
    // A town on its own is ambiguous the moment the picture leaves the
    // country it was taken in, and a country on its own says nothing.
    const town = found.city ?? found.subregion ?? found.region;
    return [town, found.country].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}
