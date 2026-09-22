import { useEffect, useState } from "react";
import type { Coords } from "./location";

/**
 * The weather, from Open-Meteo.
 *
 * Open-Meteo because it is the only forecast worth having that asks for
 * nothing in return: no account, no key, and therefore no key shipped inside
 * the app for somebody to pull back out of the binary. The alternative was a
 * secret this repository would have had to keep, which is a secret it cannot
 * keep — the app runs on other people's phones.
 *
 * Weather is decoration on a run, never information the run depends on: every
 * call here answers null rather than throwing, and every screen that shows a
 * reading is written to look complete without one.
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

const API = "https://api.open-meteo.com/v1/forecast";

/** The five readings a runner acts on, plus the daylight the icon needs. */
const FIELDS = "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day";

/**
 * Coordinates are cut to two decimals — a little over a kilometre — before
 * they leave the phone.
 *
 * The model itself works on a grid of a few kilometres, so the digits beyond
 * this one change nothing in the answer. What they would change is what a
 * third party learns: a run starts at a front door, and the full fix is that
 * door to within a few metres. Rounding costs nothing here and is the whole
 * difference between asking about a neighbourhood and reporting an address.
 */
const grid = (degrees: number): string => degrees.toFixed(2);

/** Nothing here is worth making anyone wait for. */
const TIMEOUT_MS = 6000;

