import { forwardRef, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Run } from "@/lib/db";
import { formatDate, formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { colors } from "@/lib/theme";

/**
 * The card is laid out at a fixed size rather than filling its container, so
 * that what is captured never depends on the phone it was captured on. At the
 * usual three device pixels per point this comes out at 960 × 1200, which is
 * the 4:5 portrait most feeds crop to.
 */
export const CARD_WIDTH = 320;
export const CARD_HEIGHT = 400;
export const MAP_HEIGHT = 236;

interface Props {
  run: Run;
  /** The map already rendered to a file, or null while it is being taken. */
  mapUri: string | null;
  /** Shown in the map's place until that file exists. */
  mapFallback?: ReactNode;
}

/** One figure over its label, as the rest of the app sets a metric. */
function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * The shareable picture of a finished run: its track above, its numbers below.
 *
 * The map arrives as an image rather than as a live map on purpose. Capturing
 * a map view along with everything else can hand back a blank rectangle, and
 * the map knows how to render itself to a file — so it does that first, and
 * what gets captured here is only ordinary views.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ run, mapUri, mapFallback }, ref) {
  const elevation = run.elevationGainM;

  return (
    // collapsable={false} keeps this view real in the native tree; React
    // Native flattens plain container views away, and a view that no longer
    // exists cannot be captured.
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.map}>
        {mapUri ? (
          <Image source={{ uri: mapUri }} style={styles.mapImage} resizeMode="cover" />
        ) : (
          mapFallback
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{run.name ?? "Course"}</Text>
        <Text style={styles.date}>{formatDate(run.startedAt)}</Text>

        <View style={styles.heroRow}>
          <Text style={styles.hero}>{formatDistance(run.distanceM)}</Text>
          <Text style={styles.heroUnit}>km</Text>
        </View>

        <View style={styles.stats}>
          <Stat value={formatDuration(run.durationS)} label="TEMPS" />
          <Stat value={formatPace(run.avgPaceSKm)} unit="/km" label="ALLURE" />
          {elevation !== null && elevation > 0 ? (
            <Stat value={formatElevation(elevation)} unit="m" label="DÉNIVELÉ" />
          ) : null}
        </View>

        <Text style={styles.mark}>TREAD</Text>
      </View>
    </View>
  );
});

const GUTTER = 18;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  map: { height: MAP_HEIGHT, backgroundColor: colors.sunken },
  mapImage: { width: "100%", height: "100%" },

  body: {
    flex: 1,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  name: { color: colors.text, fontSize: 14, fontWeight: "700", letterSpacing: -0.3 },
  date: { color: colors.subtle, fontSize: 10.5, marginTop: 1 },

  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 6 },
  hero: {
    color: colors.text, fontSize: 44, fontWeight: "700",
    letterSpacing: -2, fontVariant: ["tabular-nums"],
  },
  heroUnit: { color: colors.subtle, fontSize: 13, fontWeight: "600" },

  // Metrics are spread rather than evenly divided: a run without elevation
  // shows two of them, and they should stay left-aligned rather than drift
  // into the middle.
  stats: { flexDirection: "row", gap: 26, marginTop: "auto" },
  stat: { gap: 1 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  statValue: {
    color: colors.text, fontSize: 17, fontWeight: "600",
    letterSpacing: -0.4, fontVariant: ["tabular-nums"],
  },
  statUnit: { color: colors.subtle, fontSize: 9.5, fontWeight: "600" },
  statLabel: { color: colors.subtle, fontSize: 8, fontWeight: "600", letterSpacing: 1.2 },

  mark: {
    position: "absolute", right: GUTTER, bottom: 12,
    color: colors.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.6,
  },
});
