import { cardPoints, RARITIES, STAT_KEYS, type Card, type Rarity, type StatKey, type Trait } from "./card.ts";
import { defineStrings } from "./i18n.ts";

/**
 * Duels: two decks of five cards, set against each other round by round.
 *
 * Nothing here needs an account or a server. A deck travels as a short code
 * in a link, holding only what the cards say (their number, rarity, stats,
 * traits and distance): no place, no outline, no date, no name. Both phones
 * play the same duel from the same two codes and reach the same result,
 * because nothing is random: the rounds' terrains come from a hash of the two
 * decks.
 *
 * The rules keep the cards honest towards the body that earned them. A deck
 * has a budget, so it cannot be five exceptional cards: the common runs have
 * to play too. And the traits a careful runner earns (Patience, Session held)
 * win rounds as surely as a record does.
 *
 * Nothing is at stake. A duel is won or lost and that is all: no card
 * changes hands, nothing is taken away, nothing is bought.
 */

export const DECK_SIZE = 5;
/** What five cards may cost together: two rare and three plain, say. */
export const DECK_BUDGET = 12;

export const RARITY_COST: Record<Rarity, number> = { common: 1, notable: 2, rare: 3, exceptional: 4 };

/** A card as it travels in a deck: what the opponent is allowed to see. */
export interface DuelCard {
  number: number;
  rarity: Rarity;
  /** From 1 to 99, or 0 when the run had nothing to measure it by. */
  stats: Record<StatKey, number>;
  traits: Trait[];
  /** Rounded to 100 m. */
  distanceM: number;
}

export type DeckProblem = "size" | "budget" | "exceptional" | "duplicate";

export const deckCost = (cards: readonly Pick<DuelCard, "rarity">[]): number =>
  cards.reduce((sum, card) => sum + RARITY_COST[card.rarity], 0);

/** What is wrong with a deck, or null when it can be played. */
export function deckProblem(cards: readonly (DuelCard & { runId?: number })[]): DeckProblem | null {
  if (cards.length !== DECK_SIZE) return "size";
  const ids = cards.map((card) => card.runId ?? card.number);
  if (new Set(ids).size !== ids.length) return "duplicate";
  if (cards.filter((card) => card.rarity === "exceptional").length > 1) return "exceptional";
  if (deckCost(cards) > DECK_BUDGET) return "budget";
  return null;
}

/** Whether a card may go into a deck at all: runs only, and honest ones. */
export const playable = (card: Card): boolean => card.sport === "running" && card.note !== "tooFast";

/** The card as a deck carries it. */
export function duelCard(card: Card, distanceM: number): DuelCard {
  const stats = {} as Record<StatKey, number>;
  for (const key of STAT_KEYS) stats[key] = card.stats[key] ?? 0;
  return {
    number: card.number,
    rarity: card.rarity,
    stats,
    traits: [...card.traits],
    distanceM: Math.round(distanceM / 100) * 100,
  };
}

/** How much a card is worth to a deck, for the suggested one. */
const strength = (card: Card): number =>
  STAT_KEYS.reduce((sum, key) => sum + (card.stats[key] ?? 0), 0) + 12 * cardPoints(card.traits);

/**
 * The five cards that make the strongest deck within the rules.
 *
 * A small knapsack: exactly five cards, the budget, one exceptional at most,
 * the most strength. Exact rather than greedy, since a greedy pick of the
 * rarest cards first spends the budget and leaves no room for the fifth.
 * Null when there are not five cards that fit.
 */
export function suggestDeck(cards: readonly Card[]): Card[] | null {
  const pool = cards.filter(playable).sort((a, b) => strength(b) - strength(a) || b.number - a.number);
  // best[count][cost][exceptional]: the strongest choice reaching that state.
  type Choice = { value: number; cards: Card[] } | null;
  const empty = (): Choice[][][] => Array.from({ length: DECK_SIZE + 1 }, () =>
    Array.from({ length: DECK_BUDGET + 1 }, () => [null, null] as Choice[]));
  let best = empty();
  best[0][0][0] = { value: 0, cards: [] };
  for (const card of pool) {
    const next = best.map((byCost) => byCost.map((byExceptional) => [...byExceptional]));
    const cost = RARITY_COST[card.rarity];
    const exceptional = card.rarity === "exceptional" ? 1 : 0;
    for (let count = 0; count < DECK_SIZE; count += 1) {
      for (let spent = 0; spent + cost <= DECK_BUDGET; spent += 1) {
        for (let held = 0; held + exceptional <= 1; held += 1) {
          const from = best[count][spent][held];
          if (!from) continue;
          const to = next[count + 1][spent + cost][held + exceptional];
          const value = from.value + strength(card);
          if (!to || value > to.value) {
            next[count + 1][spent + cost][held + exceptional] = { value, cards: [...from.cards, card] };
          }
        }
      }
    }
    best = next;
  }
  let chosen: Choice = null;
  for (const byExceptional of best[DECK_SIZE]) {
    for (const choice of byExceptional) {
      if (choice && (!chosen || choice.value > chosen.value)) chosen = choice;
    }
  }
  return chosen ? chosen.cards : null;
}

