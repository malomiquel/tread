import assert from "node:assert/strict";
import { test } from "node:test";
import { cardsOf, type CardRun } from "./card.ts";
import { blockCards, completedBy, metaCardsOf, raceCards, weekCards } from "./metaCard.ts";

let nextId = 1;
/** A 5 km on a day of 2026, March 2 being a Monday. */
function run(month: number, day: number, fields: Partial<CardRun> = {}): CardRun {
  return {
    id: nextId++, startedAt: new Date(2026, month, day, 10).getTime(),
    distanceM: 5000, durationS: 1800, avgPaceSKm: 360, elevationGainM: 20, fastestKmS: 340,
    exertion: null, sessionId: null, blocks: [], weather: null, bestEfforts: null,
    routeId: null, activity: "run", tags: [], ...fields,
  };
}

test("without a goal a week counts from two runs", () => {
  const runs = [run(2, 2), run(2, 4), run(2, 10)];
  const weeks = weekCards(runs, cardsOf(runs), null);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].runs, 2);
  assert.deepEqual(weeks[0].runIds, [runs[0].id, runs[1].id]);
});

test("with a goal a week counts when the goal is met, however many runs", () => {
  const runs = [run(2, 2, { distanceM: 12_000 }), run(2, 10), run(2, 11)];
  const weeks = weekCards(runs, cardsOf(runs), { kind: "distance", target: 10_000 });
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].runs, 1);
});

test("a ride never holds a week", () => {
  const runs = [run(2, 2, { activity: "ride", distanceM: 30_000, avgPaceSKm: 150 }), run(2, 3)];
  assert.equal(weekCards(runs, cardsOf(runs), null).length, 0);
});

test("four weeks in a row make a block, a missed week starts again", () => {
  const days = [2, 4, 9, 11, 16, 18, 23, 25, /* gap */ 6 + 31, 8 + 31];
  const runs = days.map((day) => run(2, day));
  const cards = cardsOf(runs);
  const weeks = weekCards(runs, cards, null);
  assert.equal(weeks.length, 5);
  const blocks = blockCards(weeks, cards, runs);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].runs, 8);
  assert.equal(blocks[0].weeks, 4);
});

test("a race seals the runs before it, back to the race before", () => {
  const first = run(1, 1, { tags: ["race"], distanceM: 10_000 });
  const training = [run(1, 10), run(1, 20), run(2, 1)];
  const second = run(2, 15, { sessionId: "race-half", distanceM: 21_097 });
  const runs = [first, ...training, second];
  const races = raceCards(runs, cardsOf(runs));
  assert.equal(races.length, 2);
  assert.deepEqual(races[0].runIds, [first.id]);
  assert.deepEqual(races[1].runIds, [...training.map((one) => one.id), second.id]);
  assert.equal(races[1].tier, "legendary");
  assert.equal(races[1].raceRunId, second.id);
});

test("a run says which meta cards it completed", () => {
  const runs = [run(2, 2), run(2, 4, { tags: ["race"] })];
  const album = metaCardsOf(runs, cardsOf(runs), null);
  const kinds = completedBy(album, runs[1].id).map((card) => card.kind);
  assert.deepEqual(kinds, ["race", "week"]);
  assert.deepEqual(completedBy(album, runs[0].id), []);
});