async function ask(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    // No network, a captive wifi, a refused request or a body that is not
    // JSON. All the same thing from here: no weather.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const numberOr = <T extends number | null>(value: unknown, fallback: T): number | T =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * One reading, built from whichever bag of fields it came out of.
 *
 * The temperature is the one field without which there is no reading at all;
 * everything else falls back to something harmless, because a missing wind
 * speed is not a reason to throw the temperature away.
 */
function reading(fields: Record<string, unknown>): Weather | null {
  const temperatureC = numberOr(fields.temperature_2m, null);
  if (temperatureC === null) return null;
  return {
    temperatureC,
    feelsLikeC: numberOr(fields.apparent_temperature, temperatureC),
    windKmh: Math.max(0, numberOr(fields.wind_speed_10m, 0)),
    precipitationMm: Math.max(0, numberOr(fields.precipitation, 0)),
    code: numberOr(fields.weather_code, null),
    // Absent means daytime: the icon is the only thing that reads this, and
    // a sun is the less surprising of the two to be wrong about.
    day: fields.is_day === undefined ? true : numberOr(fields.is_day, 1) === 1,
  };
}

/** The `current` block of an Open-Meteo answer. */
export function readCurrent(payload: unknown): Weather | null {
  const current = (payload as { current?: unknown } | null)?.current;
  if (!current || typeof current !== "object") return null;
  return reading(current as Record<string, unknown>);
}

/**
 * The hour nearest a given moment, out of the `hourly` block.
 *
 * Open-Meteo answers in parallel arrays — one of timestamps, one per field —
 * so the work is to find the index once and read every array at it.
 */
export function readHourly(payload: unknown, ts: number): Weather | null {
  const hourly = (payload as { hourly?: unknown } | null)?.hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const fields = hourly as Record<string, unknown>;
  const times = fields.time;
  if (!Array.isArray(times) || times.length === 0) return null;

  const wanted = Math.round(ts / 1000);
  const distance = (index: number) =>
    Math.abs(numberOr(times[index], Number.MAX_SAFE_INTEGER) - wanted);
  let nearest = 0;
  for (let i = 1; i < times.length; i += 1) {
    if (distance(i) < distance(nearest)) nearest = i;
  }

  // Inside the range asked for, the nearest hour is half an hour away at
  // worst. Further than that means the answer covers a different day
  // altogether, and yesterday's weather stated as this run's would be a lie
  // told with confidence.
  if (distance(nearest) > 90 * 60) return null;

  const at = (key: string): unknown => {
    const column = fields[key];
    return Array.isArray(column) ? column[nearest] : undefined;
  };
  return reading({
    temperature_2m: at("temperature_2m"),
    apparent_temperature: at("apparent_temperature"),
    wind_speed_10m: at("wind_speed_10m"),
    precipitation: at("precipitation"),
    weather_code: at("weather_code"),
    is_day: at("is_day"),
  });
}

/** Conditions right now, where the phone is. */
export async function currentWeather(lat: number, lng: number): Promise<Weather | null> {
  const payload = await ask(
    `${API}?latitude=${grid(lat)}&longitude=${grid(lng)}&current=${FIELDS}&wind_speed_unit=kmh`,
  );
  return payload === null ? null : readCurrent(payload);
}

/**
 * Conditions at a given moment, for a run that has just been stopped.
 *
 * Asked of the hourly series rather than of `current`, because the two differ
 * by however long the run took: an outing that set off in the rain and came
 * back in the sun was run in the rain, and the runner knows it.
 *
 * Yesterday is asked for too, since a run can start before midnight and a
 * phone that had no signal outdoors often only reconnects once it is home.
 */
export async function weatherAt(lat: number, lng: number, ts: number): Promise<Weather | null> {
  const payload = await ask(
    `${API}?latitude=${grid(lat)}&longitude=${grid(lng)}&hourly=${FIELDS}`
    + "&past_days=1&forecast_days=1&timeformat=unixtime&wind_speed_unit=kmh",
  );
  return payload === null ? null : readHourly(payload, ts);
}

/**
 * A whole day at a glance, which is all a session three days out can be told.
 *
 * Two temperatures rather than one, because a day is not a temperature: the
 * question a runner asks of a forecast is what to expect at either end of it.
 */
export interface Forecast {
  /** The day this covers, as the API writes it — "2026-09-24". */
  day: string;
  /** What the sky is expected to do, as a WMO code. */
  code: number | null;
  /** Warmest and coldest the day is expected to get, in degrees Celsius. */
  highC: number;
  lowC: number;
  /** The strongest wind of the day, in kilometres per hour. */
  windKmh: number;
  /** Rain or snow expected over the whole day, in millimetres. */
  precipitationMm: number;
}

/** The five daily figures, in the same order of importance as the hourly ones. */
const DAILY = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max";

/**
 * How far ahead a forecast is worth asking for.
 *
 * The models publish sixteen days and mean progressively less of it. Beyond
 * that the request would come back empty, and a programme runs for months —
 * so most of its sessions are simply too far away to be told anything about.
 */
export const FORECAST_DAYS = 16;

/**
 * A day as the daily forecast writes it, read off the phone's own clock.
 *
 * Local rather than UTC, and deliberately: the programme lays its sessions
 * out on local midnights, and a run planned for tuesday is tuesday where the
 * runner is standing. The daily series is asked for with `timezone=auto`, so
 * both sides of this comparison mean the same day.
 */
export function isoDay(at: number): string {
  const day = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/**
 * Every day the answer speaks about, by date.
 *
 * The whole block rather than one day out of it, because a programme asks
 * about several days at once: one request covering a fortnight, read as many
 * times as there are sessions in it, where a call per session would be a
 * dozen requests for the same fortnight.
 *
 * An unreadable answer is an empty map, which every caller already handles as
 * "nothing is known about that day".
 */
export function readForecast(payload: unknown): Map<string, Forecast> {
  const found = new Map<string, Forecast>();
  const daily = (payload as { daily?: unknown } | null)?.daily;
  if (!daily || typeof daily !== "object") return found;
  const fields = daily as Record<string, unknown>;
  const days = fields.time;
  if (!Array.isArray(days)) return found;

  const at = (key: string, row: number): unknown => {
    const column = fields[key];
    return Array.isArray(column) ? column[row] : undefined;
  };

  days.forEach((day, row) => {
    if (typeof day !== "string") return;
    const highC = numberOr(at("temperature_2m_max", row), null);
    const lowC = numberOr(at("temperature_2m_min", row), null);
    // Without both ends there is no day to describe, only half of one.
    if (highC === null || lowC === null) return;
    found.set(day, {
      day,
      code: numberOr(at("weather_code", row), null),
      highC,
      lowC,
      windKmh: Math.max(0, numberOr(at("wind_speed_10m_max", row), 0)),
      precipitationMm: Math.max(0, numberOr(at("precipitation_sum", row), 0)),
    });
  });
  return found;
}

/**
 * As far ahead as the models will go, where the phone is.
 *
 * Asked in the local timezone rather than in GMT, because a day is a local
 * thing: in GMT the warmest hour of a French tuesday afternoon and the
 * coldest of its night belong to two different rows.
 */
export async function forecastDays(lat: number, lng: number): Promise<Map<string, Forecast>> {
  const payload = await ask(
    `${API}?latitude=${grid(lat)}&longitude=${grid(lng)}&daily=${DAILY}`
    + `&forecast_days=${FORECAST_DAYS}&timezone=auto&wind_speed_unit=kmh`,
  );
  return payload === null ? new Map() : readForecast(payload);
}

/** What is expected on a given day, or null when nothing is known about it. */
export function forecastOn(days: ReadonlyMap<string, Forecast>, at: number): Forecast | null {
  return days.get(isoDay(at)) ?? null;
}

/**
 * The WMO code in words, grouped the way anyone standing outside groups them.
 *
 * The scale is finer than this — it separates light, moderate and heavy
 * freezing drizzle — but nobody dresses differently for the middle one, so
 * the intensities that change a decision are kept and the rest are folded in.
 */
export function weatherLabel(code: number | null): string | null {
  if (code === null) return null;
  if (code === 0) return "Ciel dégagé";
  if (code === 1) return "Plutôt dégagé";
  if (code === 2) return "Partiellement nuageux";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code >= 51 && code <= 55) return "Bruine";
  if (code === 56 || code === 57) return "Bruine verglaçante";
  if (code === 61) return "Pluie faible";
  if (code === 63) return "Pluie";
  if (code === 65) return "Pluie forte";
  if (code === 66 || code === 67) return "Pluie verglaçante";
  if (code === 71) return "Neige faible";
  if (code === 73) return "Neige";
  if (code === 75 || code === 77) return "Neige forte";
  if (code === 80) return "Averses";
  if (code === 81 || code === 82) return "Fortes averses";
  if (code === 85 || code === 86) return "Averses de neige";
  if (code === 95) return "Orage";
  if (code === 96 || code === 99) return "Orage et grêle";
  return null;
}

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
  return `${Math.round(celsius)}°`;
}

