import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { Chip, ChipRow } from "@/components/Chip";
import { LoadError } from "@/components/LoadError";
import { MiniMetaCard } from "@/components/MetaCard";
import { MiniCard, MiniCardRow } from "@/components/MiniCard";
import { Panel } from "@/components/Panel";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { BannerTag, bannerText, SummaryBanner } from "@/components/SummaryBanner";
import { cardWords, filledCount, isComplete, RARITIES, slotName, type Card, type Rarity } from "@tread/core/card";
import { autoName, formatDate, formatDuration } from "@tread/core/format";
import { defineStrings, plural, useStrings } from "@tread/core/i18n";
import type { MetaCard } from "@tread/core/metaCard";
import { unseenCards, useAlbum } from "@/lib/album";
import { cardHref } from "@/lib/cardStage";
import type { Run } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

const pageStrings = defineStrings({
  fr: {
    lede: "Chaque course laisse une carte, tirée de ce qui s'est vraiment passé. Rien n'est tiré au hasard, rien ne se perd.",
    nothing: "Ta première course laissera ta première carte.",
    banner: "Ta collection",
    cards: (count: number): string => (count > 1 ? "cartes" : "carte"),
    rules: "Comment les cartes sont tirées",
    rulesDetail: "Rareté, traits et stats",
    rare: "Rares",
    sets: "Séries",
    toTurn: (count: number) => `${plural(count, "carte", "cartes")} à retourner`,
    firstTurn: "Tes courses passées ont leurs cartes : retourne les plus belles",
    turnAction: "Retourner",
    great: "Grandes cartes",
    greatNone: "Une semaine tenue, quatre d'affilée, une course : chacune laisse une grande carte.",
    rarest: "Les plus rares",
    all: "Toutes les cartes",
    allRarities: "Toutes",
    narrowed: (shown: number, total: number) => `${shown} sur ${total}`,
    more: "Afficher plus",
    toRun: "À courir",
    openRun: (label: string) => `${label}, voir la course`,
  },
  en: {
    lede: "Every run leaves a card, dealt from what really happened. Nothing is drawn at random, nothing is ever lost.",
    nothing: "Your first run will leave your first card.",
    banner: "Your collection",
    cards: (count: number) => (count === 1 ? "card" : "cards"),
    rules: "How cards are dealt",
    rulesDetail: "Rarity, traits and stats",
    rare: "Rare",
    sets: "Sets",
    toTurn: (count: number) => `${plural(count, "card", "cards")} to turn over`,
    firstTurn: "Your past runs have their cards: turn over the finest",
    turnAction: "Turn over",
    great: "Great cards",
    greatNone: "A week held, four in a row, a race: each leaves a great card.",
    rarest: "The rarest",
    all: "All cards",
    allRarities: "All",
    narrowed: (shown: number, total: number) => `${shown} of ${total}`,
    more: "Show more",
    toRun: "Still to run",
    openRun: (label: string) => `${label}, see the run`,
  },
});

/** Cards drawn at a time in the grid: a long history is shown a page at a time. */
const PAGE = 30;
const COLUMNS = 3;

/**
 * The album: the cards still to turn, the great cards (weeks,
 * blocks and races), the rarest, every card in a grid, then each set with
 * its slots, filled or not.
 *
 * Runs only. An empty slot says in words what would fill it, and nothing
 * here asks for a speed.
 */
