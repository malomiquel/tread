import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { CARD_RATIO, CardSurface, cardLook, rarityPips } from "@/components/CardSurface";
import { CARD_HEIGHT, CARD_WIDTH } from "@/components/ShareCard";
import { palette } from "@tread/core/palette";
import { formatDistance, formatDuration, formatElevation } from "@tread/core/format";
import { defineStrings, intlLocale, plural, useStrings } from "@tread/core/i18n";
import { changePercent, type Recap } from "@tread/core/recap";
import { font, literalColors } from "@/lib/theme";
import { distanceUnit, elevationUnit } from "@tread/core/units";

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
    recap: "Récap",
    month: (index: number) => ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][index] ?? "",
    week: (index: number) => `S${index + 1}`,
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
    recap: "Recap",
    month: (index: number) => ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][index] ?? "",
    week: (index: number) => `W${index + 1}`,
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
const StageRecap = forwardRef<View, { recap: Recap }>(function StageRecap({ recap }, ref) {
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

/**
 * The ways a month or a year can be shared, swiped through on the recap page.
 *
 * - `stage`: the app's blue, the shape of the period in bars.
 * - `card`: a collector's card on a night table, printed like the run cards.
 * - `poster`: a printed poster, the distance as large as the paper allows.
 * - `bars`: the shape of the period first, tall, the distance under it.
 * - `clear`, `clearBlue`: nothing behind, to lay over a photo in a story.
 */
export type RecapVariant = "stage" | "card" | "poster" | "bars" | "clear" | "clearBlue";
export const RECAP_VARIANTS: readonly RecapVariant[] = ["stage", "card", "poster", "bars", "clear", "clearBlue"];

/** A month or a year as one picture, in the chosen variant. */
export const RecapCard = forwardRef<View, { recap: Recap; variant?: RecapVariant }>(function RecapCard(
  { recap, variant = "stage" },
  ref,
) {
  if (variant === "card") return <CardRecap ref={ref} recap={recap} />;
  if (variant === "poster") return <PosterRecap ref={ref} recap={recap} />;
  if (variant === "bars") return <BarsRecap ref={ref} recap={recap} />;
  if (variant === "clear" || variant === "clearBlue") return <ClearRecap ref={ref} recap={recap} blue={variant === "clearBlue"} />;
  return <StageRecap ref={ref} recap={recap} />;
});

/** What one bar stands for, under it: a month's initial or a week's number. */
function barLabel(recap: Recap, index: number, s: ReturnType<typeof strings>): string {
  return recap.period.kind === "year" ? s.month(index) : s.week(index);
}

/** The period's bars, in one colour, the tallest in another if asked. */
function Bars({ recap, color, peakColor, height, labels, labelColor }: {
  recap: Recap; color: string; peakColor?: string; height: number; labels?: boolean; labelColor?: string;
}) {
  const s = useStrings(strings);
  const peak = Math.max(1, ...recap.bars);
  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.bars, { height, marginTop: 0 }]}>
        {recap.bars.map((metres, index) => (
          <View key={index} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                { height: `${Math.max(3, (metres / peak) * 100)}%`, backgroundColor: metres === peak && peakColor ? peakColor : color },
              ]}
            />
          </View>
        ))}
      </View>
      {labels ? (
        <View style={styles.barLabels}>
          {recap.bars.map((_, index) => (
            <Text key={index} style={[styles.barLabel, { color: labelColor ?? color }]}>{barLabel(recap, index, s)}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The app's mark and name, in a given ink. */
function Brand({ ink, style }: { ink: string; style?: object }) {
  return (
    <View style={[styles.brand, style]}>
      <Image source={require("@/assets/images/icon.png")} style={styles.brandMark} />
      <Text style={[styles.brandName, { color: ink }]}>TREAD</Text>
    </View>
  );
}

const NIGHT = "#0b0b0c";
const PAPER = "#f4f1ea";
const PAPER_INK = "#101010";
const PAPER_SOFT = "#6b6862";
const PAPER_RULE = "rgba(16, 16, 16, 0.14)";
const BLUE_INK = palette.accent.light;
const BLUE_SOFT = "rgba(0, 52, 143, 0.72)";
const GLOW = palette.stageGlow.light;

/** A collector's card on a night table: a year is legendary, a month rare. */
const CardRecap = forwardRef<View, { recap: Recap }>(function CardRecap({ recap }, ref) {
  const s = useStrings(strings);
  const tier = recap.period.kind === "year" ? "legendary" : "rare";
  const look = cardLook(tier);
  const change = changePercent(recap);
  const width = 240;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.night]}>
      <LinearGradient
        colors={["rgba(0, 52, 143, 0.9)", "rgba(0, 52, 143, 0)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <Brand ink={INK} />
      <View style={styles.cardStage}>
        <CardSurface look={look} seed={recap.period.year * 13 + recap.period.month} radius={16} edge={3.5} style={{ width, height: width * CARD_RATIO }}>
          <View style={styles.cardInner}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardKicker, { color: look.soft }]}>{s.recap}</Text>
              <Text style={[styles.cardKicker, { color: look.soft }]}>{periodTitle(recap)}</Text>
            </View>
            <Text style={[styles.cardDistance, { color: look.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatDistance(recap.distanceM)}
              <Text style={[styles.cardUnit, { color: look.lit }]}> {distanceUnit()}</Text>
            </Text>
            <Text style={[styles.cardSub, { color: look.soft }]}>{`${s.runs(recap.runs)} · ${s.days(recap.activeDays)}`}</Text>
            <View style={styles.cardBars}>
              <Bars recap={recap} color={look.rule} peakColor={look.lit} height={58} />
            </View>
            <View style={[styles.cardStats, { borderColor: look.rule }]}>
              {[
                { key: "time", value: formatDuration(recap.durationS), label: s.time },
                { key: "climb", value: formatElevation(recap.climbM), label: s.climb },
                { key: "longest", value: formatDistance(recap.longestM), label: s.longest },
              ].map((stat) => (
                <View key={stat.key} style={styles.cardStat}>
                  <Text style={[styles.cardStatValue, { color: look.ink }]} numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
                  <Text style={[styles.cardStatLabel, { color: look.soft }]} numberOfLines={1}>{stat.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.cardKicker, { color: look.strong }]}>{rarityPips(tier)}</Text>
          </View>
        </CardSurface>
      </View>
      {change !== null ? (
        <Text style={[styles.change, styles.changeFree]}>
          {s.change(change, recap.period.kind === "year" ? s.lastYear : previousName(recap))}
        </Text>
      ) : null}
    </View>
  );
});

/** A printed poster: paper, black ink, the distance as large as it goes. */
const PosterRecap = forwardRef<View, { recap: Recap }>(function PosterRecap({ recap }, ref) {
  const s = useStrings(strings);
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: PAPER }]}>
      <Brand ink={PAPER_INK} />
      <Text style={[styles.posterPeriod]}>{periodTitle(recap)}</Text>
      <Text style={styles.posterDistance} numberOfLines={1} adjustsFontSizeToFit>{formatDistance(recap.distanceM)}</Text>
      <Text style={styles.posterUnit}>{distanceUnit()}</Text>
      <View style={styles.posterRows}>
        {[
          { key: "runs", label: s.count, value: String(recap.runs) },
          { key: "time", label: s.time, value: formatDuration(recap.durationS) },
          { key: "climb", label: s.climb, value: `${formatElevation(recap.climbM)} ${elevationUnit()}` },
          { key: "longest", label: s.longest, value: `${formatDistance(recap.longestM)} ${distanceUnit()}` },
        ].map((row) => (
          <View key={row.key} style={styles.posterRow}>
            <Text style={styles.posterLabel}>{row.label}</Text>
            <Text style={styles.posterValue}>{row.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.posterBars}>
        <Bars recap={recap} color={PAPER_INK} peakColor={BLUE_INK} height={44} labels labelColor={PAPER_SOFT} />
      </View>
    </View>
  );
});

/** The shape of the period first, tall, on night; the distance under it. */
const BarsRecap = forwardRef<View, { recap: Recap }>(function BarsRecap({ recap }, ref) {
  const s = useStrings(strings);
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.night]}>
      <Brand ink={INK} />
      <Text style={[styles.period, { marginTop: 28 }]}>{periodTitle(recap)}</Text>
      <View style={styles.tallBars}>
        <Bars recap={recap} color="rgba(111, 168, 255, 0.45)" peakColor={GLOW} height={250} labels labelColor={SOFT} />
      </View>
      <Text style={[styles.distance, { fontSize: 56, lineHeight: 60 }]}>
        {formatDistance(recap.distanceM)}
        <Text style={[styles.unit, { color: GLOW }]}> {distanceUnit()}</Text>
      </Text>
      <Text style={styles.sub}>{`${s.runs(recap.runs)} · ${formatDuration(recap.durationS)}`}</Text>
    </View>
  );
});

/** Nothing behind: the period, the distance and its bars, to lay over a photo. */
const ClearRecap = forwardRef<View, { recap: Recap; blue: boolean }>(function ClearRecap({ recap, blue }, ref) {
  const s = useStrings(strings);
  const ink = blue ? BLUE_INK : INK;
  const soft = blue ? BLUE_SOFT : SOFT;
  const shade = blue ? styles.glow : styles.shade;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, styles.clearCard]}>
      <View style={styles.clearBlock}>
        <Text style={[styles.period, shade, { color: soft, marginTop: 0 }]}>{periodTitle(recap)}</Text>
        <Text style={[styles.distance, shade, { color: ink, fontSize: 58, lineHeight: 62 }]}>
          {formatDistance(recap.distanceM)}
          <Text style={[styles.unit, { color: soft }]}> {distanceUnit()}</Text>
        </Text>
        <Text style={[styles.sub, shade, { color: ink }]}>{`${s.runs(recap.runs)} · ${formatDuration(recap.durationS)}`}</Text>
        <View style={{ width: 180, marginTop: 12 }}>
          <Bars recap={recap} color={ink} height={46} />
        </View>
        <Text style={[styles.brandName, shade, { color: soft, fontSize: 12, letterSpacing: 2.6, marginTop: 10 }]}>TREAD</Text>
      </View>
    </View>
  );
});

