import assert from "node:assert/strict";
import { test } from "node:test";
import { cardsOf, type Card, type CardRun } from "./card.ts";
import {
  DECK_BUDGET, decodeDeck, deckCost, deckProblem, duelCard, encodeDeck, playDuel, suggestDeck, terrains,
  type DuelCard,
} from "./duel.ts";

function card(fields: Partial<DuelCard> = {}): DuelCard {
  return {
    number: 1, rarity: "common", stats: { endurance: 50, speed: 50, climb: 50, steady: 50 },
    traits: [], distanceM: 5000, ...fields,
  };
}

const deck = (offset: number, fields: Partial<DuelCard> = {}): DuelCard[] =>
  [0, 1, 2, 3, 4].map((i) => card({ number: offset + i, ...fields }));

test("a deck travels as a code and comes back the same", () => {
  const cards = [
    card({ number: 12, rarity: "rare", traits: ["best", "rain"], stats: { endurance: 80, speed: 91, climb: 0, steady: 12 } }),
    card({ number: 3, rarity: "notable", traits: ["patience"], distanceM: 12_300 }),
    card({ number: 40, traits: [] }),
    card({ number: 41, traits: ["anniversary"] }),
    card({ number: 1234, rarity: "notable", traits: ["session", "early"] }),
  ];
  const code = encodeDeck(cards);
  assert.match(code, /^[0-9a-z.~-]+$/);
  assert.deepEqual(decodeDeck(code), cards);
});

test("a code cut short or altered is refused", () => {
  const code = encodeDeck(deck(1));
  assert.equal(decodeDeck(code.slice(0, -3)), null);
  assert.equal(decodeDeck(code.replace("1.", "2.")), null);
  assert.equal(decodeDeck("nonsense"), null);
});

test("a deck has five cards, a budget and one exceptional at most", () => {
  assert.equal(deckProblem(deck(1)), null);
  assert.equal(deckProblem(deck(1).slice(0, 4)), "size");
  assert.equal(deckProblem(deck(1, { rarity: "rare" })), "budget");
  const twoExceptional = [...deck(1).slice(0, 3), card({ number: 9, rarity: "exceptional" }), card({ number: 10, rarity: "exceptional" })];
  assert.equal(deckProblem(twoExceptional), "exceptional");
  assert.equal(deckProblem([...deck(1).slice(0, 4), card({ number: 1 })]), "duplicate");
});

test("both phones play the same duel, whoever is home", () => {
  const mine = deck(1, { stats: { endurance: 70, speed: 30, climb: 40, steady: 60 } });
  const theirs = deck(100, { stats: { endurance: 40, speed: 75, climb: 50, steady: 30 } });
  assert.deepEqual(terrains(encodeDeck(mine), encodeDeck(theirs)), terrains(encodeDeck(theirs), encodeDeck(mine)));
  const here = playDuel(mine, theirs);
  const there = playDuel(theirs, mine);
  assert.equal(here.home, there.away);
  assert.equal(here.away, there.home);
  assert.equal(here.winner === "home", there.winner === "away");
  assert.equal(here.rounds.length, 5);
  // Every stat is played at least once.
  assert.equal(new Set(here.rounds.map((round) => round.terrain)).size, 4);
});

test("patience beats a faster card", () => {
  const slow = deck(1, { stats: { endurance: 50, speed: 20, climb: 50, steady: 50 }, traits: ["patience"] });
  const fast = deck(100, { stats: { endurance: 50, speed: 60, climb: 50, steady: 50 } });
  const duel = playDuel(slow, fast);
  const nonSpeed = duel.rounds.filter((round) => round.terrain !== "speed");
  for (const round of nonSpeed) {
    assert.deepEqual(round.home.bonuses, [{ trait: "patience", points: 12 }]);
    assert.equal(round.winner, "home");
  }
});

test("a record plays on speed, a long run on endurance", () => {
  const duel = playDuel(deck(1, { traits: ["best", "longest"] }), deck(100));
  for (const round of duel.rounds) {
    const expected = round.terrain === "speed" ? ["best"] : round.terrain === "endurance" ? ["longest"] : [];
    assert.deepEqual(round.home.bonuses.map((bonus) => bonus.trait), expected);
  }
});

test("level decks draw", () => {
  assert.equal(playDuel(deck(1), deck(100)).winner, "draw");
});

let nextId = 1;
function run(day: number, fields: Partial<CardRun> = {}): CardRun {
  return {
    id: nextId++, startedAt: new Date(2026, 2, day, 10).getTime(),
    distanceM: 5000 + day * 300, durationS: 1800, avgPaceSKm: 360 - day, elevationGainM: 20, fastestKmS: 340,
    exertion: null, sessionId: null, blocks: [], weather: null, bestEfforts: null,
    routeId: null, activity: "run", tags: [], ...fields,
  };
}

test("the suggested deck keeps to the rules", () => {
  const runs = Array.from({ length: 20 }, (_, i) => run(i + 1, i % 3 === 0 ? { tags: ["race"] } : {}));
  const cards = [...cardsOf(runs).values()];
  const chosen = suggestDeck(cards)!;
  assert.equal(chosen.length, 5);
  const travelling = chosen.map((one: Card) => duelCard(one, 5000));
  assert.equal(deckProblem(travelling), null);
  assert.ok(deckCost(travelling) <= DECK_BUDGET);
  assert.equal(suggestDeck(cards.slice(0, 4)), null);
});

test("a ride never goes into a deck", () => {
  const rides = Array.from({ length: 6 }, (_, i) => run(i + 1, { activity: "ride", distanceM: 30_000, avgPaceSKm: 150 }));
  assert.equal(suggestDeck([...cardsOf(rides).values()]), null);
});
