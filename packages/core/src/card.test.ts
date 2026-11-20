import assert from "node:assert/strict";
import { test } from "node:test";
import { cardsOf, rarestCards, rarityOf, setsOf, slotName, type CardRun } from "./card.ts";
import { setLanguage } from "./i18n.ts";

let nextId = 1;

/** A plain 5 km at 6:00/km, on a weekday at 10:00, unless told otherwise. */
function run(fields: Partial<CardRun> & { day?: number; hour?: number } = {}): CardRun {
  const { day = 1, hour = 10, ...rest } = fields;
  return {
    id: nextId++,
    startedAt: new Date(2026, 2, day, hour, 0).getTime(),
    distanceM: 5000, durationS: 1800, avgPaceSKm: 360, elevationGainM: 20, fastestKmS: 340,
    exertion: null, sessionId: null, blocks: [], weather: null, bestEfforts: { "1000": 340, "5000": 1800 },
    routeId: null, activity: "run", tags: [],
    ...rest,
  };
}

test("the same history deals the same cards", () => {
  const runs = [run({ day: 1 }), run({ day: 3, distanceM: 8000 }), run({ day: 5 })];
  assert.deepEqual([...cardsOf(runs)], [...cardsOf([...runs].reverse())]);
});

test("cards are numbered in order, each sport on its own", () => {
  const first = run({ day: 1 });
  const ride = run({ day: 2, activity: "ride", distanceM: 30_000, avgPaceSKm: 150, fastestKmS: null });
  const second = run({ day: 3 });
  const cards = cardsOf([second, ride, first]);
  assert.equal(cards.get(first.id)?.number, 1);
  assert.equal(cards.get(second.id)?.number, 2);
  assert.equal(cards.get(ride.id)?.number, 1);
  assert.equal(cards.get(ride.id)?.sport, "cycling");
});

test("a longer run and a faster 5K earn their traits", () => {
  const before = run({ day: 1 });
  const longer = run({ day: 3, distanceM: 12_000, bestEfforts: { "5000": 1700 } });
  const traits = cardsOf([before, longer]).get(longer.id)?.traits ?? [];
  assert.ok(traits.includes("longest"));
  assert.ok(traits.includes("best"));
  // Mostly one event: a longer run is where a new best is found. Rare, not exceptional.
  assert.equal(rarityOf(traits), "rare");
});

test("a record within GPS noise, or over 400 m, earns nothing", () => {
  const before = run({ day: 1, bestEfforts: { "400": 100, "5000": 1800 } });
  const barely = run({ day: 3, bestEfforts: { "400": 80, "5000": 1790 } });
  assert.ok(!cardsOf([before, barely]).get(barely.id)?.traits.includes("best"));
  const clearly = run({ day: 3, bestEfforts: { "5000": 1770 } });
  assert.ok(cardsOf([before, clearly]).get(clearly.id)?.traits.includes("best"));
});

test("the longest run has to be longer by a stride worth the name", () => {
  const before = run({ day: 1, distanceM: 10_000 });
  const loop = run({ day: 3, distanceM: 10_300 });
  assert.ok(!cardsOf([before, loop]).get(loop.id)?.traits.includes("longest"));
  const further = run({ day: 3, distanceM: 10_600 });
  assert.ok(cardsOf([before, further]).get(further.id)?.traits.includes("longest"));
});

test("a first run is no record: there is nothing yet to beat", () => {
  const only = run();
  assert.deepEqual(cardsOf([only]).get(only.id)?.traits, []);
});

test("a ride never fills a runner's set, nor counts as a run's record", () => {
  const ride = run({ day: 1, activity: "ride", distanceM: 40_000, bestEfforts: {} });
  const sets = setsOf([ride], cardsOf([ride]));
  assert.ok(sets.every((set) => set.slots.every((slot) => slot.runId === null)));
  const after = run({ day: 2, distanceM: 6000 });
  // The ride was longer, but it is not a run: this is still the first run, so no "longest".
  assert.deepEqual(cardsOf([ride, after]).get(after.id)?.traits, []);
});

test("a run too fast to be one earns nothing and fills nothing", () => {
  const car = run({ day: 1, hour: 6, fastestKmS: 90, avgPaceSKm: 100 });
  const cards = cardsOf([car]);
  const card = cards.get(car.id);
  assert.equal(card?.note, "tooFast");
  assert.deepEqual(card?.traits, []);
  assert.equal(card?.rarity, "common");
  assert.ok(setsOf([car], cards).every((set) => set.slots.every((slot) => slot.runId === null)));
});

test("a run too fast to be one is not what later runs are measured against", () => {
  const honest = run({ day: 1, distanceM: 6000 });
  const car = run({ day: 2, distanceM: 50_000, fastestKmS: 60, avgPaceSKm: 70 });
  const next = run({ day: 3, distanceM: 8000 });
  assert.ok(cardsOf([honest, car, next]).get(next.id)?.traits.includes("longest"));
});

