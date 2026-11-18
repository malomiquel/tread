import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LoadError } from "@/components/LoadError";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { ofSport } from "@tread/core/activity";
import {
  cardsOf, cardWords, filledCount, rarestCards, setsOf, slotName, type Card, type CardSet,
} from "@tread/core/card";
import { listRuns, type Run } from "@/lib/db";
import { autoName, formatDate, formatDuration } from "@tread/core/format";
import { defineStrings, plural, useStrings } from "@tread/core/i18n";
import { colors, font } from "@/lib/theme";

const pageStrings = defineStrings({
  fr: {
    lede: "Chaque course laisse une carte, tirée de ce qui s'est vraiment passé. Les séries se remplissent à ton rythme, sans date limite.",
    count: (cards: number) => plural(cards, "carte", "cartes"),
    rarest: "Les plus rares",
    toRun: "À courir",
    nothing: "Ta première course laissera ta première carte.",
    openRun: (label: string) => `${label}, voir la course`,
  },
  en: {
    lede: "Every run leaves a card, dealt from what really happened. The sets fill at your own pace, with no deadline.",
    count: (cards: number) => plural(cards, "card", "cards"),
    rarest: "The rarest",
    toRun: "Still to run",
    nothing: "Your first run will leave your first card.",
    openRun: (label: string) => `${label}, see the run`,
  },
});

interface Album {
  runs: Map<number, Run>;
  cards: Map<number, Card>;
  sets: CardSet[];
  rarest: Card[];
}

/**
 * The album: the rarest cards, then each set with its slots, filled or not.
 *
 * Runs only. An empty slot says in words what would fill it, and nothing
 * here asks for a speed: an hour of the day, a distance run once, a first.
 * A filled slot opens the run that filled it.
 */
export default function CollectionScreen() {
  const s = useStrings(pageStrings);
  const words = useStrings(cardWords);
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let active = true;
    listRuns()
      .then((all) => {
        if (!active) return;
        const runs = ofSport(all);
        const cards = cardsOf(runs);
        setAlbum({
          runs: new Map(runs.map((run) => [run.id, run])),
          cards,
          sets: setsOf(runs, cards),
          rarest: rarestCards(cards, runs),
        });
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(load);

  const open = (runId: number) => router.push({ pathname: "/run/[id]", params: { id: String(runId) } });
  const nameOf = (run: Run) => run.name ?? autoName(run.startedAt);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {album === null && failed ? <LoadError onRetry={load} /> : null}
      {album ? (
        <>
          <Text style={styles.lede}>{album.cards.size > 0 ? s.lede : s.nothing}</Text>
          {album.cards.size > 0 ? <Text style={styles.count}>{s.count(album.cards.size)}</Text> : null}

          {album.rarest.length > 0 ? (
            <>
              <SectionHeader title={s.rarest} />
              {album.rarest.map((card, index) => {
                const run = album.runs.get(card.runId);
                if (!run) return null;
                const traits = card.traits.map((trait) => words.trait[trait]).join(" · ");
                return (
                  <RecordRow
                    key={card.runId}
                    first={index === 0}
                    icon="albums-outline"
                    label={nameOf(run)}
                    detail={`${words.number(card.number)} · ${traits}`}
                    value={words.rarity[card.rarity]}
                    onPress={() => open(run.id)}
                    accessibilityLabel={s.openRun(`${nameOf(run)}, ${words.rarity[card.rarity]}, ${traits}`)}
                  />
                );
              })}
            </>
          ) : null}

          {album.cards.size > 0 ? album.sets.map((set) => (
            <View key={set.id}>
              <SectionHeader title={words.set[set.id]} aside={`${filledCount(set)} / ${set.slots.length}`} />
              {set.slots.map((slot, index) => {
                const run = slot.runId === null ? undefined : album.runs.get(slot.runId);
                const label = slotName(set.id, slot.key);
                if (!run) {
                  return (
                    <RecordRow
                      key={slot.key}
                      first={index === 0}
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
                    icon="checkmark"
                    label={label}
                    detail={nameOf(run)}
                    value={value}
                    onPress={() => open(run.id)}
                    accessibilityLabel={s.openRun(`${label}, ${value}`)}
                  />
                );
              })}
            </View>
          )) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 4, paddingBottom: 40 },
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, minHeight: 40,
  },
  count: {
    color: colors.subtle, fontSize: 14.5, fontFamily: font.regular, fontVariant: ["tabular-nums"],
    paddingHorizontal: 20, paddingTop: 6,
  },
});
