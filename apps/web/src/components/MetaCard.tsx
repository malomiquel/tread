"use client";

import { cardWords } from "@tread/core/card";
import { cardLook, rarityPips } from "@tread/core/cardLook";
import { autoName, formatDistance, formatDuration } from "@tread/core/format";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { metaWords, tierName, type MetaCard } from "@tread/core/metaCard";
import { distanceUnit } from "@tread/core/units";
import { CardOutline, CardSurface } from "@/components/CardSurface";
import type { CardFace } from "@/components/RunCard";

const strings = defineStrings({
  fr: { runs: "Sorties", time: "Temps", rare: "Rares", weeks: "Semaines" },
  en: { runs: "Runs", time: "Time", rare: "Rare", weeks: "Weeks" },
});

type Faces = ReadonlyMap<number, CardFace>;

/** What a meta card is called on its face: a week, two dates, or the race's name. */
export function metaTitle(card: MetaCard, byNumber: Faces): string {
  const words = metaWords();
  if (card.kind === "week") return words.weekOf(card.from);
  if (card.kind === "block") return words.blockOf(card.from, card.to);
  const race = card.raceRunId === null ? undefined : byNumber.get(card.raceRunId);
  return race ? race.name ?? autoName(race.startedAt) : words.kind.race;
}

/** The runs a card shows the outlines of: the last of a week, or of the race's training. */
function shown(card: MetaCard, byNumber: Faces, count: number): CardFace[] {
  const ids = card.kind === "race" ? card.runIds.slice(0, -1).slice(-count) : card.runIds.slice(-count);
  return ids.map((id) => byNumber.get(id)).filter((run): run is CardFace => run !== undefined);
}

/** A stable number to engrave a meta card's contours from, as on the phone. */
const seedOf = (card: MetaCard) => Math.floor(card.from / 86_400_000) + card.number * 31;

/**
 * The card a week, a block or a race leaves, printed as on the phone
 * (`MetaCard.tsx`): a race shows its outline large; a week or a block its
 * runs' outlines as a plate four to a row, or one alone large. At the foot,
 * its name and three figures. A race is legendary.
 */
export function MetaCardView({ card, byNumber, privacyRadiusM }: { card: MetaCard; byNumber: Faces; privacyRadiusM: number }) {
  const words = useStrings(metaWords);
  const cards = useStrings(cardWords);
  const s = useStrings(strings);
  const look = cardLook(card.tier);
  const race = card.raceRunId === null ? undefined : byNumber.get(card.raceRunId);
  const plate = shown(card, byNumber, 8);
  const large = race ?? (plate.length === 1 ? plate[0] : undefined);
  const figures = [
    { key: "runs", value: String(card.runs), label: s.runs },
    { key: "time", value: formatDuration(card.durationS), label: s.time },
    card.kind === "block"
      ? { key: "weeks", value: String(card.weeks), label: s.weeks }
      : { key: "rare", value: String(card.rareCards), label: s.rare },
  ];
  const traits = card.kind === "race"
    ? [words.prepared(card.runs - 1), ...card.traits.slice(0, 3).map((trait) => cards.trait[trait])]
    : card.traits.slice(0, 4).map((trait) => cards.trait[trait]);

  return (
    <CardSurface look={look} seed={seedOf(card)} className="run-card">
      <div className="card-art">
        {large ? (
          <CardOutline shape={large.shape} size={184} stroke={5} hideEndsM={privacyRadiusM} ride={large.activity === "ride"} />
        ) : (
          <div className="card-plate">
            {plate.map((run) => (
              <span key={run.id} className="plate-cell">
                <CardOutline shape={run.shape} size="100%" stroke={2.4} hideEndsM={privacyRadiusM} ride={run.activity === "ride"} />
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="card-fade" />
      <div className="card-content">
        <div className="card-top">
          <span className="card-figure">
            {formatDistance(card.distanceM)}
            <small> {distanceUnit()}</small>
          </span>
          <span className="card-corner right">{words.kind[card.kind]}<br />{cards.number(card.number)}</span>
        </div>
        <div className="card-foot">
          <span className="card-name">{metaTitle(card, byNumber)}</span>
          <span className="card-traits">{traits.join(" · ")}</span>
          <dl className="card-stats">
            {figures.map((figure) => (
              <div key={figure.key}>
                <dd>{figure.value}</dd>
                <dt>{figure.label}</dt>
              </div>
            ))}
          </dl>
          <div className="card-bottom">
            <span className="card-rarity">{`${tierName(card.tier)}  ${rarityPips(card.tier)}`}</span>
            <span className="card-brand">TREAD</span>
          </div>
        </div>
      </div>
    </CardSurface>
  );
}

/** A meta card at the size of a thumbnail, beside the run cards. */
export function MiniMetaCard({ card, byNumber, onOpen }: { card: MetaCard; byNumber: Faces; onOpen?: () => void }) {
  const words = useStrings(metaWords);
  const look = cardLook(card.tier);
  const race = card.raceRunId === null ? undefined : byNumber.get(card.raceRunId);
  const four = shown(card, byNumber, 4);
  const large = race ?? (four.length === 1 ? four[0] : undefined);
  const title = metaTitle(card, byNumber);
  const face = (
    <CardSurface look={look} seed={seedOf(card)} small className="mini-card">
      <div className="mini-content">
        <span className="mini-top">{words.kind[card.kind]}</span>
        <span className="mini-art">
          {large ? (
            <CardOutline shape={large.shape} size="100%" stroke={2.4} ride={large.activity === "ride"} />
          ) : (
            <span className="mini-grid">
              {four.map((run) => (
                <span key={run.id} className="plate-cell"><CardOutline shape={run.shape} size="100%" stroke={1.8} /></span>
              ))}
            </span>
          )}
        </span>
        <span className="mini-name">{title}</span>
        <span className="mini-tier">{tierName(card.tier)}</span>
      </div>
    </CardSurface>
  );
  return onOpen ? (
    <button type="button" className="mini-button press" onClick={onOpen} aria-label={`${words.kind[card.kind]}, ${tierName(card.tier)}, ${title}`}>
      {face}
    </button>
  ) : face;
}
