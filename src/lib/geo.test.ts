import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bounds, currentPace, distanceM, elevationGainM, fastestKmS, isAcceptable,
  paceSecPerKm, regionAround, splits, totalDistanceM, type TrackPoint,
} from "./geo.ts";

const at = (ts: number, lat: number, lng: number, extra: Partial<TrackPoint> = {}): TrackPoint => ({
  ts, lat, lng, alt: null, accuracy: 5, speed: null, segment: 0, ...extra,
});

// Degrees of latitude per metre, derived from the same earth radius as geo.ts.
// Approximating it would make a 3 km fixture measure 2996 m and fail the test
// for the wrong reason.
const DEG_PER_M = 180 / (Math.PI * 6371008.8);

/** A straight line due north at a constant speed, one point per step. */
function straightLine(count: number, stepS = 1, speedMs = 3, segment = 0, startTs = 0): TrackPoint[] {
  return Array.from({ length: count }, (_, i) =>
    at(startTs + i * stepS * 1000, 48 + i * stepS * speedMs * DEG_PER_M, 2, { segment }));
}

test("haversine: Paris to Lyon within 1 percent", () => {
  const d = distanceM({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
  assert.ok(Math.abs(d - 392_000) < 4_000, `got ${d}`);
});

test("haversine: 100 m due north", () => {
  const d = distanceM({ lat: 48, lng: 2 }, { lat: 48 + 100 * DEG_PER_M, lng: 2 });
  assert.ok(Math.abs(d - 100) < 0.5);
});

test("filter: vague fix, impossible jump, and jitter while standing still", () => {
  const origin = at(0, 48, 2);
  assert.equal(isAcceptable(null, at(0, 48, 2, { accuracy: 80 })), false, "80 m accuracy rejected");
  assert.equal(isAcceptable(origin, at(1000, 48 + 50 * DEG_PER_M, 2)), false, "50 m in 1 s rejected");
  assert.equal(isAcceptable(origin, at(1000, 48 + 0.5 * DEG_PER_M, 2)), false, "0.5 m rejected as jitter");
  assert.equal(isAcceptable(origin, at(1000, 48 + 3 * DEG_PER_M, 2)), true, "3 m in 1 s accepted");
  assert.equal(isAcceptable(origin, at(0, 48 + 3 * DEG_PER_M, 2)), false, "same timestamp rejected");
});

test("total distance: 3 km at 3 m/s", () => {
  const d = totalDistanceM(straightLine(1001));
  assert.ok(Math.abs(d - 3000) < 3, `got ${d}`);
});

test("total distance: a pause does not join two segments", () => {
  const before = straightLine(101, 1, 3, 0, 0); // 300 m
  // During the pause we walked 500 m away, then resumed on a new segment.
  const after = straightLine(101, 1, 3, 1, 600_000).map((p) => ({ ...p, lat: p.lat + 500 * DEG_PER_M }));
  const d = totalDistanceM([...before, ...after]);
  assert.ok(Math.abs(d - 600) < 3, `got ${d}, the 500 m walk must not count`);
});

test("average pace: 5 min per km", () => {
  assert.equal(paceSecPerKm(2000, 600), 300);
  assert.equal(paceSecPerKm(20, 600), null, "too short to mean anything");
});

test("current pace over a 30 second window", () => {
  const points = straightLine(120);
  const pace = currentPace(points, points[points.length - 1].ts);
  assert.ok(pace !== null && Math.abs(pace - 333.33) < 2, `got ${pace}`);
});

test("splits: markers interpolated, trailing chunk flagged partial", () => {
  // 2.5 km at 3 m/s: two full kilometres of 333.3 s and a 500 m remainder.
  const result = splits(straightLine(834));
  assert.equal(result.length, 3);
  assert.ok(Math.abs(result[0].durationS - 333.33) < 1, `km 1 took ${result[0].durationS}`);
  assert.ok(Math.abs(result[1].durationS - 333.33) < 1, `km 2 took ${result[1].durationS}`);
  assert.equal(result[2].partial, true);
  assert.ok(Math.abs(result[2].distanceM - 499) < 3, `remainder ${result[2].distanceM}`);
});

test("splits: a pause does not stretch the kilometre it falls in", () => {
  const before = straightLine(201, 1, 3, 0, 0);            // 600 m in 200 s
  const after = straightLine(201, 1, 3, 1, 900_000)        // resumed 15 min later
    .map((p) => ({ ...p, lat: p.lat + 600 * DEG_PER_M }));
  const result = splits([...before, ...after]);
  assert.ok(Math.abs(result[0].durationS - 333.33) < 1, `km 1 took ${result[0].durationS}, pause leaked in`);
});

test("elevation: altitude jitter while standing still does not count", () => {
  // 4 m peak to peak, typical of a stationary GPS.
  const points = Array.from({ length: 60 }, (_, i) =>
    at(i * 1000, 48 + i * 3 * DEG_PER_M, 2, { alt: 100 + (i % 2 ? 2 : -2) }));
  assert.equal(elevationGainM(points), 0, "flat ground must report no climb");
});

test("elevation: a real climb is counted, within 15 percent", () => {
  // 100 m of steady climb. Smoothing trims the ends, hence the tolerance:
  // we check the order of magnitude, not an exact figure.
  const points = Array.from({ length: 101 }, (_, i) =>
    at(i * 1000, 48 + i * 3 * DEG_PER_M, 2, { alt: 100 + i }));
  const gain = elevationGainM(points);
  assert.ok(gain > 85 && gain < 105, `got ${gain}, expected around 100`);
});

test("elevation: a descent is not subtracted from the gain", () => {
  const up = Array.from({ length: 51 }, (_, i) =>
    at(i * 1000, 48 + i * 3 * DEG_PER_M, 2, { alt: 100 + i }));
  const down = Array.from({ length: 51 }, (_, i) =>
    at((51 + i) * 1000, 48 + (51 + i) * 3 * DEG_PER_M, 2, { alt: 150 - i }));
  const climbOnly = elevationGainM(up);
  const roundTrip = elevationGainM([...up, ...down]);
  assert.ok(Math.abs(roundTrip - climbOnly) < 6, `climb ${climbOnly}, round trip ${roundTrip}`);
});

test("fastest kilometre ignores the partial chunk", () => {
  const fastest = fastestKmS(straightLine(834)); // 2.5 km: two full km then a remainder
  assert.ok(fastest !== null && Math.abs(fastest - 333.33) < 1, `got ${fastest}`);
});

test("bounds: null when empty, otherwise the enclosing box", () => {
  assert.equal(bounds([]), null);
  const box = bounds([at(0, 48, 2), at(1, 49, 3)]);
  assert.deepEqual(box, { minLat: 48, maxLat: 49, minLng: 2, maxLng: 3 });
});

test("regionAround centres on the track and leaves a margin", () => {
  const region = regionAround([
    at(0, 48.85, 2.34),
    at(1, 48.87, 2.38),
  ])!;
  assert.ok(Math.abs(region.latitude - 48.86) < 1e-9, "centré en latitude");
  assert.ok(Math.abs(region.longitude - 2.36) < 1e-9, "centré en longitude");
  // The span is 0.02 wide, so the framing must be wider than the track itself.
  assert.ok(region.latitudeDelta > 0.02, "marge en latitude");
  assert.ok(region.longitudeDelta > 0.04, "marge en longitude");
});

test("regionAround refuses to magnify a run around the block", () => {
  const region = regionAround([at(0, 48.8566, 2.3522), at(1, 48.8567, 2.3523)])!;
  assert.ok(region.latitudeDelta >= 0.0035, "plancher de zoom en latitude");
  assert.ok(region.longitudeDelta >= 0.0035, "plancher de zoom en longitude");
});

test("regionAround has nothing to frame without points", () => {
  assert.equal(regionAround([]), null);
});

test("regionAround lifts the track when asked", () => {
  const points = [at(0, 48.85, 2.34), at(1, 48.87, 2.38)];
  const plain = regionAround(points)!;
  const lifted = regionAround(points, 1.35, 0.2)!;

  // Lowering the camera is what raises the track in frame, so the centre of
  // the lifted view sits south of the plain one.
  assert.ok(lifted.latitude < plain.latitude, "centre abaissé");
  assert.equal(lifted.latitudeDelta, plain.latitudeDelta, "zoom inchangé");
  assert.equal(lifted.longitude, plain.longitude, "longitude inchangée");
});
