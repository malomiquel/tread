import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrackPoint } from "./geo.ts";
import { hideEnds, radiusLabel, readPrivacyRadius } from "./privacy.ts";
import { setUnitSystem } from "./units.ts";

/** Points just over 100 m apart heading north (0.0009° of latitude each). */
const line = (count: number): TrackPoint[] =>
  Array.from({ length: count }, (_, i) => ({
    ts: i * 30_000, lat: 48.45 + i * 0.0009, lng: 1.49,
    alt: null, accuracy: 5, speed: null, segment: 0,
  }));

test("an out-and-back loses both ends, the middle stays", () => {
  const shown = hideEnds(line(20), 200);
  // Points 0 and 1 are within 200 m of the start, 18 and 19 of the finish.
  assert.equal(shown.length, 16);
  assert.ok(Math.abs(shown[0].lat - line(20)[2].lat) < 1e-9);
  assert.ok(Math.abs(shown[shown.length - 1].lat - line(20)[17].lat) < 1e-9);
});

test("a loop home is cut at both ends around the door", () => {
  const out = line(10);
  const back = [...out].reverse().map((point, i) => ({ ...point, ts: 300_000 + i * 30_000 }));
  const shown = hideEnds([...out, ...back], 250);
  assert.ok(shown.length > 0);
  for (const point of shown) {
    assert.ok(Math.abs(point.lat - out[0].lat) > 0.002, "nothing near the start is drawn");
  }
});

test("a run that never leaves the radius shows nothing at all", () => {
  assert.deepEqual(hideEnds(line(3), 500), []);
});

test("zero shows the whole track", () => {
  assert.equal(hideEnds(line(5), 0).length, 5);
});

test("the stored radius falls back to the protective default", () => {
  assert.equal(readPrivacyRadius(undefined), 200);
  assert.equal(readPrivacyRadius("0"), 0);
  assert.equal(readPrivacyRadius("1000"), 1000);
  assert.equal(readPrivacyRadius("42"), 200);
});

test("a radius is said in the chosen units", () => {
  assert.equal(radiusLabel(200), "200 m");
  assert.equal(radiusLabel(1000), "1 km");
  setUnitSystem("imperial");
  try {
    assert.equal(radiusLabel(200), "650 ft");
    assert.equal(radiusLabel(1000), "0,6 mi");
  } finally {
    setUnitSystem("metric");
  }
});
