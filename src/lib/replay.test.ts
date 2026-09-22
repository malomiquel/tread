import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReplay, drawnSoFar, headAt, REPLAY_MS, thin } from "./replay.ts";
import type { TrackPoint } from "./geo.ts";

/** A straight run north, one fix a second unless told otherwise. */
function line(count: number, everyMs = 1000, segment = 0, from = 0): TrackPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    ts: from + i * everyMs,
    lat: 48.45 + i / 10_000,
    lng: 1.49,
    alt: null, accuracy: 5, speed: null, segment,
  }));
}

test("a track too short to draw is no replay", () => {
  assert.equal(buildReplay([]), null);
  assert.equal(buildReplay(line(1)), null);
});

test("the timeline counts the run, in order", () => {
  const track = buildReplay(line(4))!;
  assert.deepEqual(track.marks, [0, 1000, 2000, 3000]);
  assert.equal(track.totalMs, 3000);
  assert.ok(track.totalM > 0);
  // Each metre mark is further along than the one before it.
  assert.deepEqual(track.metres, [...track.metres].sort((a, b) => a - b));
});

test("a pause costs the replay nothing", () => {
  // Two legs of four seconds each, eleven minutes apart.
  const paused = [...line(5), ...line(5, 1000, 1, 660_000)];
  const track = buildReplay(paused)!;
  assert.equal(track.totalMs, 8000);
});

test("a gap nobody recorded as a pause is still not sat through", () => {
  // One leg, but four minutes between two fixes: a phone under a bridge.
  const lost = [...line(3), ...line(3, 1000, 0, 240_000)];
  const track = buildReplay(lost)!;
  // The three real seconds, plus the capped gap, plus three more.
  assert.ok(track.totalMs <= 2000 + 20_000 + 2000, `total ${track.totalMs}`);
  assert.ok(track.totalMs > 4000);
});

test("the head starts at the start and ends at the end", () => {
  const track = buildReplay(line(10))!;
  const start = headAt(track, 0);
  assert.equal(start.index, 0);
  assert.equal(start.metresRun, 0);
  assert.equal(start.done, false);

  const end = headAt(track, 1);
  assert.equal(end.done, true);
  assert.equal(Math.round(end.metresRun), Math.round(track.totalM));
  assert.equal(end.lat, track.points[track.points.length - 1].lat);
});

test("the head glides between two fixes rather than snapping to one", () => {
  const track = buildReplay(line(3))!;
  // A quarter of the way: half of the first of two one-second legs.
  const head = headAt(track, 0.25);
  assert.equal(head.index, 0);
  assert.ok(head.fraction > 0.4 && head.fraction < 0.6, `fraction ${head.fraction}`);
  assert.ok(head.lat > track.points[0].lat && head.lat < track.points[1].lat);
});

test("the head crosses a pause without ever being inside it", () => {
  // Two legs a hundred metres and ten minutes apart. There is no ground
  // between them, so there is no position between them either: the head is
  // on one side or the other, never gliding over the gap.
  const paused = [...line(3), ...line(3, 1000, 1, 600_000)];
  const track = buildReplay(paused)!;

  const head = headAt(track, 2000 / track.totalMs);
  assert.equal(head.fraction, 0);
  assert.equal(head.lat, track.points[head.index].lat);

  // A moment earlier it is still drawing the first leg.
  const before = headAt(track, 1900 / track.totalMs);
  assert.equal(track.points[before.index].segment, 0);
});

test("a slow stretch takes longer to draw than a fast one", () => {
  // Same ground twice over: the first half at a fix a second, the second at
  // one every four. Half the replay should still be inside the slow half.
  const slow = line(5, 4000);
  const fast = line(5, 1000, 0, 16_000).map((p, i) => ({ ...p, lat: 48.4504 + i / 10_000 }));
  const track = buildReplay([...slow, ...fast])!;
  const middle = headAt(track, 0.5);
  assert.ok(middle.index < 5, `the halfway head sat at point ${middle.index}`);
});

test("what is drawn stops at the head, and never crosses a pause", () => {
  const paused = [...line(4), ...line(4, 1000, 1, 600_000)];
  const track = buildReplay(paused)!;

  const early = drawnSoFar(track, headAt(track, 0.25));
  assert.equal(early.length, 1);

  const whole = drawnSoFar(track, headAt(track, 1));
  assert.equal(whole.length, 2, "two legs, never joined");
  assert.deepEqual(whole.flat().map((p) => p.segment).sort(), [0, 0, 0, 0, 1, 1, 1, 1]);
});

test("nothing is drawn before there are two points to draw between", () => {
  const track = buildReplay(line(10))!;
  assert.deepEqual(drawnSoFar(track, headAt(track, 0)), []);
});

test("a long run is thinned, keeping both ends and every pause", () => {
  const long = [...line(900), ...line(900, 1000, 1, 2_000_000)];
  const kept = thin(long, 600);
  assert.ok(kept.length <= 620, `kept ${kept.length}`);
  assert.equal(kept[0].ts, long[0].ts);
  assert.equal(kept[kept.length - 1].ts, long[long.length - 1].ts);
  // The last fix before the pause and the first after it both survive.
  assert.ok(kept.some((p) => p.ts === long[899].ts));
  assert.ok(kept.some((p) => p.ts === long[900].ts));
});

test("a short run is left exactly as it is", () => {
  const short = line(40);
  assert.deepEqual(thin(short, 600), short);
});

test("the replay lasts the same time whatever the run", () => {
  assert.equal(REPLAY_MS, 12_000);
});