export default function CollectionScreen() {
  const s = useStrings(pageStrings);
  const words = useStrings(cardWords);
  const router = useRouter();
  const settings = useSettings();
  const { album, failed, reload } = useAlbum();
  const [only, setOnly] = useState<Rarity | null>(null);
  const [pages, setPages] = useState(1);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 40 - (COLUMNS - 1) * 10) / COLUMNS);

  if (!album) {
    return <View style={styles.screen}>{failed ? <LoadError onRetry={reload} /> : null}</View>;
  }

  const open = (card: Card) => router.push(cardHref([{ kind: "run", runId: card.runId }]));
  const openMeta = (card: MetaCard) => router.push(cardHref([{ kind: "meta", key: card.key }]));
  const nameOf = (run: Run) => run.name ?? autoName(run.startedAt);

  const total = album.newest.length;
  const unseen = unseenCards(album, settings.cardsSeenThrough);
  const turnOver = () => router.push(cardHref(
    unseen.cards.map((card) => ({ kind: "run", runId: card.runId })),
    { seenThrough: unseen.through },
  ));
  const rareCount = album.newest.filter((card) => card.rarity === "rare" || card.rarity === "exceptional").length;
  const great: MetaCard[] = [
    ...[...album.meta.races].reverse(),
    ...[...album.meta.blocks].reverse(),
    ...[...album.meta.weeks].reverse(),
  ];
  const shown = only === null ? album.newest : album.newest.filter((card) => card.rarity === only);
  const held = RARITIES.filter((rarity) => album.newest.some((card) => card.rarity === rarity));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>{total > 0 ? s.lede : s.nothing}</Text>

      {total > 0 ? (
        <SummaryBanner
          label={s.banner}
          value={String(total)}
          unit={s.cards(total)}
          figures={[
            { value: String(rareCount), label: s.rare },
            { value: `${album.sets.filter(isComplete).length}/${album.sets.length}`, label: s.sets },
          ]}
          onPress={unseen.cards.length > 0 ? turnOver : undefined}
          accessibilityLabel={unseen.cards.length > 0
            ? (unseen.first ? s.firstTurn : s.toTurn(unseen.cards.length))
            : undefined}
        >
          {unseen.cards.length > 0 ? (
            <View style={styles.tags}>
              <BannerTag>
                <Text style={bannerText.tag}>
                  {unseen.first ? s.firstTurn : s.toTurn(unseen.cards.length)}
                </Text>
              </BannerTag>
            </View>
          ) : null}
        </SummaryBanner>
      ) : null}

      {unseen.cards.length > 0 ? (
        <View style={styles.action}>
          <Button label={s.turnAction} onPress={turnOver} />
        </View>
      ) : null}

      {/* Before anything else to read: how the cards below were dealt. */}
      <View style={styles.rules}>
        <Panel>
          <RecordRow
            first
            onPanel
            icon="help-circle-outline"
            label={s.rules}
            detail={s.rulesDetail}
            value=""
            onPress={() => router.push("/card-rules")}
          />
        </Panel>
      </View>

      {total > 0 ? (
        <>
          <SectionHeader title={s.great} aside={great.length > 0 ? String(great.length) : undefined} />
          {great.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {great.map((card) => (
                <MiniMetaCard key={card.key} card={card} byId={album.byId} onPress={() => openMeta(card)} />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.note}>{s.greatNone}</Text>
          )}

          {album.rarest.length > 0 ? (
            <>
              <SectionHeader title={s.rarest} />
              <MiniCardRow cards={album.rarest} byId={album.byId} onOpen={open} />
            </>
          ) : null}

          <SectionHeader
            title={s.all}
            aside={only === null ? String(total) : s.narrowed(shown.length, total)}
          />
          {held.length > 1 ? (
            <View style={styles.chips}>
              <ChipRow>
                <Chip label={s.allRarities} on={only === null} role="button" onPress={() => setOnly(null)} />
                {held.map((rarity) => (
                  <Chip
                    key={rarity}
                    label={words.rarity[rarity]}
                    on={only === rarity}
                    onPress={() => setOnly(only === rarity ? null : rarity)}
                  />
                ))}
              </ChipRow>
            </View>
          ) : null}
          <View style={styles.grid}>
            {shown.slice(0, pages * PAGE).map((card) => {
              const run = album.byId.get(card.runId);
              return run ? <MiniCard key={card.runId} card={card} run={run} width={cell} onPress={() => open(card)} /> : null;
            })}
          </View>
          {shown.length > pages * PAGE ? (
            <View style={styles.action}>
              <Button label={s.more} variant="secondary" onPress={() => setPages((count) => count + 1)} />
            </View>
          ) : null}

          {album.sets.map((set) => (
            <View key={set.id}>
              <SectionHeader title={words.set[set.id]} aside={`${filledCount(set)} / ${set.slots.length}`} />
              <Panel>
                {set.slots.map((slot, index) => {
                  const run = slot.runId === null ? undefined : album.byId.get(slot.runId);
                  const label = slotName(set.id, slot.key);
                  if (!run) {
                    return (
                      <RecordRow
                        key={slot.key}
                        first={index === 0}
                        onPanel
                        icon="ellipse-outline"
                        label={label}
                        detail={s.toRun}
                        value=""
                      />
                    );
                  }
                  const effort = set.id === "distances" ? run.bestEfforts?.[slot.key] : undefined;
                  const value = effort === undefined ? formatDate(run.startedAt) : formatDuration(Math.round(effort));
                  return (
                    <RecordRow
                      key={slot.key}
                      first={index === 0}
                      onPanel
                      icon="checkmark"
                      label={label}
                      detail={nameOf(run)}
                      value={value}
                      onPress={() => router.push({ pathname: "/run/[id]", params: { id: String(run.id) } })}
                      accessibilityLabel={s.openRun(`${label}, ${value}`)}
                    />
                  );
                })}
              </Panel>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rules: { marginTop: 12 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 4, paddingBottom: 48 },
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, minHeight: 40, marginBottom: 8,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", columnGap: 6, marginTop: 8 },
  action: { paddingHorizontal: 20, paddingTop: 12 },
  row: { paddingHorizontal: 20, gap: 10 },
  chips: { paddingBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20 },
  note: {
    color: colors.subtle, fontSize: 14.5, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, minHeight: 40,
  },
});
