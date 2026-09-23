import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDistance, formatElevation, formatPace, formatSpeed } from "./format.ts";
import { setUnitSystem, unitLengthM, distanceUnit, paceUnit } from "./units.ts";
import { formatTemperature, formatWind } from "./weather.ts";

test("a pace that rounds up carries into the minute", () => {
  assert.equal(formatPace(299.6), "5'00\"");
  assert.equal(formatPace(312), "5'12\"");
});

test("metric is the default, and shows figures as stored", () => {
  assert.equal(formatDistance(8420), "8,42");
  assert.equal(formatPace(300), "5'00\"");
  assert.equal(formatElevation(120.4), "120");
  assert.equal(distanceUnit(), "km");
  assert.equal(paceUnit(), "/km");
});

test("imperial converts at the last moment, and only for display", () => {
  setUnitSystem("imperial");
  try {
    assert.equal(unitLengthM(), 1609.344);
    assert.equal(formatDistance(1609.344 * 5), "5,00");
    // 5'00" per kilometre is 8'03" per mile.
    assert.equal(formatPace(300), "8'03\"");
    assert.equal(formatElevation(100), "328");
    assert.equal(formatSpeed(10 / 3.6), "6,2");
    assert.equal(formatTemperature(20), "68°");
    assert.equal(formatWind(16.09344), "10");
    assert.equal(paceUnit(), "/mi");
  } finally {
    setUnitSystem("metric");
  }
});
