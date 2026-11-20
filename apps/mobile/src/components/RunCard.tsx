import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CARD_RATIO, CardSurface, cardLook, rarityPips } from "@/components/CardSurface";
import { RunShape } from "@/components/RunShape";
import { Depth } from "@/components/TiltCard";
import { STAT_KEYS, cardWords, type Card } from "@tread/core/card";
import { autoName, formatDistance, formatDuration, formatPace, formatSpeed } from "@tread/core/format";
import { intlLocale, useStrings } from "@tread/core/i18n";
import type { Run } from "@/lib/db";
import { font } from "@/lib/theme";
import { distanceUnit, paceUnit, speedUnit } from "@tread/core/units";

export { CardBack, cardLook } from "@/components/CardSurface";

/** The card's size: a playing card's proportions, small enough to share whole. */
export const RUN_CARD_WIDTH = 300;
export const RUN_CARD_HEIGHT = RUN_CARD_WIDTH * CARD_RATIO;

/** Where the outline is drawn: large, behind the figure, fading into the text. */
export const ART_TOP = 70;
export const ART_SIZE = 184;

/**
 * A run's card, as a picture.
 *
 * Printed like a collector's card whatever the phone is set to, since it is
 * made to leave the app: the distance large in the corner, the outline of
 * the run across the card over engraved contour lines, the name and the
 * four stats at the foot. The tier is the paper, the metal of the edge and,
 * from rare up, a holographic sheen that follows the tilt; it is also said
 * in a word and in diamonds, never by colour alone.
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
  const look = cardLook(card.rarity);
  const ride = run.activity === "ride";
  const rhythm = ride
    ? `${formatSpeed(run.durationS > 0 ? run.distanceM / run.durationS : 0)} ${speedUnit()}`
    : `${formatPace(run.distanceM > 0 ? run.durationS / (run.distanceM / 1000) : null)} ${paceUnit()}`;

  return (
    <CardSurface ref={ref} look={look} seed={run.id} style={styles.card}>
      <View pointerEvents="none" style={styles.art}>
        {/* Lifted off the paper when the card is held and tilted. */}
        <Depth points={8}>
          <RunShape
            runId={run.id}
            track={`${run.startedAt}-${run.endedAt}`}
            ride={ride}
            size={ART_SIZE}
            strokeWidth={5}
            hideEndsM={privacyRadiusM}
            tint={{ tile: "transparent", line: look.line, icon: look.soft }}
          />
        </Depth>
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[fade(look.page, 0), fade(look.page, 0.92)]}
        locations={[0, 0.55]}
        style={styles.fade}
      />

      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={[styles.figure, { color: look.ink }]}>
            {formatDistance(run.distanceM)}
            <Text style={[styles.unit, { color: look.lit }]}> {distanceUnit()}</Text>
          </Text>
          <Text style={[styles.corner, { color: look.soft }]}>{words.number(card.number)}</Text>
        </View>

        <View style={styles.foot}>
          <Text style={[styles.name, { color: look.ink }]} numberOfLines={1}>
            {run.name ?? autoName(run.startedAt, ride)}
          </Text>
          <Text style={[styles.detail, { color: look.soft }]} numberOfLines={1}>
            {`${formatDate(run.startedAt)} · ${formatDuration(run.durationS)} · ${rhythm}`}
          </Text>
          {/* Two lines' room whatever is said, so a card with no trait is
              the same as one with three. */}
          <Text
            style={[styles.traits, { color: card.note ? look.soft : look.lit }, card.note ? styles.note : null]}
            numberOfLines={2}
          >
            {card.note
              ? words.note[card.note]
              : card.traits.map((trait) => words.trait[trait]).join(" · ")}
          </Text>

          <View style={[styles.stats, { borderColor: look.rule }]}>
            {STAT_KEYS.map((key) => (
              <View key={key} style={styles.stat}>
                <Text style={[styles.statValue, { color: look.ink }]}>{card.stats[key] ?? "–"}</Text>
                <Text style={[styles.statLabel, { color: look.soft }]} numberOfLines={1} adjustsFontSizeToFit>
                  {words.stat[key]}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.bottom}>
            <Text style={[styles.rarity, { color: look.strong }]}>
              {`${words.rarity[card.rarity]}  ${rarityPips(card.rarity)}`}
            </Text>
            <Text style={[styles.brand, { color: look.soft }]}>TREAD</Text>
          </View>
        </View>
      </View>
    </CardSurface>
  );
});

/** A card's date, short and in capitals: "11 NOV. 2026". */
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/** The ground colour at an opacity, for the fade under the text. */
export function fade(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

const PADDING = 16;

const styles = StyleSheet.create({
  card: { width: RUN_CARD_WIDTH, height: RUN_CARD_HEIGHT, alignSelf: "center" },
  art: { position: "absolute", top: ART_TOP, left: 0, right: 0, alignItems: "center" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "52%" },
  content: { flex: 1, padding: PADDING, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  figure: {
    fontSize: 54, lineHeight: 54, fontFamily: font.bold, letterSpacing: -2, fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 18, fontFamily: font.semibold, letterSpacing: 0 },
  corner: {
    marginTop: 6, fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.6, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  foot: { gap: 3 },
  name: { fontSize: 23, fontFamily: font.bold, letterSpacing: -0.4 },
  detail: {
    fontSize: 12, fontFamily: font.medium, letterSpacing: 0.8, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  traits: { fontSize: 13.5, fontFamily: font.semibold, lineHeight: 17, minHeight: 34, marginTop: 2 },
  note: { fontFamily: font.regular },
  stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 4 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22, lineHeight: 24, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.9, textTransform: "uppercase" },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  rarity: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.6, textTransform: "uppercase" },
  brand: { fontSize: 11, fontFamily: font.bold, letterSpacing: 2.4 },
});