/** Whole kilometres an hour, for the same reason. */
export function formatWind(kmh: number): string {
  return String(Math.round(kmh));
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
  const felt = Math.round(weather.feelsLikeC) !== Math.round(weather.temperatureC)
    ? `ressenti ${formatTemperature(weather.feelsLikeC)}`
    : null;
  const rain = weather.precipitationMm >= 0.1
    ? `${weather.precipitationMm.toFixed(1).replace(".", ",")} mm`
    : null;
  return [
    [formatTemperature(weather.temperatureC), felt].filter(Boolean).join(" "),
    `vent ${formatWind(weather.windKmh)} km/h`,
    rain,
  ].filter(Boolean).join(" · ");
}

/**
 * A day ahead on one line — "Couvert · 6° à 14° · vent 12 km/h".
 *
 * The two temperatures are always both said, even when they round to the
 * same figure: a day that is six degrees from dawn to dusk is a fact about
 * that day, and "6°" alone would read as a reading rather than a range.
 */
export function forecastLine(forecast: Forecast): string {
  const rain = forecast.precipitationMm >= 0.1
    ? `${forecast.precipitationMm.toFixed(1).replace(".", ",")} mm`
    : null;
  return [
    weatherLabel(forecast.code),
    `${formatTemperature(forecast.lowC)} à ${formatTemperature(forecast.highC)}`,
    `vent ${formatWind(forecast.windKmh)} km/h`,
    rain,
  ].filter(Boolean).join(" · ");
}

/**
 * The same day said as a sentence — "Couvert, 8° à 12°, vent 27 km/h".
 *
 * For a notification, where a chain of middots reads as a readout rather than
 * as a line somebody wrote. The millimetres are dropped too: on a lock screen
 * the word for the sky is the part that decides anything, and "4,2 mm" is a
 * figure nobody converts into a decision at six in the morning.
 */
export function forecastSentence(forecast: Forecast): string {
  return [
    weatherLabel(forecast.code),
    `${formatTemperature(forecast.lowC)} à ${formatTemperature(forecast.highC)}`,
    `vent ${formatWind(forecast.windKmh)} km/h`,
  ].filter(Boolean).join(", ");
}

/**
 * Both ends of a day and nothing else — "8°/12°".
 *
 * For a list, where a session is one line among twenty and the column it sits
 * in is a few characters wide. Whatever the sky is doing is carried by the
 * icon beside it rather than spelled out: twenty lines each naming their own
 * cloud cover is a page nobody reads.
 */
