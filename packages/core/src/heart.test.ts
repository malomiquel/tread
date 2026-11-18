import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBpm, maxHeartRateFor, parseHeart, summarise, zoneOf, type Beat } from "./heart.ts";

/** A watch reporting every five seconds, as one does during a workout. */
function series(rates: number[], everyS = 5): Beat[] {
  return rates.map((bpm, index) => ({ ts: index * everyS * 1000, bpm }));
}

test("the maximum is two hundred and twenty less your age", () => {
  const thirty = new Date(1996, 5, 12).getTime();
  assert.equal(maxHeartRateFor(thirty, new Date(2026, 5, 12).getTime()), 190);
  assert.equal(maxHeartRateFor(thirty, new Date(2026, 5, 11).getTime()), 190);
});

test("no date of birth, no maximum, rather than a guess", () => {
  assert.equal(maxHeartRateFor(null, Date.now()), null);
  assert.equal(maxHeartRateFor(Number.NaN, Date.now()), null);
  // A date that would make the runner two years old, or a hundred and twenty.
  assert.equal(maxHeartRateFor(new Date(2025, 0, 1).getTime(), new Date(2026, 0, 1).getTime()), null);
  assert.equal(maxHeartRateFor(new Date(1880, 0, 1).getTime(), new Date(2026, 0, 1).getTime()), null);
});

test("the zones are cut at sixty, seventy, eighty and ninety percent", () => {
  assert.equal(zoneOf(100, 190), 0);
  assert.equal(zoneOf(113, 190), 0);
  assert.equal(zoneOf(115, 190), 1);
  assert.equal(zoneOf(140, 190), 2);
  assert.equal(zoneOf(160, 190), 3);
  assert.equal(zoneOf(175, 190), 4);
  assert.equal(zoneOf(200, 190), 4);
});

test("an average is weighted by how long each reading stood", () => {
  // Two minutes at 140 then ten seconds at 180: the average belongs near 140.
  const beats: Beat[] = [
    ...series(Array<number>(24).fill(140)),
    { ts: 120_000, bpm: 180 },
    { ts: 125_000, bpm: 180 },
  ];
  const heart = summarise(beats, 190);
  assert.equal(heart?.maxBpm, 180);
  assert.ok(heart !== null && heart.avgBpm >= 140 && heart.avgBpm <= 145, `average ${heart?.avgBpm}`);
});

test("time is counted into the zone each reading belongs to", () => {
  // Six readings five seconds apart: three easy, three hard.
  const heart = summarise(series([110, 110, 110, 175, 175, 175]), 190);
  assert.equal(heart?.zonesS[0], 15);
  assert.equal(heart?.zonesS[4], 15);
  assert.equal(heart?.zonesS[1], 0);
});

test("a gap in the recording is not credited to a zone", () => {
  // Two readings an hour apart: the first stands for thirty seconds, not for
  // the whole hour it was alone.
  const heart = summarise([{ ts: 0, bpm: 150 }, { ts: 3_600_000, bpm: 150 }], 190);
  const counted = (heart?.zonesS ?? []).reduce((total, seconds) => total + seconds, 0);
  assert.ok(counted <= 60, `counted ${counted} s`);
});

test("without a maximum there are no zones, only an average and a peak", () => {
  const heart = summarise(series([120, 150, 170]), null);
  // Three readings of equal weight: their mean, rounded up from 146.67.
  assert.equal(heart?.avgBpm, 147);
  assert.equal(heart?.maxBpm, 170);
  assert.deepEqual(heart?.zonesS, []);
  assert.equal(heart?.maxHeartRate, null);
});

test("a wrist that lost contact is not a record", () => {
  // 12 and 300 are what a watch reports when it is reading a sleeve.
  const heart = summarise(series([12, 145, 300, 150]), 190);
  assert.equal(heart?.maxBpm, 150);
  assert.ok(heart !== null && heart.avgBpm >= 145 && heart.avgBpm <= 150);
});

test("no readings at all is no summary", () => {
  assert.equal(summarise([], 190), null);
  assert.equal(summarise(series([400, 1]), 190), null);
});

test("readings out of order are put back in order", () => {
  const jumbled: Beat[] = [
    { ts: 10_000, bpm: 170 },
    { ts: 0, bpm: 120 },
    { ts: 5_000, bpm: 120 },
  ];
  assert.equal(summarise(jumbled, 190)?.avgBpm, summarise(series([120, 120, 170]), 190)?.avgBpm);
});

test("a summary comes back out of the database as it went in", () => {
  const stored = { avgBpm: 148, maxBpm: 172, zonesS: [0, 1100, 550, 160, 0], maxHeartRate: 190 };
  assert.deepEqual(parseHeart(JSON.stringify(stored)), stored);
});

test("an unreadable summary is the same as none", () => {
  assert.equal(parseHeart(null), null);
  assert.equal(parseHeart("{"), null);
  assert.equal(parseHeart("[]"), null);
  assert.equal(parseHeart('{"avgBpm":148}'), null);
});

test("beats are shown whole", () => {
  assert.equal(formatBpm(147.6), "148");
});
