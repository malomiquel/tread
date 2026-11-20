import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ofSport } from "@tread/core/activity";
import { cardPoints, cardsOf, rarestCards, setsOf, type Card, type CardSet } from "@tread/core/card";
import { metaCardsOf, type MetaAlbum } from "@tread/core/metaCard";
import { listRuns, type Run } from "./db";
import { useSettings, weeklyGoal } from "./settings";

/** Everything the collection is made of, worked out from the runs. */
export interface Album {
  /** The running history, oldest first. */
  runs: Run[];
  /** Every outing, rides too, by id. */
  byId: Map<number, Run>;
  /** Every outing's card, rides too: a ride has a card on its page. */
  cards: Map<number, Card>;
  sets: CardSet[];
  meta: MetaAlbum;
  rarest: Card[];
  /** Every card, newest first. */
  newest: Card[];
}

/**
 * Deals the whole album from a history.
 *
 * The album is made of runs: a ride has a card of its own on its page, but
 * it plays in no set and no week.
 */
export function dealAlbum(all: readonly Run[], goal = weeklyGoal()): Album {
  const runs = ofSport(all).sort((a, b) => a.startedAt - b.startedAt || a.id - b.id);
  // Dealt from every outing: each sport is ranked against itself.
  const cards = cardsOf(all);
  const byId = new Map(all.map((run) => [run.id, run]));
  const startedAt = (card: Card) => byId.get(card.runId)?.startedAt ?? 0;
  return {
    runs,
    byId,
    cards,
    sets: setsOf(runs, cards),
    meta: metaCardsOf(runs, cards, goal),
    rarest: rarestCards(cards, runs, 8),
    newest: [...cards.values()].filter((card) => card.sport === "running").sort((a, b) => startedAt(b) - startedAt(a) || b.number - a.number),
  };
}

/**
 * The album, read again each time the screen comes into view, so a run
 * finished, edited or deleted elsewhere shows at once.
 *
 * Undefined while the first read is under way; `failed` once it could not
 * be read, keeping whatever was already shown.
 */
export function useAlbum(): { album: Album | undefined; failed: boolean; reload: () => void } {
  const [album, setAlbum] = useState<Album | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const settings = useSettings();
  const goal = weeklyGoal(settings);
  const goalKey = goal ? `${goal.kind}-${goal.target}` : "none";

  const reload = useCallback(() => {
    let active = true;
    listRuns()
      .then((all) => {
        if (!active) return;
        setAlbum(dealAlbum(all, weeklyGoal()));
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
    // The goal decides which weeks count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalKey]);
  useFocusEffect(reload);
  return { album, failed, reload };
}

/** At most this many cards are turned over in one go. */
const REVEAL_AT_ONCE = 8;

/**
 * The cards still to turn over, and the run up to which they count.
 *
 * Before the collection was ever opened every past run already has its card:
 * the first opening turns the finest of them, the rest are simply there.
 * After that, the cards of runs newer than the last one turned; when a whole
 * history arrives at once (an import, a new phone) only the finest of those
 * are turned, so the ceremony never becomes a chore.
 */
export function unseenCards(album: Album, seenThrough: number | null): { cards: Card[]; through: number; first: boolean } {
  const running = album.newest;
  const through = Math.max(0, ...running.map((card) => card.runId));
  const waiting = seenThrough === null ? running : running.filter((card) => card.runId > seenThrough);
  if (waiting.length === 0) return { cards: [], through, first: false };
  const chosen = waiting.length <= REVEAL_AT_ONCE && seenThrough !== null
    ? [...waiting].reverse()
    : [...waiting]
      .sort((a, b) => cardPoints(b.traits) - cardPoints(a.traits) || b.number - a.number)
      .slice(0, seenThrough === null ? 5 : REVEAL_AT_ONCE)
      .sort((a, b) => a.number - b.number);
  return { cards: chosen, through, first: seenThrough === null };
}
