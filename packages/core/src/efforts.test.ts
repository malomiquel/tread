import assert from "node:assert/strict";
import { test } from "node:test";
import { bestEfforts, effortKey, parseEfforts } from "./efforts.ts";
import type { TrackPoint } from "./geo.ts";

/** A fix every 10 s, 0.0009° of latitude apart (about 100 m): 6 min/km. */
const steady = (count: number, segment = 0, startS = 0, lat0 = 48.45): TrackPoint[] =>
  Array.from({ length: count }, (_, i) => ({
    ts: (startS + i * 10) * 1000, lat: lat0 + i * 0.0009, lng: 1.49,
    alt: null, accuracy: 5, speed: null, segment,
  }));

test("a steady run's best kilometre is its pace", () => {
  const efforts = bestEfforts(steady(40));
  // 100.07 m every 10 s: a kilometre in just under 100 s.
  assert.ok(Math.abs(efforts["1000"] - 99.9) < 0.3, String(efforts["1000"]));
  assert.ok(Math.abs(efforts["400"] - 40) < 0.2);
  assert.equal(efforts["5000"], undefined, "too short for a 5 km");
});

test("the fastest stretch is found wherever it is in the run", () => {
  // Slow first, then a fast kilometre: fixes 5 s apart for the second half.
  const slow = steady(20);
  const fast = Array.from({ length: 20 }, (_, i) => ({
    ...slow[slow.length - 1],
    ts: slow[slow.length - 1].ts + (i + 1) * 5000,
    lat: slow[slow.length - 1].lat + (i + 1) * 0.0009,
  }));
  const efforts = bestEfforts([...slow, ...fast]);
  assert.ok(efforts["1000"] < 55, String(efforts["1000"]));
});

test("a pause is not counted as running time", () => {
  const first = steady(8, 0, 0);
  // Resumed ten minutes later, from where it stopped.
  const second = steady(8, 1, 600 + 70, first[7].lat).slice(1);
  const efforts = bestEfforts([...first, ...second]);
  assert.ok(efforts["1000"] !== undefined && efforts["1000"] < 150, String(efforts["1000"]));
});

test("keys are whole metres, and stored efforts read back", () => {
  assert.equal(effortKey(1609.344), "1609");
  assert.equal(effortKey(21_097.5), "21098");
  assert.deepEqual(parseEfforts('{"1000":240.5,"400":-1,"x":"y"}'), { "1000": 240.5 });
  assert.equal(parseEfforts("{"), null);
  assert.equal(parseEfforts(null), null);
});
