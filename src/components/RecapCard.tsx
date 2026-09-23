import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { CARD_HEIGHT, CARD_WIDTH } from "@/components/ShareCard";
import { formatDistance, formatDuration, formatElevation } from "@/lib/format";
import { defineStrings, intlLocale, plural, useStrings } from "@/lib/i18n";
import { changePercent, type Recap } from "@/lib/recap";
import { font, literalColors } from "@/lib/theme";
import { distanceUnit, elevationUnit } from "@/lib/units";

const strings = defineStrings({
  fr: {
    runs: (count: number) => plural(count, "course", "courses"),
    days: (count: number) => plural(count, "jour couru", "jours courus"),
    time: "Temps",
    climb: "Dénivelé",
    longest: "Plus longue",
    count: "Courses",
    change: (percent: number, previous: string) =>
      `${percent > 0 ? "+" : ""}${percent} % par rapport à ${previous}`,
    lastYear: "l'an dernier",
  },
  en: {
    runs: (count: number) => plural(count, "run", "runs"),
    days: (count: number) => plural(count, "day run", "days run"),
    time: "Time",
    climb: "Climb",
    longest: "Longest",
    count: "Runs",
    change: (percent: number, previous: string) =>
      `${percent > 0 ? "+" : ""}${percent}% on ${previous}`,
    lastYear: "last year",
  },
});

/** On the app's blue in either appearance: a shared picture has no dark mode. */
const BLUE = literalColors.track.light;
const INK = "#ffffff";
const SOFT = "rgba(255, 255, 255, 0.72)";
const TRACK = "rgba(255, 255, 255, 0.2)";

/** "Septembre 2026", or "2026". */
export function periodTitle(recap: Recap): string {
  if (recap.period.kind === "year") return String(recap.period.year);
  const name = new Date(recap.period.year, recap.period.month, 1)
    .toLocaleDateString(intlLocale(), { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The month before, for the comparison line. */
function previousName(recap: Recap): string {
  const { year, month } = recap.period;
  return new Date(year, month - 1, 1).toLocaleDateString(intlLocale(), { month: "long" });
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={styles.figureValue} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.figureUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * A month or a year on one picture, the size of the run card, to post at the
 * end of it: the distance, four figures, and its shape week by week or month
 * by month.
 */
export const RecapCard = forwardRef<View, { recap: Recap }>(function RecapCard({ recap }, ref) {
  const s = useStrings(strings);
  const peak = Math.max(1, ...recap.bars);
  const change = changePercent(recap);
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.brand}>
        <Image source={require("@/assets/images/icon.png")} style={styles.brandMark} />
        <Text style={styles.brandName}>TREAD</Text>
      </View>

      <Text style={styles.period}>{periodTitle(recap)}</Text>
      <Text style={styles.distance}>
        {formatDistance(recap.distanceM)}
        <Text style={styles.unit}> {distanceUnit()}</Text>
      </Text>
      <Text style={styles.sub}>{`${s.runs(recap.runs)} · ${s.days(recap.activeDays)}`}</Text>

      <View style={styles.bars}>
        {recap.bars.map((metres, index) => (
          <View key={index} style={styles.barSlot}>
            <View style={[styles.bar, { height: `${Math.max(3, (metres / peak) * 100)}%` }]} />
          </View>
        ))}
      </View>

      <View style={styles.figures}>
        <Figure label={s.time} value={formatDuration(recap.durationS)} />
        <Figure label={s.climb} value={formatElevation(recap.climbM)} unit={elevationUnit()} />
        <Figure label={s.longest} value={formatDistance(recap.longestM)} unit={distanceUnit()} />
        <Figure label={s.count} value={String(recap.runs)} />
      </View>

      {change !== null ? (
        <Text style={styles.change}>
          {s.change(change, recap.period.kind === "year" ? s.lastYear : previousName(recap))}
        </Text>
      ) : null}
    </View>
  );
});

const GUTTER = 22;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT, overflow: "hidden",
    backgroundColor: BLUE, paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 22,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandMark: { width: 22, height: 22, borderRadius: 5 },
  brandName: { color: INK, fontSize: 19, fontFamily: font.extrabold, letterSpacing: 3.4 },
  period: {
    color: SOFT, fontSize: 13, fontFamily: font.semibold, letterSpacing: 1.3,
    textTransform: "uppercase", marginTop: 44,
  },
  distance: {
    color: INK, fontSize: 64, fontFamily: font.bold, letterSpacing: -1.6,
    lineHeight: 70, fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 24, fontFamily: font.semibold, letterSpacing: 0 },
  sub: { color: SOFT, fontSize: 15, fontFamily: font.medium },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 96, marginTop: 30 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, backgroundColor: INK },
  figures: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, marginTop: 30 },
  figure: { width: "50%", gap: 1 },
  figureLabel: {
    color: SOFT, fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.2, textTransform: "uppercase",
  },
  figureValue: { color: INK, fontSize: 24, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  figureUnit: { fontSize: 13, fontFamily: font.medium },
  change: {
    position: "absolute", left: GUTTER, right: GUTTER, bottom: 20,
    color: INK, fontSize: 14, fontFamily: font.semibold,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: TRACK,
  },
});