// ─── The code a deck travels as ─────────────────────────────────────────

const TRAIT_ORDER: readonly Trait[] = [
  "best", "longest", "ghost", "race", "session", "patience",
  "climb", "early", "late", "rain", "snow", "wind", "cold", "anniversary",
];
const CODE_VERSION = "1";

/** FNV-1a, 32 bits: enough to catch a link cut short or mistyped. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/**
 * A deck as a short string of URL-safe characters: digits, letters, `-`,
 * `~` and `.`, so it needs no escaping in a link. Five cards come to about
 * a hundred characters.
 */
export function encodeDeck(cards: readonly DuelCard[]): string {
  const body = cards.map((card) => {
    const traits = card.traits.reduce((mask, trait) => mask | (1 << TRAIT_ORDER.indexOf(trait)), 0);
    return [
      card.number.toString(36),
      RARITIES.indexOf(card.rarity).toString(36),
      ...STAT_KEYS.map((key) => card.stats[key].toString(36)),
      traits.toString(36),
      Math.round(card.distanceM / 100).toString(36),
    ].join("-");
  }).join("~");
  const payload = `${CODE_VERSION}.${body}`;
  return `${payload}.${hash(payload).toString(36)}`;
}

const readInt = (part: string | undefined, max: number): number | null => {
  if (part === undefined || !/^[0-9a-z]{1,7}$/.test(part)) return null;
  const value = parseInt(part, 36);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
};

/** A deck read back from its code, or null when the code is not one. */
export function decodeDeck(code: string): DuelCard[] | null {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== CODE_VERSION) return null;
  if (hash(`${parts[0]}.${parts[1]}`).toString(36) !== parts[2]) return null;
  const cards: DuelCard[] = [];
  for (const chunk of parts[1].split("~")) {
    const fields = chunk.split("-");
    if (fields.length !== 8) return null;
    const number = readInt(fields[0], 99_999);
    const rarity = readInt(fields[1], RARITIES.length - 1);
    const traitMask = readInt(fields[6], (1 << TRAIT_ORDER.length) - 1);
    const distance = readInt(fields[7], 10_000);
    if (number === null || rarity === null || traitMask === null || distance === null) return null;
    const stats = {} as Record<StatKey, number>;
    for (const [i, key] of STAT_KEYS.entries()) {
      const value = readInt(fields[2 + i], 99);
      if (value === null) return null;
      stats[key] = value;
    }
    cards.push({
      number,
      rarity: RARITIES[rarity],
      stats,
      traits: TRAIT_ORDER.filter((_, bit) => traitMask & (1 << bit)),
      distanceM: distance * 100,
    });
  }
  return deckProblem(cards) === null ? cards : null;
}

// ─── Playing a duel ─────────────────────────────────────────────────────

export interface Bonus {
  trait: Trait;
  points: number;
}

export interface Side {
  card: DuelCard;
  /** The stat the round is played on. */
  base: number;
  bonuses: Bonus[];
  power: number;
}

export type RoundWinner = "home" | "away" | "draw";

export interface Round {
  terrain: StatKey;
  home: Side;
  away: Side;
  winner: RoundWinner;
}

export interface Duel {
  rounds: Round[];
  home: number;
  away: number;
  winner: RoundWinner;
}

/** The bonus each trait brings, and when. */
export const KEYWORD_POINTS: Record<Trait, number> = {
  best: 15, longest: 15, climb: 15, session: 15,
  race: 10, ghost: 12, patience: 12,
  early: 8, late: 8,
  rain: 8, snow: 8, wind: 8, cold: 8,
  anniversary: 6,
};

const WEATHER: readonly Trait[] = ["rain", "snow", "wind", "cold"];

interface Context {
  terrain: StatKey;
  round: number;
  rounds: number;
  own: DuelCard;
  other: DuelCard;
}

/** Whether a trait plays in this round. */
function applies(trait: Trait, { terrain, round, rounds, own, other }: Context): boolean {
  switch (trait) {
    case "best": return terrain === "speed";
    case "longest": return terrain === "endurance";
    case "climb": return terrain === "climb";
    case "session": return terrain === "steady";
    case "race": return true;
    // The comeback: worth something only to the card that was behind.
    case "ghost": return own.stats[terrain] < other.stats[terrain];
    // The slow card's reward: patience beats a faster card.
    case "patience": return other.stats.speed > own.stats.speed;
    case "early": return round === 0;
    case "late": return round === rounds - 1;
    case "rain": case "snow": case "wind": case "cold":
      return !other.traits.some((other) => WEATHER.includes(other));
    case "anniversary": return true;
  }
}