export function forecastBrief(forecast: Forecast): string {
  return `${formatTemperature(forecast.lowC)}/${formatTemperature(forecast.highC)}`;
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

/**
 * How long a reading is worth keeping before it is asked for again.
 *
 * The models themselves publish hourly, so anything shorter would spend the
 * network on figures that have not moved.
 */
const FRESH_MS = 10 * 60 * 1000;

/** The last answer, so that walking between tabs does not re-ask the sky. */
let cached: { key: string; at: number; weather: Weather } | null = null;

/**
 * Conditions where you are, for the screen you look at before going out.
 *
 * This is the question the app was missing: not what the weather will be, but
 * whether to take the long sleeves. It answers null until it has something,
 * and goes on answering null when the network refuses — the line is then
 * simply not there, and the screen reads as one that never had it.
 */
export function useCurrentWeather(coords: Coords | null): Weather | null {
  // Rounded before anything else looks at it. An unrounded fix changes on
  // every GPS refresh, so keying this on the coordinates themselves would
  // re-ask the network each time the map settles by a metre.
  const key = coords === null ? null : `${grid(coords.lat)},${grid(coords.lng)}`;
  const lat = coords?.lat ?? 0;
  const lng = coords?.lng ?? 0;

  /** What this screen went and asked for, kept with the square it answers. */
  const [answer, setAnswer] = useState<{ key: string; weather: Weather } | null>(null);

  /**
   * The last reading taken anywhere in the app for this same square, shown
   * straight away without asking whether it is still fresh.
   *
   * How old it is decides whether to ask again, which is the effect's
   * business; it does not decide whether to show it. Ten-minute-old degrees
   * are still the right degrees, and holding them back would leave the line
   * missing on arrival and appearing a second later, every single time.
   */
  const remembered = key !== null && cached !== null && cached.key === key ? cached.weather : null;

  useEffect(() => {
    if (key === null) return;
    // Fresh enough: what is on screen already came from this answer.
    if (cached !== null && cached.key === key && Date.now() - cached.at < FRESH_MS) return;
    let active = true;

    void currentWeather(lat, lng).then((found) => {
      if (found === null) return;
      cached = { key, at: Date.now(), weather: found };
      if (active) setAnswer({ key, weather: found });
    });

    return () => {
      active = false;
    };
    // Keyed on the rounded position alone: `lat` and `lng` only ever move
    // inside the square the key already stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return answer !== null && answer.key === key ? answer.weather : remembered;
}

/**
 * How long a forecast is worth keeping before it is asked for again.
 *
 * Longer than the current conditions by a wide margin: the models behind a
 * daily outlook run a handful of times a day, and thursday does not move
 * between two glances at the same screen.
 */
const FORECAST_FRESH_MS = 3 * 60 * 60 * 1000;

/** Nothing known, shared rather than rebuilt: a new empty map every render
 * would be a new value every render, and every reader of it would re-run. */
const NOTHING: ReadonlyMap<string, Forecast> = new Map();

/** The last block fetched, kept per square. */
let futures: { key: string; at: number; days: ReadonlyMap<string, Forecast> } | null = null;

/**
 * The days ahead, for a programme to lay its sessions against.
 *
 * This is what a list of dates was missing: it says when to run and says
 * nothing about what running then will be like. A session on thursday that
 * comes with "Pluie · 4° à 8°" is a session somebody either moves or dresses
 * for, and both are decisions that can only be taken in advance.
 *
 * One request covers the whole horizon, so a programme showing a fortnight of
 * sessions costs exactly as much as showing one. Days beyond it are simply
 * missing from the map, which is most of a three-month programme — and the
 * lines that have no forecast show none rather than apologising for it.
 */
export function useForecasts(coords: Coords | null): ReadonlyMap<string, Forecast> {
  const key = coords === null ? null : `${grid(coords.lat)},${grid(coords.lng)}`;
  const lat = coords?.lat ?? 0;
  const lng = coords?.lng ?? 0;

  const [answer, setAnswer] = useState<{ key: string; days: ReadonlyMap<string, Forecast> } | null>(null);

  /** Already fetched for this square, however long ago. */
  const remembered = key !== null && futures !== null && futures.key === key ? futures.days : null;

  useEffect(() => {
    if (key === null) return;
    if (futures !== null && futures.key === key && Date.now() - futures.at < FORECAST_FRESH_MS) return;
    let active = true;

    void forecastDays(lat, lng).then((days) => {
      // An empty answer is a failed one: keeping it would hold the screen at
      // "nothing known" for three hours over one refused request.
      if (days.size === 0) return;
      futures = { key, at: Date.now(), days };
      if (active) setAnswer({ key, days });
    });

    return () => {
      active = false;
    };
    // Keyed on the rounded position alone: `lat` and `lng` only ever move
    // inside the square the key already stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (answer !== null && answer.key === key) return answer.days;
  return remembered ?? NOTHING;
}
