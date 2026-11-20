import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import { CARD_RATIO, CardSurface, cardLook } from "@/components/CardSurface";
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
 * Printed like the full card, on the same paper, metal and sheen, so the
 * collection reads as a set of the same objects: the edge and the word say
 * the rarity, the outline says the run.
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
    >
      <CardSurface look={look} seed={run.id} radius={12} edge={2} style={{ width, height: width * CARD_RATIO }}>
        <View style={styles.card}>
          <Text style={[styles.number, { color: look.soft }]}>{words.number(card.number)}</Text>
          <View style={styles.art}>
            <RunShape
              runId={run.id}
              track={`${run.startedAt}-${run.endedAt}`}
              ride={run.activity === "ride"}
              size={width - 2 * PADDING}
              strokeWidth={3}
              tint={{ tile: "transparent", line: look.line, icon: look.soft }}
            />
          </View>
          <View style={styles.foot}>
            <Text style={[styles.name, { color: look.ink }]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.rarity, { color: look.strong }]} numberOfLines={1}>{words.rarity[card.rarity]}</Text>
          </View>
        </View>
      </CardSurface>
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
  card: { flex: 1, padding: PADDING, justifyContent: "space-between" },
  art: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { paddingHorizontal: 20, gap: 10 },
  number: {
    fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  foot: { gap: 1 },
  name: { fontSize: 14, fontFamily: font.bold, letterSpacing: -0.2 },
  rarity: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase" },
});