function side(context: Context): Side {
  const base = context.own.stats[context.terrain];
  const bonuses = context.own.traits
    .filter((trait) => applies(trait, context))
    .map((trait) => ({ trait, points: KEYWORD_POINTS[trait] }));
  return { card: context.own, base, bonuses, power: base + bonuses.reduce((sum, bonus) => sum + bonus.points, 0) };
}

/** A small, fixed pseudo-random sequence from a seed. */
function sequence(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) >>> 0;
    state = (state ^ (state >>> 12)) >>> 0;
    return state;
  };
}

/**
 * The terrain of each round: every stat at least once, one of them twice.
 * Worked out from both decks, in an order that does not depend on who is
 * home, so both phones play the same duel.
 */
export function terrains(homeCode: string, awayCode: string): StatKey[] {
  const next = sequence(hash([homeCode, awayCode].sort().join("|")));
  const order = [...STAT_KEYS];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = next() % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.splice(next() % (order.length + 1), 0, STAT_KEYS[next() % STAT_KEYS.length]);
  return order;
}

/** Plays two decks, card against card in the order they were built. */
export function playDuel(home: readonly DuelCard[], away: readonly DuelCard[]): Duel {
  const plan = terrains(encodeDeck(home), encodeDeck(away));
  const rounds = plan.map((terrain, round): Round => {
    const homeCard = home[round % home.length];
    const awayCard = away[round % away.length];
    const shared = { terrain, round, rounds: plan.length };
    const homeSide = side({ ...shared, own: homeCard, other: awayCard });
    const awaySide = side({ ...shared, own: awayCard, other: homeCard });
    const winner = homeSide.power > awaySide.power ? "home" : awaySide.power > homeSide.power ? "away" : "draw";
    return { terrain, home: homeSide, away: awaySide, winner };
  });
  const homeWins = rounds.filter((round) => round.winner === "home").length;
  const awayWins = rounds.filter((round) => round.winner === "away").length;
  // Level on rounds: the deck that played harder over the whole duel.
  const total = (pick: (round: Round) => Side) => rounds.reduce((sum, round) => sum + pick(round).power, 0);
  const homeTotal = total((round) => round.home);
  const awayTotal = total((round) => round.away);
  const winner = homeWins !== awayWins
    ? (homeWins > awayWins ? "home" : "away")
    : homeTotal !== awayTotal ? (homeTotal > awayTotal ? "home" : "away") : "draw";
  return { rounds, home: homeWins, away: awayWins, winner };
}

// ─── Words ───────────────────────────────────────────────────────────────

export const duelWords = defineStrings({
  fr: {
    keyword: {
      best: "+15 sur une manche de vitesse",
      longest: "+15 sur une manche d'endurance",
      climb: "+15 sur une manche de montée",
      session: "+15 sur une manche de régularité",
      race: "+10 sur toutes les manches",
      ghost: "+12 quand elle part derrière",
      patience: "+12 face à une carte plus rapide",
      early: "+8 en première manche",
      late: "+8 en dernière manche",
      rain: "+8 face à une carte sans météo",
      snow: "+8 face à une carte sans météo",
      wind: "+8 face à une carte sans météo",
      cold: "+8 face à une carte sans météo",
      anniversary: "+6 sur toutes les manches",
    } as Record<Trait, string>,
    problem: {
      size: `Un deck se joue à ${DECK_SIZE} cartes.`,
      budget: `Le deck dépasse ${DECK_BUDGET} points : garde des cartes plus simples.`,
      exceptional: "Une seule carte exceptionnelle par deck.",
      duplicate: "Une carte ne peut pas être deux fois dans le deck.",
    } as Record<DeckProblem, string>,
  },
  en: {
    keyword: {
      best: "+15 in a speed round",
      longest: "+15 in an endurance round",
      climb: "+15 in a climb round",
      session: "+15 in a steady round",
      race: "+10 in every round",
      ghost: "+12 when it starts behind",
      patience: "+12 against a faster card",
      early: "+8 in the first round",
      late: "+8 in the last round",
      rain: "+8 against a card without weather",
      snow: "+8 against a card without weather",
      wind: "+8 against a card without weather",
      cold: "+8 against a card without weather",
      anniversary: "+6 in every round",
    },
    problem: {
      size: `A deck is played with ${DECK_SIZE} cards.`,
      budget: `The deck goes over ${DECK_BUDGET} points: keep some plainer cards.`,
      exceptional: "One exceptional card per deck.",
      duplicate: "A card can't be in the deck twice.",
    },
  },
});
