import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import { cardLook } from "@/components/RunCard";
import { RunShape } from "@/components/RunShape";
import { cardWords, type Card } from "@tread/core/card";
import { autoName } from "@tread/core/format";
import { useStrings } from "@tread/core/i18n";
import type { Run } from "@/lib/db";
import { font } from "@/lib/theme";

export const MINI_CARD_WIDTH = 118;

/**
 * A run's card at the size of a thumbnail, for a row or a grid of them.
 *
 * Drawn like the full card, on its light paper whatever the appearance, so
 * the collection reads as a set of the same objects: the frame and the word
 * say the rarity, the outline says the run.
 */
export function MiniCard({ card, run, width = MINI_CARD_WIDTH, onPress }: {
  card: Card;
  run: Pick<Run, "id" | "startedAt" | "endedAt" | "name" | "activity">;
  width?: number;
  onPress?: () => void;
}) {
  const words = useStrings(cardWords);
  const look = cardLook(card.rarity);
  const name = run.name ?? autoName(run.startedAt, run.activity === "ride");
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${words.number(card.number)}, ${words.rarity[card.rarity]}, ${name}`}
      style={[styles.card, { width, backgroundColor: look.page, borderColor: look.frame, borderWidth: look.frameWidth }]}
    >
      <Text style={[styles.number, { color: look.soft }]}>{words.number(card.number)}</Text>
      <RunShape
        runId={run.id}
        track={`${run.startedAt}-${run.endedAt}`}
        ride={run.activity === "ride"}
        size={width - 2 * PADDING}
        tint={{ tile: look.tile, line: look.line, icon: look.soft }}
      />
      <View style={styles.foot}>
        <Text style={[styles.name, { color: look.ink }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.rarity, { color: look.strong }]} numberOfLines={1}>{words.rarity[card.rarity]}</Text>
      </View>
    </PressableScale>
  );
}

/** A row of mini cards that scrolls sideways from the gutter. */
export function MiniCardRow({ cards, byId, onOpen }: {
  cards: readonly Card[];
  byId: ReadonlyMap<number, Pick<Run, "id" | "startedAt" | "endedAt" | "name" | "activity">>;
  onOpen: (card: Card) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {cards.map((card) => {
        const run = byId.get(card.runId);
        return run ? <MiniCard key={card.runId} card={card} run={run} onPress={() => onOpen(card)} /> : null;
      })}
    </ScrollView>
  );
}

const PADDING = 8;

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: PADDING, gap: 6 },
  row: { paddingHorizontal: 20, gap: 10 },
  number: {
    fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  foot: { gap: 1 },
  name: { fontSize: 14.5, fontFamily: font.semibold },
  rarity: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase" },
});
