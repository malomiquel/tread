import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forecastBrief, forecastLine, forecastOn, forecastSentence, formatTemperature, formatWind,
  isoDay, parseWeather,
  readCurrent, readForecast, readHourly, weatherIcon, weatherLabel, weatherLine,
  type Forecast, type Weather,
} from "./weather.ts";

/** An Open-Meteo answer, trimmed to the fields the app asks for. */
const CURRENT = {
  current: {
    time: "2026-09-22T08:00",
    temperature_2m: 8.4,
    apparent_temperature: 4.2,
    precipitation: 0,
    weather_code: 3,
    wind_speed_10m: 18.3,
    is_day: 1,
  },
};

const HOURLY = {
  hourly: {
    // Unix seconds, hour by hour: 06:00, 07:00 and 08:00 UTC.
    time: [1_758_520_800, 1_758_524_400, 1_758_528_000],
    temperature_2m: [6, 7, 9],
    apparent_temperature: [3, 4, 6],
    precipitation: [0, 1.2, 0],
    weather_code: [3, 61, 2],
    wind_speed_10m: [10, 12, 14],
    is_day: [0, 1, 1],
  },
};

test("reads the current conditions", () => {
  assert.deepEqual(readCurrent(CURRENT), {
    temperatureC: 8.4,
    feelsLikeC: 4.2,
    windKmh: 18.3,
    precipitationMm: 0,
    code: 3,
    day: true,
  });
});

test("a reading without a temperature is no reading at all", () => {
  assert.equal(readCurrent({ current: { wind_speed_10m: 12 } }), null);
  assert.equal(readCurrent({ current: { temperature_2m: "doux" } }), null);
  assert.equal(readCurrent({}), null);
  assert.equal(readCurrent(null), null);
  assert.equal(readCurrent("<html>erreur</html>"), null);
});

test("a missing wind or sky does not throw the temperature away", () => {
  assert.deepEqual(readCurrent({ current: { temperature_2m: 12 } }), {
    temperatureC: 12,
    // Falls back to the real temperature rather than to zero, which would
    // read as a freezing wind chill on a mild day.
    feelsLikeC: 12,
    windKmh: 0,
    precipitationMm: 0,
    code: null,
    day: true,
  });
});

test("takes the hour nearest the moment asked for", () => {
  // 07:12 UTC, twelve minutes past the middle hour.
  const found = readHourly(HOURLY, 1_758_525_120_000);
  assert.equal(found?.temperatureC, 7);
  assert.equal(found?.precipitationMm, 1.2);
  assert.equal(found?.code, 61);
});

test("a run that ended at ten to the hour reads the hour it ended in", () => {
  // 07:50 UTC is nearer 08:00 than 07:00.
  assert.equal(readHourly(HOURLY, 1_758_527_400_000)?.temperatureC, 9);
});

test("refuses an hour that is not in the answer", () => {
  // A week later: the nearest row is days away, and stating it would be a
  // lie told with confidence.
  assert.equal(readHourly(HOURLY, 1_759_129_920_000), null);
  assert.equal(readHourly({ hourly: { time: [] } }, Date.now()), null);
  assert.equal(readHourly({}, Date.now()), null);
});

test("night is read from the daylight flag", () => {
  assert.equal(readHourly(HOURLY, 1_758_520_800_000)?.day, false);
  assert.equal(readHourly(HOURLY, 1_758_528_000_000)?.day, true);
});

test("every WMO code the models use has words", () => {
  const spoken = [
    0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
    71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
  ];
  for (const code of spoken) {
    assert.ok(weatherLabel(code), `code ${code}`);
  }
  assert.equal(weatherLabel(null), null);
  assert.equal(weatherLabel(4242), null);
});

test("the sky becomes a glyph, and clear skies change at nightfall", () => {
  assert.equal(weatherIcon(0, true), "sunny-outline");
  assert.equal(weatherIcon(0, false), "moon-outline");
  assert.equal(weatherIcon(2, true), "partly-sunny-outline");
  assert.equal(weatherIcon(2, false), "cloudy-night-outline");
  assert.equal(weatherIcon(3, false), "cloudy-outline");
  assert.equal(weatherIcon(65, true), "rainy-outline");
  assert.equal(weatherIcon(75, true), "snow-outline");
  assert.equal(weatherIcon(95, true), "thunderstorm-outline");
  assert.equal(weatherIcon(45, true), "water-outline");
});

test("the line says degrees, wind, and rain only when it rains", () => {
  const cold: Weather = {
    temperatureC: 8.4, feelsLikeC: 4.2, windKmh: 18.3,
    precipitationMm: 0, code: 3, day: true,
  };
  assert.equal(weatherLine(cold), "8° ressenti 4° · vent 18 km/h");
  assert.equal(
    weatherLine({ ...cold, precipitationMm: 1.24 }),
    "8° ressenti 4° · vent 18 km/h · 1,2 mm",
  );
});

test("a felt temperature that agrees with the real one is not said twice", () => {
  const mild: Weather = {
    temperatureC: 17.2, feelsLikeC: 17.4, windKmh: 4,
    precipitationMm: 0, code: 0, day: true,
  };
  assert.equal(weatherLine(mild), "17° · vent 4 km/h");
});

