import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RunShape } from "@/components/RunShape";
import { STAT_KEYS, cardWords, type Card, type Rarity } from "@tread/core/card";
import { autoName, formatDate, formatDistance, formatDuration } from "@tread/core/format";
import { useStrings } from "@tread/core/i18n";
import { palette } from "@tread/core/palette";
import type { Run } from "@/lib/db";
import { font } from "@/lib/theme";
import { distanceUnit } from "@tread/core/units";

/** The card's size: a playing card's proportions, small enough to share whole. */
export const RUN_CARD_WIDTH = 300;

/**
 * A run's card, as a picture.
 *
 * In the light palette whatever the phone is set to, like `RecapCard`: it is
 * made to leave the app, and a picture has no dark mode. Rarity is said in a
 * word in the corner and shown by the frame — a hairline, a dark rule, a
 * blue rule, then the whole card on blue — never by colour alone, and never
 * by gold or glow.
 *
 * The outline has its ends trimmed by the runner's privacy radius here
 * already, so what is seen on the page is what would be shared.
 */
export const RunCard = forwardRef<View, {
  card: Card;
  run: Pick<Run, "id" | "startedAt" | "endedAt" | "name" | "distanceM" | "durationS" | "activity">;
  privacyRadiusM: number;
}>(function RunCard({ card, run, privacyRadiusM }, ref) {
  const words = useStrings(cardWords);
  const look = LOOKS[card.rarity];
  const ride = run.activity === "ride";

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { backgroundColor: look.page, borderColor: look.frame, borderWidth: look.frameWidth }]}
    >
      <View style={styles.top}>
        <Text style={[styles.corner, { color: look.soft }]}>{words.number(card.number)}</Text>
        <Text style={[styles.corner, { color: look.strong }]}>{words.rarity[card.rarity]}</Text>
      </View>

      <RunShape
        runId={run.id}
        track={`${run.startedAt}-${run.endedAt}`}
        ride={ride}
        size={RUN_CARD_WIDTH - 2 * PADDING}
        hideEndsM={privacyRadiusM}
        tint={{ tile: look.tile, line: look.line, icon: look.soft }}
      />

      <View style={styles.title}>
        <Text style={[styles.name, { color: look.ink }]} numberOfLines={1}>
          {run.name ?? autoName(run.startedAt, ride)}
        </Text>
        <Text style={[styles.detail, { color: look.soft }]} numberOfLines={1}>
          {formatDate(run.startedAt)} · {formatDistance(run.distanceM)} {distanceUnit()} · {formatDuration(run.durationS)}
        </Text>
      </View>

      <View style={[styles.stats, { borderColor: look.rule }]}>
        {STAT_KEYS.map((key) => (
          <View key={key} style={styles.stat}>
            <Text style={[styles.statLabel, { color: look.soft }]}>{words.stat[key]}</Text>
            <Text style={[styles.statValue, { color: look.ink }]}>{card.stats[key] ?? "–"}</Text>
          </View>
        ))}
      </View>

      {/* Two lines' room whatever is said, so a card with no trait is the
          same height as one with three. */}
      <Text
        style={[styles.traits, { color: card.note ? look.soft : look.ink }, card.note ? styles.note : null]}
        numberOfLines={2}
      >
        {card.note
          ? words.note[card.note]
          : card.traits.map((trait) => words.trait[trait]).join(" · ")}
      </Text>
    </View>
  );
});

const PADDING = 16;

interface Look {
  page: string;
  frame: string;
  frameWidth: number;
  tile: string;
  line: string;
  ink: string;
  strong: string;
  soft: string;
  rule: string;
}

const light = (token: keyof typeof palette) => palette[token].light;

/** Translucent white, only ever on the blue. */
const ON_BLUE_SOFT = "rgba(255, 255, 255, 0.72)";
const ON_BLUE_RULE = "rgba(255, 255, 255, 0.22)";

const plain: Look = {
  page: light("background"), frame: light("hairline"), frameWidth: 1,
  tile: light("sunken"), line: light("track"),
  ink: light("text"), strong: light("muted"), soft: light("subtle"), rule: light("hairline"),
};

const LOOKS: Record<Rarity, Look> = {
  common: plain,
  notable: { ...plain, frame: light("text"), frameWidth: 1.5, strong: light("text") },
  rare: { ...plain, frame: light("accent"), frameWidth: 2.5, strong: light("accent") },
  exceptional: {
    page: light("accent"), frame: light("accent"), frameWidth: 2.5,
    tile: light("background"), line: light("track"),
    ink: light("accentText"), strong: light("accentText"), soft: ON_BLUE_SOFT, rule: ON_BLUE_RULE,
  },
};

const styles = StyleSheet.create({
  card: {
    width: RUN_CARD_WIDTH, alignSelf: "center", borderRadius: 16,
    padding: PADDING, gap: 12,
  },
  top: { flexDirection: "row", justifyContent: "space-between" },
  corner: {
    fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.3, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  title: { gap: 2 },
  name: { fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3 },
  detail: { fontSize: 14, fontFamily: font.regular, fontVariant: ["tabular-nums"] },
  stats: {
    flexDirection: "row", flexWrap: "wrap", rowGap: 8,
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    width: "50%", flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingRight: 14,
  },
  statLabel: { fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.3, textTransform: "uppercase" },
  statValue: { fontSize: 22, fontFamily: font.semibold, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  traits: { fontSize: 15, fontFamily: font.medium, lineHeight: 20, minHeight: 40 },
  note: { fontFamily: font.regular },
});