const GUTTER = 22;

const styles = StyleSheet.create({
  night: { backgroundColor: NIGHT },
  clearCard: { backgroundColor: "transparent" },
  barLabels: { flexDirection: "row", gap: 5 },
  barLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: font.semibold },
  shade: { textShadowColor: "rgba(0, 0, 0, 0.45)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  glow: { textShadowColor: "rgba(255, 255, 255, 0.6)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  changeFree: { borderTopColor: "rgba(255, 255, 255, 0.16)" },

  cardStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardInner: { flex: 1, padding: 14, gap: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  cardKicker: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.5, textTransform: "uppercase" },
  cardDistance: { fontSize: 48, lineHeight: 52, fontFamily: font.bold, letterSpacing: -1.4, marginTop: 14, fontVariant: ["tabular-nums"] },
  cardUnit: { fontSize: 18, fontFamily: font.semibold, letterSpacing: 0 },
  cardSub: { fontSize: 13, fontFamily: font.medium },
  cardBars: { marginTop: "auto", marginBottom: 10 },
  cardStats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginBottom: 8 },
  cardStat: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  cardStatValue: { fontSize: 17, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  cardStatLabel: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.8, textTransform: "uppercase" },

  posterPeriod: {
    color: BLUE_INK, fontSize: 14, fontFamily: font.bold, letterSpacing: 2, textTransform: "uppercase", marginTop: 40,
  },
  posterDistance: {
    color: PAPER_INK, fontSize: 130, lineHeight: 132, fontFamily: font.extrabold, letterSpacing: -5,
    fontVariant: ["tabular-nums"], marginTop: 4,
  },
  posterUnit: { color: PAPER_INK, fontSize: 30, fontFamily: font.bold, marginTop: -10 },
  posterRows: { marginTop: 22 },
  posterRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PAPER_RULE,
  },
  posterLabel: { color: PAPER_SOFT, fontSize: 13, fontFamily: font.semibold, letterSpacing: 1.2, textTransform: "uppercase" },
  posterValue: { color: PAPER_INK, fontSize: 16, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  posterBars: { marginTop: "auto" },

  tallBars: { marginTop: 24, marginBottom: 20 },

  clearBlock: { position: "absolute", left: GUTTER, bottom: 40, right: GUTTER },
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
