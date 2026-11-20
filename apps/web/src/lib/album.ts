import { ofSport, RUN_TAGS } from "@tread/core/activity";
import { cardsOf, rarestCards, setsOf, type Card, type CardRun, type CardSet } from "@tread/core/card";
import { goalFromSettings, readGoalKind, type WeeklyGoal } from "@tread/core/goals";
import { metaCardsOf, type MetaAlbum } from "@tread/core/metaCard";
import type { CardOuting } from "./types.ts";

/**
 * The collection, dealt in the browser from the outings the server sends,
 * with the phone's own rules (`@tread/core/card`, `@tread/core/metaCard`):
 * the same history deals the same cards on both.
 *
 * The rules number runs; the server names outings by a string. Each outing
 * is given a number here, its place in the history from the oldest, which
 * keeps the order the rules break ties by. Outings are unique by their start
 * on an account, so that order is the phone's.
 */

/** An outing as the rules read it, with its number in the album. */
export interface AlbumRun extends CardRun {
  outing: CardOuting;
}

export interface Album {
  /** Every outing, rides too, by its number in the album. */
  byNumber: Map<number, AlbumRun>;
  /** The number of an outing, by its id. */
  numberOf: Map<string, number>;
  /** Every outing's card, rides too: a ride has a card on its page. */
  cards: Map<number, Card>;
  sets: CardSet[];
  meta: MetaAlbum;
  rarest: Card[];
  /** Every run's card, newest first. Rides play in no set. */
  newest: Card[];
}

const positive = (raw: string | undefined): number | null => {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0 ? value : null;
};

/** The weekly goal the phone sent with its settings, or none. */
export function goalOf(settings: Record<string, string>): WeeklyGoal | null {
  return goalFromSettings({
    goalKind: readGoalKind(settings.goalKind),
    weeklyGoalM: positive(settings.weeklyGoalM),
    weeklyGoalS: positive(settings.weeklyGoalS),
    weeklyGoalClimbM: positive(settings.weeklyGoalClimbM),
  });
}

/** An outing as the rules read it. */
function toCardRun(outing: CardOuting, id: number): AlbumRun {
  return {
    id,
    outing,
    startedAt: outing.startedAt,
    distanceM: outing.distanceM,
    durationS: outing.durationS,
    avgPaceSKm: outing.avgPaceSKm,
    elevationGainM: outing.elevationGainM,
    fastestKmS: outing.fastestKmS,
    exertion: outing.exertion,
    sessionId: outing.sessionId,
    blocks: outing.blocks,
    weather: outing.weather,
    bestEfforts: outing.efforts,
    routeId: outing.routeRef,
    activity: outing.activity,
    tags: RUN_TAGS.filter((tag) => outing.tags.includes(tag)),
  };
}

/** Deals the whole album from a history, in any order. */
export function dealAlbum(outings: readonly CardOuting[], goal: WeeklyGoal | null): Album {
  const ordered = [...outings].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
  const all = ordered.map((outing, index) => toCardRun(outing, index + 1));
  const runs = ofSport(all);
  // Dealt from every outing: each sport is ranked against itself.
  const cards = cardsOf(all);
  const byNumber = new Map(all.map((run) => [run.id, run]));
  const startedAt = (card: Card) => byNumber.get(card.runId)?.startedAt ?? 0;
  return {
    byNumber,
    numberOf: new Map(all.map((run) => [run.outing.id, run.id])),
    cards,
    sets: setsOf(runs, cards),
    meta: metaCardsOf(runs, cards, goal),
    rarest: rarestCards(cards, runs, 8),
    newest: [...cards.values()]
      .filter((card) => card.sport === "running")
      .sort((a, b) => startedAt(b) - startedAt(a) || b.number - a.number),
  };
}

/** One outing's card, by its id. */
export function cardOf(album: Album, outingId: string): Card | undefined {
  const number = album.numberOf.get(outingId);
  return number === undefined ? undefined : album.cards.get(number);
}
