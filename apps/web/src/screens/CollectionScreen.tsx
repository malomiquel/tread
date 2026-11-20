"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IoCheckmark, IoChevronBack, IoEllipseOutline, IoHelpCircleOutline } from "react-icons/io5";
import { cardWords, filledCount, isComplete, RARITIES, slotName, type Card, type Rarity } from "@tread/core/card";
import { formatDate, formatDuration } from "@tread/core/format";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { metaWords, tierName, type MetaCard } from "@tread/core/metaCard";
import { readPrivacyRadius } from "@tread/core/privacy";
import { CardViewer } from "@/components/CardViewer";
import { MetaCardView, MiniMetaCard, metaTitle } from "@/components/MetaCard";
import { NoMatch } from "@/components/NoMatch";
import { PageHeader } from "@/components/PageHeader";
import { RecordRow } from "@/components/RecordRow";
import { MiniCard, RunCard, type CardFace } from "@/components/RunCard";
import { SectionHeader } from "@/components/SectionHeader";
import { SummaryBanner } from "@/components/SummaryBanner";
import { dealAlbum, goalOf } from "@/lib/album";
import { outingName } from "@/lib/display";
import type { CardOuting } from "@/lib/types";

const strings = defineStrings({
  fr: {
    back: "Profil",
    title: "Collection",
    lede: "Chaque course laisse une carte, tirée de ce qui s'est vraiment passé. Rien n'est tiré au hasard, rien ne se perd.",
    nothing: "Ta première course laissera ta première carte.",
    banner: "Ta collection",
    cards: (count: number): string => (count > 1 ? "cartes" : "carte"),
    rare: "Rares",
    sets: "Séries",
    rules: "Comment les cartes sont tirées",
    rulesDetail: "Rareté, traits et stats",
    great: "Grandes cartes",
    greatNone: "Une semaine tenue, quatre d'affilée, une course : chacune laisse une grande carte.",
    rarest: "Les plus rares",
    all: "Toutes les cartes",
    allRarities: "Toutes",
    rarities: "Rareté",
    narrowed: (shown: number, total: number) => `${shown} sur ${total}`,
    noMatch: (rarity: string) => `Aucune carte « ${rarity} » pour l'instant.`,
    more: "Afficher plus",
    toRun: "À courir",
    card: (label: string) => `Carte : ${label}`,
  },
  en: {
    back: "Profile",
    title: "Collection",
    lede: "Every run leaves a card, dealt from what really happened. Nothing is drawn at random, nothing is ever lost.",
    nothing: "Your first run will leave your first card.",
    banner: "Your collection",
    cards: (count: number) => (count === 1 ? "card" : "cards"),
    rare: "Rare",
    sets: "Sets",
    rules: "How cards are dealt",
    rulesDetail: "Rarity, traits and stats",
    great: "Great cards",
    greatNone: "A week held, four in a row, a race: each leaves a great card.",
    rarest: "The rarest",
    all: "All cards",
    allRarities: "All",
    rarities: "Rarity",
    narrowed: (shown: number, total: number) => `${shown} of ${total}`,
    noMatch: (rarity: string) => `No ${rarity.toLowerCase()} card yet.`,
    more: "Show more",
    toRun: "Still to run",
    card: (label: string) => `Card: ${label}`,
  },
});

/** Cards drawn at a time in the grid: a long history is shown a page at a time. */
const PAGE = 60;

type Held = { kind: "run"; card: Card } | { kind: "meta"; card: MetaCard };

/**
 * The album, as on the phone: the banner, the rules, the great cards
 * (weeks, blocks and races), the rarest, every card in a grid with rarity
 * chips, then each set with its slots, filled or not. Runs only.
 *
 * Dealt here, in the browser, so the hours are read in the runner's time.
 */
