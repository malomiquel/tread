import { decimal, defineStrings } from "./i18n.ts";
import { speedUnit, toTemperatureUnits, windToSpeedUnits } from "./units.ts";

/**
 * A weather reading as Tread keeps it on a run, and the words for it.
 *
 * The fetching stays with the phone, which asks Open-Meteo where it stands;
 * the shape and how it reads are shared, so the web says a run's weather in
 * the same words.
 */

export interface Weather {
  /** Air temperature, in degrees Celsius. */
  temperatureC: number;
  /** What it feels like once wind and humidity are counted in. */
  feelsLikeC: number;
  /** Wind speed, in kilometres per hour. */
  windKmh: number;
  /** Rain or snow fallen over that hour, in millimetres. */
  precipitationMm: number;
  /**
   * What the sky was doing, as a WMO code — the vocabulary every weather
   * model speaks. Null when the answer came back without one, which hides
   * the description rather than inventing a clear sky.
   */
  code: number | null;
  /** Daylight, which is the whole difference between a sun and a moon. */
  day: boolean;
}

/** A finite number, or the fallback. */
export const numberOr = <T extends number | null>(value: unknown, fallback: T): number | T =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * The WMO code in words, grouped the way anyone standing outside groups them.
 *
 * The scale is finer than this — it separates light, moderate and heavy
 * freezing drizzle — but nobody dresses differently for the middle one, so
 * the intensities that change a decision are kept and the rest are folded in.
 */
type Sky =
  | "clear" | "mostlyClear" | "partlyCloudy" | "overcast" | "fog" | "drizzle" | "freezingDrizzle"
  | "lightRain" | "rain" | "heavyRain" | "freezingRain" | "lightSnow" | "snow" | "heavySnow"
  | "showers" | "heavyShowers" | "snowShowers" | "thunderstorm" | "hailstorm";

const skyNames = defineStrings<Record<Sky, string>>({
  fr: {
    clear: "Ciel dégagé", mostlyClear: "Plutôt dégagé", partlyCloudy: "Partiellement nuageux",
    overcast: "Couvert", fog: "Brouillard", drizzle: "Bruine", freezingDrizzle: "Bruine verglaçante",
    lightRain: "Pluie faible", rain: "Pluie", heavyRain: "Pluie forte", freezingRain: "Pluie verglaçante",
    lightSnow: "Neige faible", snow: "Neige", heavySnow: "Neige forte", showers: "Averses",
    heavyShowers: "Fortes averses", snowShowers: "Averses de neige", thunderstorm: "Orage",
    hailstorm: "Orage et grêle",
  },
  en: {
    clear: "Clear sky", mostlyClear: "Mostly clear", partlyCloudy: "Partly cloudy",
    overcast: "Overcast", fog: "Fog", drizzle: "Drizzle", freezingDrizzle: "Freezing drizzle",
    lightRain: "Light rain", rain: "Rain", heavyRain: "Heavy rain", freezingRain: "Freezing rain",
    lightSnow: "Light snow", snow: "Snow", heavySnow: "Heavy snow", showers: "Showers",
    heavyShowers: "Heavy showers", snowShowers: "Snow showers", thunderstorm: "Thunderstorm",
    hailstorm: "Thunderstorm with hail",
  },
});

function sky(code: number): Sky | null {
  if (code === 0) return "clear";
  if (code === 1) return "mostlyClear";
  if (code === 2) return "partlyCloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 55) return "drizzle";
  if (code === 56 || code === 57) return "freezingDrizzle";
  if (code === 61) return "lightRain";
  if (code === 63) return "rain";
  if (code === 65) return "heavyRain";
  if (code === 66 || code === 67) return "freezingRain";
  if (code === 71) return "lightSnow";
  if (code === 73) return "snow";
  if (code === 75 || code === 77) return "heavySnow";
  if (code === 80) return "showers";
  if (code === 81 || code === 82) return "heavyShowers";
  if (code === 85 || code === 86) return "snowShowers";
  if (code === 95) return "thunderstorm";
  if (code === 96 || code === 99) return "hailstorm";
  return null;
}

