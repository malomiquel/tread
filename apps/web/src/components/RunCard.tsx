"use client";

import { STAT_KEYS, cardWords, type Card } from "@tread/core/card";
import { cardLook, rarityPips } from "@tread/core/cardLook";
import { formatDistance, formatDuration, formatPace, formatSpeed } from "@tread/core/format";
import { intlLocale, useStrings } from "@tread/core/i18n";
import { distanceUnit, paceUnit, speedUnit } from "@tread/core/units";
import { CardOutline, CardSurface, outingSeed } from "@/components/CardSurface";
import { outingName } from "@/lib/display";
import type { OutingRow } from "@/lib/types";

/** What a card shows of its outing. */
export type CardFace = Pick<OutingRow, "id" | "startedAt" | "name" | "distanceM" | "durationS" | "activity" | "shape">;

/** A card's date, short: "11 nov. 2026", set in capitals by the card. */
export const cardDate = (at: number): string =>
  new Date(at).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });

/**
 * A run's card, printed as on the phone (`RunCard.tsx`), 300 × 420: the
 * distance large in the corner, the outline large across the card, fading
 * into the foot; the name, date · time · pace, the traits, four stats from
 * 1 to 99, then the tier in a word and diamonds, and TREAD.
 */
export function RunCard({ card, outing, privacyRadiusM }: { card: Card; outing: CardFace; privacyRadiusM: number }) {
  const words = useStrings(cardWords);
  const look = cardLook(card.rarity);
  // Worked out from distance and time, as the phone's card does.
  const rhythm = outing.activity === "ride"
    ? `${formatSpeed(outing.durationS > 0 ? outing.distanceM / outing.durationS : 0)} ${speedUnit()}`
    : `${formatPace(outing.distanceM > 0 ? outing.durationS / (outing.distanceM / 1000) : null)} ${paceUnit()}`;
  return (
    <CardSurface look={look} seed={outingSeed(outing.startedAt)} className="run-card">
      <div className="card-art">
        <CardOutline shape={outing.shape} size={184} stroke={5} hideEndsM={privacyRadiusM} ride={outing.activity === "ride"} />
      </div>
      <div className="card-fade" />
      <div className="card-content">
        <div className="card-top">
          <span className="card-figure">
            {formatDistance(outing.distanceM)}
            <small> {distanceUnit()}</small>
          </span>
          <span className="card-corner">{words.number(card.number)}</span>
        </div>
        <div className="card-foot">
          <span className="card-name">{outingName(outing)}</span>
          <span className="card-detail">{`${cardDate(outing.startedAt)} · ${formatDuration(outing.durationS)} · ${rhythm}`}</span>
          {/* Two lines' room whatever is said, so a card with no trait is the same as one with three. */}
          <span className={`card-traits${card.note ? " note" : ""}`}>
            {card.note ? words.note[card.note] : card.traits.map((trait) => words.trait[trait]).join(" · ")}
          </span>
          <dl className="card-stats">
            {STAT_KEYS.map((key) => (
              <div key={key}>
                <dd>{card.stats[key] ?? "–"}</dd>
                <dt>{words.stat[key]}</dt>
              </div>
            ))}
          </dl>
          <div className="card-bottom">
            <span className="card-rarity">{`${words.rarity[card.rarity]}  ${rarityPips(card.rarity)}`}</span>
            <span className="card-brand">TREAD</span>
          </div>
        </div>
      </div>
    </CardSurface>
  );
}

/**
 * A run's card at the size of a thumbnail, on the same paper, metal and
 * sheen: number, outline, name and tier word. As wide as what holds it.
 */
export function MiniCard({ card, outing, onOpen }: { card: Card; outing: CardFace; onOpen?: () => void }) {
  const words = useStrings(cardWords);
  const look = cardLook(card.rarity);
  const name = outingName(outing);
  const face = (
    <CardSurface look={look} seed={outingSeed(outing.startedAt)} small className="mini-card">
      <div className="mini-content">
        <span className="mini-top">{words.number(card.number)}</span>
        <span className="mini-art">
          <CardOutline shape={outing.shape} size="100%" stroke={2.4} ride={outing.activity === "ride"} />
        </span>
        <span className="mini-name">{name}</span>
        <span className="mini-tier">{words.rarity[card.rarity]}</span>
      </div>
    </CardSurface>
  );
  return onOpen ? (
    <button type="button" className="mini-button press" onClick={onOpen} aria-label={`${words.number(card.number)}, ${words.rarity[card.rarity]}, ${name}`}>
      {face}
    </button>
  ) : face;
}