test("weather is a small bonus, and none at its worst", () => {
  const rain = run({ weather: { feelsLikeC: 12, windKmh: 10, precipitationMm: 2, code: 61 } });
  const heat = run({ day: 2, weather: { feelsLikeC: 34, windKmh: 5, precipitationMm: 0, code: 0 } });
  const storm = run({ day: 3, weather: { feelsLikeC: 18, windKmh: 20, precipitationMm: 8, code: 95 } });
  const indoor = run({
    day: 4, activity: "treadmill", weather: { feelsLikeC: 12, windKmh: 10, precipitationMm: 2, code: 61 },
  });
  assert.deepEqual(cardsOf([rain]).get(rain.id)?.traits, ["rain"]);
  for (const outing of [heat, storm, indoor]) {
    const traits = cardsOf([outing]).get(outing.id)?.traits ?? [];
    assert.ok(!traits.some((trait) => ["rain", "wind", "cold", "snow"].includes(trait)), outing.activity);
  }
});

test("two very hard runs in a row: the second earns nothing, and says why", () => {
  const first = run({ day: 1, exertion: 5 });
  const second = run({ day: 2, exertion: 5, distanceM: 15_000, bestEfforts: { "5000": 1500 } });
  const card = cardsOf([first, second]).get(second.id);
  assert.equal(card?.note, "rest");
  assert.deepEqual(card?.traits, []);
});

test("an easy day kept easy is worth as much as a ghost beaten", () => {
  const history = [run({ day: 1, avgPaceSKm: 330 }), run({ day: 2, avgPaceSKm: 340 }), run({ day: 3, avgPaceSKm: 350 })];
  const easy = run({ day: 5, avgPaceSKm: 400, tags: ["easy"], exertion: 2 });
  const rushed = run({ day: 6, avgPaceSKm: 320, tags: ["easy"] });
  const cards = cardsOf([...history, easy, rushed]);
  assert.deepEqual(cards.get(easy.id)?.traits, ["patience"]);
  assert.equal(cards.get(easy.id)?.rarity, "notable");
  assert.ok(!cards.get(rushed.id)?.traits.includes("patience"));
});

test("a route run faster than before beats its ghost", () => {
  const first = run({ day: 1, routeId: 7, durationS: 1900 });
  const faster = run({ day: 2, routeId: 7, durationS: 1850 });
  const slower = run({ day: 3, routeId: 7, durationS: 2000 });
  const cards = cardsOf([first, faster, slower]);
  assert.ok(!cards.get(first.id)?.traits.includes("ghost"));
  assert.ok(cards.get(faster.id)?.traits.includes("ghost"));
  assert.ok(!cards.get(slower.id)?.traits.includes("ghost"));
});

test("stats are ranked against the runner's own history, from 1 to 99", () => {
  const runs = Array.from({ length: 12 }, (_, i) => run({ day: i + 1, distanceM: 4000 + i * 500 }));
  const cards = cardsOf(runs);
  assert.equal(cards.get(runs[runs.length - 1].id)?.stats.endurance, 99);
  for (const card of cards.values()) {
    for (const value of Object.values(card.stats)) {
      if (value !== null) assert.ok(value >= 1 && value <= 99, String(value));
    }
  }
  const treadmill = run({ day: 20, activity: "treadmill" });
  assert.equal(cardsOf([treadmill]).get(treadmill.id)?.stats.climb, null);
});

test("sets fill with the first run of each kind, and distances with the best", () => {
  const dawn = run({ day: 1, hour: 6 });
  const ten = run({ day: 2, hour: 18, distanceM: 10_200, bestEfforts: { "5000": 1750, "10000": 3600 } });
  const faster = run({ day: 3, hour: 12, bestEfforts: { "5000": 1600 } });
  const sets = setsOf([dawn, ten, faster], cardsOf([dawn, ten, faster]));
  const slot = (set: string, key: string) =>
    sets.find((s) => s.id === set)?.slots.find((s) => s.key === key)?.runId;
  assert.equal(slot("firstSteps", "firstRun"), dawn.id);
  assert.equal(slot("firstSteps", "first10k"), ten.id);
  assert.equal(slot("firstSteps", "firstRoute"), null);
  assert.equal(slot("distances", "5000"), faster.id);
  assert.equal(slot("distances", "10000"), ten.id);
  assert.equal(slot("clock", "dawn"), dawn.id);
  assert.equal(slot("clock", "evening"), ten.id);
  assert.equal(slot("clock", "night"), null);
});

test("the rarest cards come first, plain ones not at all", () => {
  const plain = run({ day: 1 });
  const rare = run({ day: 2, distanceM: 9000, bestEfforts: { "5000": 1700 } });
  const cards = cardsOf([plain, rare]);
  assert.deepEqual(rarestCards(cards, [plain, rare]).map((card) => card.runId), [rare.id]);
});

test("slots are said in words, in both languages", () => {
  setLanguage("en");
  assert.equal(slotName("distances", "5000"), "5K in one go");
  assert.equal(slotName("clock", "dawn"), "Before 7:00");
  setLanguage("fr");
  assert.equal(slotName("clock", "dawn"), "Avant 7 h");
});
