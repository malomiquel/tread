import assert from "node:assert/strict";
import { test } from "node:test";
import { heartSeries, paceSeries } from "./charts.ts";
import type { TrackPoint } from "./geo.ts";

/** A fix every `stepS` seconds, 0.0009° of latitude (about 100 m) apart. */
const run = (count: number, stepS: number, segment = 0, startS = 0, lat0 = 48.45): TrackPoint[] =>
  Array.from({ length: count }, (_, i) => ({
    ts: (startS + i * stepS) * 1000, lat: lat0 + i * 0.0009, lng: 1.49,
    alt: null, accuracy: 5, speed: null, segment,
  }));

test("a steady run draws a flat pace", () => {
  const series = paceSeries(run(30, 30), 10);
  assert.ok(series.length >= 8);
  for (const point of series) assert.ok(Math.abs(point.value - 300) < 3, String(point.value));
});

test("a faster second half shows as a faster pace later on", () => {
  const slow = run(20, 36);
  const last = slow[slow.length - 1];
  const fast = Array.from({ length: 20 }, (_, i) => ({ ...last, ts: last.ts + (i + 1) * 24_000, lat: last.lat + (i + 1) * 0.0009 }));
  const series = paceSeries([...slow, ...fast], 4);
  assert.ok(series[0].value > series[series.length - 1].value + 60);
});

test("standing still is not drawn as a pace", () => {
  const standing = run(10, 30).map((point) => ({ ...point, lat: 48.45 }));
  assert.deepEqual(paceSeries(standing), []);
});

test("heart beats land at the distance reached when they were taken", () => {
  const points = run(20, 30);
  const beats = points.map((point, i) => ({ ts: point.ts + 5000, bpm: 120 + i }));
  const series = heartSeries(beats, points, 4);
  assert.equal(series.length, 4);
  assert.ok(series[0].value < series[3].value);
});

test("beats outside the run or during a pause are left out", () => {
  const first = run(5, 30, 0, 0);
  const second = run(5, 30, 1, 600, first[4].lat);
  const beats = [
    { ts: -10_000, bpm: 200 },
    { ts: 300_000, bpm: 200 },
    { ts: 30_000, bpm: 130 },
  ];
  const series = heartSeries(beats, [...first, ...second], 5);
  assert.ok(series.every((point) => point.value === 130));
});
