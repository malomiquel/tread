import assert from "node:assert/strict";
import { test } from "node:test";
import { cardsOf, setsOf, type CardRun } from "@tread/core/card";
import type { BestEfforts } from "@tread/core/efforts";
import { metaCardsOf } from "@tread/core/metaCard";
import { cardOf, dealAlbum, goalOf } from "./album.ts";
import type { CardOuting } from "./types.ts";

const DAY = 86_400_000;
const start = new Date(2026, 0, 5, 8, 0).getTime();

/** A history as the phone holds it: numbered runs, a ride among them, a race at the end. */
const phone: CardRun[] = Array.from({ length: 24 }, (_, index) => {
  const ride = index % 7 === 3;
  const distanceM = ride ? 30_000 : 5000 + index * 450;
  const durationS = ride ? 3600 : distanceM * (0.33 - index * 0.002);
  const pace = durationS / (distanceM / 1000);
  return {
    id: index + 1,
    startedAt: start + index * 2.5 * DAY + (index % 5 === 0 ? -2 * 3_600_000 : 0),
    distanceM,
    durationS,
    avgPaceSKm: ride ? 120 : pace,
    elevationGainM: index * 12,
    fastestKmS: ride ? 90 : pace * 0.95,
    exertion: null,
    sessionId: null,
    blocks: [],
    weather: index === 4 ? { feelsLikeC: 1, windKmh: 8, precipitationMm: 0, code: 3 } : null,
    bestEfforts: (ride ? {} : { 1000: pace * 0.97, 5000: durationS * (5000 / distanceM) }) as BestEfforts,
    routeId: null,
    activity: ride ? "ride" : "run",
    tags: index === 23 ? ["race"] : index === 10 ? ["easy"] : [],
  };
});

const serverId = (id: number) => `outing-${1000 - id}`;

/** The same history as the server sends it: named by strings, newest first. */
const server: CardOuting[] = phone.map((run) => ({
  id: serverId(run.id),
  startedAt: run.startedAt,
  endedAt: run.startedAt + run.durationS * 1000,
  activity: run.activity,
  name: null,
  distanceM: run.distanceM,
  durationS: run.durationS,
  avgPaceSKm: run.avgPaceSKm,
  elevationGainM: run.elevationGainM,
  shape: [],
  fastestKmS: run.fastestKmS,
  exertion: run.exertion,
  sessionId: run.sessionId,
  tags: [...run.tags, "unknown"],
  blocks: [...run.blocks],
  weather: run.weather ? { temperatureC: 3, day: true, ...run.weather } : null,
  efforts: run.bestEfforts,
})).reverse();

const withoutId = <T extends { runId: number }>(card: T) => ({ ...card, runId: 0 });

test("the web deals every outing the card the phone deals it", () => {
  const expected = cardsOf(phone);
  const album = dealAlbum(server, null);
  for (const run of phone) {
    const card = cardOf(album, serverId(run.id));
    assert.ok(card, `run ${run.id} has a card`);
    assert.deepEqual(withoutId(card), withoutId(expected.get(run.id)!));
  }
  // The history is not dealt flat: there is something to compare.
  assert.ok([...expected.values()].some((card) => card.traits.length > 0));
});

test("its sets and great cards are the phone's, run for run", () => {
  const goal = goalOf({ goalKind: "distance", weeklyGoalM: "10000" });
  const runs = phone.filter((run) => run.activity !== "ride");
  const cards = cardsOf(phone);
  const album = dealAlbum(server, goal);
  const startOf = (number: number | null) => (number === null ? null : album.byNumber.get(number)!.startedAt);
  const phoneStart = (id: number | null) => (id === null ? null : phone.find((run) => run.id === id)!.startedAt);

  assert.deepEqual(
    album.sets.map((set) => set.slots.map((slot) => startOf(slot.runId))),
    setsOf(runs, cards).map((set) => set.slots.map((slot) => phoneStart(slot.runId))),
  );
  const meta = metaCardsOf(runs, cards, goal);
  for (const kind of ["weeks", "blocks", "races"] as const) {
    assert.deepEqual(
      album.meta[kind].map((card) => [card.key, card.tier, card.runIds.map(startOf)]),
      meta[kind].map((card) => [card.key, card.tier, card.runIds.map(phoneStart)]),
    );
  }
  assert.equal(album.meta.races.length, 1);
  assert.ok(album.meta.weeks.length > 0);
});

test("a ride has its card but stays out of the album", () => {
  const album = dealAlbum(server, null);
  const ride = server.find((outing) => outing.activity === "ride")!;
  assert.equal(cardOf(album, ride.id)?.sport, "cycling");
  assert.ok(album.newest.length > 0);
  assert.ok(album.newest.every((card) => card.sport === "running"));
});

test("the weekly goal is read from the phone's settings", () => {
  assert.deepEqual(goalOf({ goalKind: "time", weeklyGoalS: "7200" }), { kind: "time", target: 7200 });
  assert.equal(goalOf({}), null);
  assert.equal(goalOf({ weeklyGoalM: "nope" }), null);
});