export function CollectionScreen({ outings, settings }: { outings: CardOuting[]; settings: Record<string, string> }) {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const meta = useStrings(metaWords);
  const album = useMemo(() => dealAlbum(outings, goalOf(settings)), [outings, settings]);
  const privacy = readPrivacyRadius(settings.privacyRadiusM);
  const [only, setOnly] = useState<Rarity | null>(null);
  const [pages, setPages] = useState(1);
  const [held, setHeld] = useState<Held | null>(null);

  const faces = useMemo(() => new Map<number, CardFace>(
    [...album.byNumber].map(([number, run]) => [number, run.outing]),
  ), [album]);
  const total = album.newest.length;
  const rareCount = album.newest.filter((card) => card.rarity === "rare" || card.rarity === "exceptional").length;
  const great: MetaCard[] = [
    ...[...album.meta.races].reverse(),
    ...[...album.meta.blocks].reverse(),
    ...[...album.meta.weeks].reverse(),
  ];
  const shown = only === null ? album.newest : album.newest.filter((card) => card.rarity === only);
  const rarities = RARITIES.filter((rarity) => album.newest.some((card) => card.rarity === rarity));

  const heldOuting = held?.kind === "run" ? album.byNumber.get(held.card.runId)?.outing : undefined;
  const heldLabel = held === null
    ? ""
    : held.kind === "run"
      ? s.card(`${words.number(held.card.number)}, ${words.rarity[held.card.rarity]}${heldOuting ? `, ${outingName(heldOuting)}` : ""}`)
      : s.card(`${meta.kind[held.card.kind]}, ${tierName(held.card.tier)}, ${metaTitle(held.card, faces)}`);

  const miniCard = (card: Card) => {
    const run = album.byNumber.get(card.runId);
    return run ? <MiniCard key={card.runId} card={card} outing={run.outing} onOpen={() => setHeld({ kind: "run", card })} /> : null;
  };

  return (
    <div className="page">
      <Link href="/profile" className="back"><IoChevronBack aria-hidden />{s.back}</Link>
      <PageHeader title={s.title} />
      <p className="page-lede">{total > 0 ? s.lede : s.nothing}</p>

      {total > 0 ? (
        <SummaryBanner
          label={s.banner}
          value={String(total)}
          unit={s.cards(total)}
          figures={[
            { value: String(rareCount), label: s.rare },
            { value: `${album.sets.filter(isComplete).length}/${album.sets.length}`, label: s.sets },
          ]}
        />
      ) : null}

      {/* Before anything else to read: how the cards below were dealt. */}
      <div className="panel" style={{ marginTop: 12 }}>
        <RecordRow icon={<IoHelpCircleOutline size={19} />} name={s.rules} detail={s.rulesDetail} value="" href="/card-rules" />
      </div>

      {total > 0 ? (
        <>
          <SectionHeader title={s.great} aside={great.length > 0 ? String(great.length) : undefined} />
          {great.length > 0 ? (
            <div className="card-row">
              {great.map((card) => (
                <MiniMetaCard key={card.key} card={card} byNumber={faces} onOpen={() => setHeld({ kind: "meta", card })} />
              ))}
            </div>
          ) : <p className="note" style={{ marginTop: 0, minHeight: "2.7em" }}>{s.greatNone}</p>}

          {album.rarest.length > 0 ? (
            <>
              <SectionHeader title={s.rarest} />
              <div className="card-row">{album.rarest.map(miniCard)}</div>
            </>
          ) : null}

          <SectionHeader title={s.all} aside={only === null ? String(total) : s.narrowed(shown.length, total)} />
          {rarities.length > 1 ? (
            <div className="chip-row" role="group" aria-label={s.rarities} style={{ marginBottom: 14 }}>
              <button type="button" className={`chip${only === null ? " on" : ""}`} aria-pressed={only === null} onClick={() => setOnly(null)}>
                {s.allRarities}
              </button>
              {rarities.map((rarity) => (
                <button
                  key={rarity}
                  type="button"
                  className={`chip${only === rarity ? " on" : ""}`}
                  aria-pressed={only === rarity}
                  onClick={() => setOnly(only === rarity ? null : rarity)}
                >
                  {words.rarity[rarity]}
                </button>
              ))}
            </div>
          ) : null}
          {shown.length === 0 && only !== null ? (
            <NoMatch sentence={s.noMatch(words.rarity[only])} onShowAll={() => setOnly(null)} />
          ) : (
            <div className="card-grid">{shown.slice(0, pages * PAGE).map(miniCard)}</div>
          )}
          {shown.length > pages * PAGE ? (
            <div style={{ maxWidth: 320, margin: "14px auto 0" }}>
              <button type="button" className="button secondary press" onClick={() => setPages((count) => count + 1)}>{s.more}</button>
            </div>
          ) : null}

          <div className="grid-2">
            {album.sets.map((set) => (
              <section key={set.id}>
                <SectionHeader title={words.set[set.id]} aside={`${filledCount(set)} / ${set.slots.length}`} />
                <div className="panel">
                  {set.slots.map((slot) => {
                    const run = slot.runId === null ? undefined : album.byNumber.get(slot.runId);
                    const label = slotName(set.id, slot.key);
                    if (!run) {
                      return <RecordRow key={slot.key} icon={<IoEllipseOutline size={19} />} name={label} detail={s.toRun} value="" />;
                    }
                    const effort = set.id === "distances" ? run.bestEfforts?.[slot.key] : undefined;
                    return (
                      <RecordRow
                        key={slot.key}
                        icon={<IoCheckmark size={19} />}
                        name={label}
                        detail={outingName(run.outing)}
                        value={effort === undefined ? formatDate(run.startedAt) : formatDuration(Math.round(effort))}
                        href={`/outings/${run.outing.id}`}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}

      <CardViewer
        open={held !== null}
        onClose={() => setHeld(null)}
        href={heldOuting ? `/outings/${heldOuting.id}` : undefined}
        label={heldLabel}
      >
        {held?.kind === "run" && heldOuting ? <RunCard card={held.card} outing={heldOuting} privacyRadiusM={privacy} /> : null}
        {held?.kind === "meta" ? <MetaCardView card={held.card} byNumber={faces} privacyRadiusM={privacy} /> : null}
      </CardViewer>
    </div>
  );
}
