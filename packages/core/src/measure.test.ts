import assert from "node:assert/strict";
import { test } from "node:test";
import { measureTrack } from "./measure.ts";
import type { TrackPoint } from "./geo.ts";

const at = (i: number, segment = 0): TrackPoint => ({
  ts: 1_700_000_000_000 + i * 10_000, lat: 48.85 + i * 0.0003, lng: 2.35, alt: null, accuracy: null, speed: null, segment,
});

test("a track with fewer than two fixes measures nothing", () => {
  assert.equal(measureTrack(null, [at(0)]), null);
});

test("pauses between segments do not count as moving time", () => {
  const points = [at(0), at(1), at(5, 1), at(6, 1)];
  const measured = measureTrack("Tempo", points);
  assert.ok(measured);
  assert.equal(measured.durationS, 20);
  assert.equal(measured.name, "Tempo");
  assert.equal(measured.startedAt, points[0].ts);
  assert.equal(measured.endedAt, points[3].ts);
});

test("a ride gets no fastest kilometre and a ride's name", () => {
  const measured = measureTrack(null, [at(0), at(1)], "ride");
  assert.equal(measured?.fastestKmS, null);
  assert.ok(measured?.name);
});