export function weatherLabel(code: number | null): string | null {
  if (code === null) return null;
  const found = sky(code);
  return found === null ? null : skyNames()[found];
}

export const weatherWords = defineStrings({
  fr: {
    feels: (temperature: string) => `ressenti ${temperature}`,
    wind: (speed: string) => `vent ${speed} ${speedUnit()}`,
    range: (low: string, high: string) => `${low} à ${high}`,
  },
  en: {
    feels: (temperature: string) => `feels ${temperature}`,
    wind: (speed: string) => `wind ${speed} ${speedUnit()}`,
    range: (low: string, high: string) => `${low} to ${high}`,
  },
});

/** Rain, in millimetres, or nothing when there is too little to mention. */
export const rainfall = (mm: number): string | null => (mm >= 0.1 ? `${decimal(mm.toFixed(1))} mm` : null);

/**
 * The names are Ionicons', spelled out as a union so that a typo is caught
 * here rather than turning up as a blank square on a phone.
 */
export type WeatherIcon =
  | "sunny-outline" | "moon-outline"
  | "partly-sunny-outline" | "cloudy-night-outline"
  | "cloudy-outline" | "rainy-outline" | "snow-outline"
  | "thunderstorm-outline" | "water-outline";

/** The sky as a glyph. Clear and half-clear skies change at nightfall. */
export function weatherIcon(code: number | null, day: boolean): WeatherIcon {
  if (code === null || code === 0 || code === 1) return day ? "sunny-outline" : "moon-outline";
  if (code === 2) return day ? "partly-sunny-outline" : "cloudy-night-outline";
  if (code === 3) return "cloudy-outline";
  if (code === 45 || code === 48) return "water-outline";
  if (code >= 95) return "thunderstorm-outline";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow-outline";
  return "rainy-outline";
}

/** Whole degrees: a tenth of one is a precision nobody feels. */
export function formatTemperature(celsius: number): string {
  return `${Math.round(toTemperatureUnits(celsius))}°`;
}

/** Whole kilometres an hour, for the same reason. */
export function formatWind(kmh: number): string {
  return String(Math.round(windToSpeedUnits(kmh)));
}

/**
 * The whole reading on one line — "8° ressenti 4° · vent 18 km/h".
 *
 * The felt temperature is dropped when it agrees with the real one, since
 * "8° ressenti 8°" is two figures saying one thing. Rain is only mentioned
 * once there is some: a dry line that has to state its own dryness reads as a
 * form rather than as a forecast.
 */
export function weatherLine(weather: Weather): string {
  const words = weatherWords();
  const felt = Math.round(weather.feelsLikeC) !== Math.round(weather.temperatureC)
    ? words.feels(formatTemperature(weather.feelsLikeC))
    : null;
  return [
    [formatTemperature(weather.temperatureC), felt].filter(Boolean).join(" "),
    words.wind(formatWind(weather.windKmh)),
    rainfall(weather.precipitationMm),
  ].filter(Boolean).join(" · ");
}

/**
 * A reading back out of the database, where it is kept as one json column.
 *
 * Unreadable is the same as absent, as it is for a run's blocks: a run is
 * worth keeping without the weather it was run in.
 */
export function parseWeather(raw: string | null): Weather | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const fields = parsed as Record<string, unknown>;
    const temperatureC = numberOr(fields.temperatureC, null);
    if (temperatureC === null) return null;
    return {
      temperatureC,
      feelsLikeC: numberOr(fields.feelsLikeC, temperatureC),
      windKmh: Math.max(0, numberOr(fields.windKmh, 0)),
      precipitationMm: Math.max(0, numberOr(fields.precipitationMm, 0)),
      code: numberOr(fields.code, null),
      day: fields.day !== false,
    };
  } catch {
    return null;
  }
}