test("figures are shown whole", () => {
  assert.equal(formatTemperature(8.4), "8°");
  assert.equal(formatTemperature(-2.6), "-3°");
  assert.equal(formatWind(18.3), "18");
});

test("a stored reading comes back as it went in", () => {
  const stored: Weather = {
    temperatureC: 8.4, feelsLikeC: 4.2, windKmh: 18.3,
    precipitationMm: 0.4, code: 3, day: false,
  };
  assert.deepEqual(parseWeather(JSON.stringify(stored)), stored);
});

test("an unreadable reading is the same as none", () => {
  assert.equal(parseWeather(null), null);
  assert.equal(parseWeather(""), null);
  assert.equal(parseWeather("{"), null);
  assert.equal(parseWeather("[]"), null);
  assert.equal(parseWeather('{"windKmh":12}'), null);
});

/** The daily block, as Open-Meteo writes it with `timezone=auto`. */
const DAILY = {
  daily: {
    time: ["2026-09-23", "2026-09-24", "2026-09-25"],
    weather_code: [3, 61, 0],
    temperature_2m_max: [14.2, 11.8, 19],
    temperature_2m_min: [6.1, 8.4, 9],
    precipitation_sum: [0, 4.2, 0],
    wind_speed_10m_max: [12.4, 26.8, 7],
  },
};

test("reads every day of the answer, each under its own date", () => {
  const days = readForecast(DAILY);
  assert.deepEqual([...days.keys()], ["2026-09-23", "2026-09-24", "2026-09-25"]);
  assert.deepEqual(days.get("2026-09-24"), {
    day: "2026-09-24",
    code: 61,
    highC: 11.8,
    lowC: 8.4,
    windKmh: 26.8,
    precipitationMm: 4.2,
  });
});

test("a day without both ends of its temperature is left out", () => {
  const days = readForecast({
    daily: {
      time: ["2026-09-23", "2026-09-24"],
      temperature_2m_max: [14.2, 11.8],
      temperature_2m_min: [6.1, null],
    },
  });
  assert.deepEqual([...days.keys()], ["2026-09-23"]);
  // Everything the answer did not carry falls back rather than dropping the
  // day: an outlook without a wind speed is still an outlook.
  assert.equal(days.get("2026-09-23")?.windKmh, 0);
  assert.equal(days.get("2026-09-23")?.code, null);
});

test("an unreadable answer knows about no days at all", () => {
  assert.equal(readForecast({}).size, 0);
  assert.equal(readForecast(null).size, 0);
  assert.equal(readForecast({ daily: { time: "demain" } }).size, 0);
});

test("a session finds its own day, and only its own", () => {
  const days = readForecast(DAILY);
  assert.equal(forecastOn(days, new Date(2026, 8, 24, 18, 30).getTime())?.code, 61);
  // Beyond the horizon the models publish, which is most of a programme.
  assert.equal(forecastOn(days, new Date(2026, 11, 25, 9, 0).getTime()), null);
});

test("a day is named from the phone's own clock, not from UTC", () => {
  // Late on the 24th locally is already the 25th in UTC, and the programme
  // means the local day.
  assert.equal(isoDay(new Date(2026, 8, 24, 23, 30).getTime()), "2026-09-24");
  assert.equal(isoDay(new Date(2026, 0, 5, 0, 15).getTime()), "2026-01-05");
});

test("the forecast line gives both ends of the day", () => {
  const rainy: Forecast = {
    day: "2026-09-24", code: 61, highC: 11.8, lowC: 8.4,
    windKmh: 26.8, precipitationMm: 4.2,
  };
  assert.equal(forecastLine(rainy), "Pluie faible · 8° à 12° · vent 27 km/h · 4,2 mm");
  assert.equal(
    forecastLine({ ...rainy, code: null, precipitationMm: 0 }),
    "8° à 12° · vent 27 km/h",
  );
});

test("a list says both ends and leaves the sky to the icon", () => {
  const rainy: Forecast = {
    day: "2026-09-24", code: 61, highC: 11.8, lowC: 8.4,
    windKmh: 26.8, precipitationMm: 4.2,
  };
  assert.equal(forecastBrief(rainy), "8°/12°");
});

test("a day of one temperature still states both ends", () => {
  const flat: Forecast = {
    day: "2026-09-24", code: 3, highC: 6.2, lowC: 5.8,
    windKmh: 9, precipitationMm: 0,
  };
  assert.equal(forecastLine(flat), "Couvert · 6° à 6° · vent 9 km/h");
});

test("a notification gets a sentence, not a readout", () => {
  const rainy: Forecast = {
    day: "2026-09-24", code: 61, highC: 11.8, lowC: 8.4,
    windKmh: 26.8, precipitationMm: 4.2,
  };
  // No millimetres: the word for the sky is what decides anything at six in
  // the morning, and it is already there.
  assert.equal(forecastSentence(rainy), "Pluie faible, 8° à 12°, vent 27 km/h");
  assert.equal(forecastSentence({ ...rainy, code: null }), "8° à 12°, vent 27 km/h");
});
