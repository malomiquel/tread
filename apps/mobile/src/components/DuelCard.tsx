import { StyleSheet, Text, View } from "react-native";
import { CardSurface, cardLook } from "@/components/CardSurface";
import { cardWords, STAT_KEYS, type StatKey } from "@tread/core/card";
import type { DuelCard as Travelling } from "@tread/core/duel";
import { formatDistance } from "@tread/core/format";
import { useStrings } from "@tread/core/i18n";
import { distanceUnit } from "@tread/core/units";
import { font } from "@/lib/theme";

/**
 * A card as it arrives from a friend's deck: no outline, no name, no date,
 * since a deck carries none of them. Its number, rarity, distance, the four
 * stats (the round's own one set apart) and the traits that play in duels.
 * Printed on the same paper and metal as every card.
 */
export function DuelCardFace({ card, terrain, width }: { card: Travelling; terrain?: StatKey; width: number }) {
  const words = useStrings(cardWords);
  const look = cardLook(card.rarity);
  return (
    <CardSurface look={look} seed={card.number} radius={12} edge={2} style={{ width }}>
      <View
        accessible
        accessibilityLabel={`${words.number(card.number)}, ${words.rarity[card.rarity]}, ${card.traits.map((trait) => words.trait[trait]).join(", ")}`}
        style={styles.card}
      >
        <View style={styles.top}>
          <Text style={[styles.corner, { color: look.soft }]}>{words.number(card.number)}</Text>
          <Text style={[styles.corner, { color: look.strong }]} numberOfLines={1}>{words.rarity[card.rarity]}</Text>
        </View>
        <Text style={[styles.distance, { color: look.ink }]}>
          {formatDistance(card.distanceM)}
          <Text style={[styles.unit, { color: look.soft }]}> {distanceUnit()}</Text>
        </Text>
        <View style={[styles.stats, { borderColor: look.rule }]}>
          {STAT_KEYS.map((key) => (
            <View key={key} style={styles.stat}>
              <Text
                style={[styles.statLabel, { color: key === terrain ? look.strong : look.soft }]}
                numberOfLines={1}
              >
                {words.stat[key]}
              </Text>
              <Text style={[styles.statValue, { color: look.ink }, key === terrain && styles.statOn]}>
                {card.stats[key] || "–"}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.traits, { color: look.ink }]} numberOfLines={2}>
          {card.traits.map((trait) => words.trait[trait]).join(" · ")}
        </Text>
      </View>
    </CardSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 10, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  corner: {
    flexShrink: 1, fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  distance: { fontSize: 22, fontFamily: font.bold, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  unit: { fontSize: 14, fontFamily: font.semibold, letterSpacing: 0 },
  stats: { gap: 2, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  statLabel: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase", flexShrink: 1 },
  statValue: { fontSize: 16, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  statOn: { fontFamily: font.bold },
  traits: { fontSize: 13.5, fontFamily: font.medium, lineHeight: 18, minHeight: 36 },
});
