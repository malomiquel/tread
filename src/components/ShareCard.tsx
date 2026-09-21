import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Run } from "@/lib/db";
import { formatDate, formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { font, literalColors } from "@/lib/theme";

/**
 * The card is laid out at a fixed size rather than filling its container, so
 * that what is captured never depends on the phone it was captured on. At the
 * usual three device pixels per point this comes out at 960 × 1200, the 4:5
 * portrait most feeds crop to.
 */
export const CARD_WIDTH = 288;
export const CARD_HEIGHT = 512;

/**
 * How much wider than the track itself the framing is. Well over one, because
 * a route pinned to the edges of its own picture reads as a diagram; given
 * room, it reads as somewhere you went.
 */
export const TRACK_MARGIN = 1.7;

/**
 * How far up the frame the track is pushed, as a share of the frame's height.
 *
 * Around an eighth. With the margin above, that leaves the track sitting a
 * little above centre and its lowest point clear of the writing, which takes
 * the bottom third or so.
 */
export const TRACK_LIFT = 0.14;

/**
 * The card carries its own colours instead of the app's.
 *
 * Everything here sits on a photograph of a map, so the text is white whatever
 * the phone's appearance — and it must be, because the picture outlives the
 * moment it was made. A card that came out light for one runner and dark for
 * another would be the same run told two different ways.
 */
const INK = "#ffffff";
const INK_SOFT = "rgba(255, 255, 255, 0.66)";
const INK_FAINT = "rgba(255, 255, 255, 0.46)";

interface Props {
  run: Run;
  /**
   * The map already rendered to a file, or null while it is being drawn — in
   * which case the card simply shows its own dark ground until it arrives.
   */
  mapUri: string | null;
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
 * The shareable picture of a finished run.
 *
 * The map runs to all four edges and everything else is laid over it, so the
 * card reads as one photograph rather than as a picture with a caption
 * stapled underneath. Two gradients do the work of making the writing legible
 * without curtaining the map: a short one at the top for the name of the app,
 * a taller one at the bottom for the run's own numbers.
 *
 * The figures are deliberately not all the same size. The distance is what
 * the run was, and it is set large; the rest supports it. Giving every number
 * equal weight is what makes a share card look like a receipt.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ run, mapUri }, ref) {
  const elevation = run.elevationGainM;

  return (
    // collapsable={false} keeps this view real in the native tree; React
    // Native flattens plain container views away, and a view that no longer
    // exists cannot be captured.
    <View ref={ref} collapsable={false} style={styles.card}>
      {mapUri ? (
        <Image source={{ uri: mapUri }} style={styles.mapImage} resizeMode="cover" />
      ) : null}

      <LinearGradient
        colors={["rgba(0, 0, 0, 0.55)", "rgba(0, 0, 0, 0)"]}
        style={styles.topVeil}
        pointerEvents="none"
      />
      <LinearGradient
        // Three stops rather than two: a straight fade from clear to black
        // leaves a visible edge halfway down, where the eye catches the point
        // the map starts disappearing.
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.62)", "rgba(0, 0, 0, 0.93)"]}
        locations={[0, 0.55, 1]}
        style={styles.bottomVeil}
        pointerEvents="none"
      />

      <View style={styles.brand}>
        <View style={styles.brandDot} />
        <Text style={styles.brandName}>TREAD</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>{run.name ?? "Course"}</Text>
        <Text style={styles.date} numberOfLines={1}>{formatDate(run.startedAt)}</Text>

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
      </View>
    </View>
  );
});

const GUTTER = 20;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#11161a",
    overflow: "hidden",
  },
  mapImage: {
    position: "absolute", top: 0, left: 0,
    width: CARD_WIDTH, height: CARD_HEIGHT,
  },

  topVeil: { position: "absolute", top: 0, left: 0, right: 0, height: 104 },
  bottomVeil: { position: "absolute", left: 0, right: 0, bottom: 0, height: 272 },

  brand: {
    position: "absolute", top: 16, left: GUTTER,
    flexDirection: "row", alignItems: "center", gap: 7,
  },
  // The mark is a stride in plan: a filled disc for the footfall, and the
  // wordmark set wide beside it. Drawing a runner at this size only ever
  // produces a smudge.
  brandDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: literalColors.track.dark,
  },
  brandName: { color: INK, fontSize: 19, fontFamily: font.extrabold, letterSpacing: 3.4 },

  footer: { position: "absolute", left: GUTTER, right: GUTTER, bottom: 18 },
  // Set as a title rather than as a caption: it is the run's own name, and
  // squeezing it into small tracked capitals beside the date made both
  // unreadable at the size these pictures are actually looked at.
  name: { color: INK, fontSize: 25, fontFamily: font.bold, letterSpacing: -0.4 },
  date: { color: INK_SOFT, fontSize: 15, fontFamily: font.medium, marginTop: 2 },

  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 9 },
  hero: {
    color: INK, fontSize: 61.5, fontFamily: font.bold,
    letterSpacing: -0.99, fontVariant: ["tabular-nums"],
  },
  heroUnit: { color: INK_SOFT, fontSize: 17, fontFamily: font.bold, letterSpacing: -0.2 },

  // A rule under the hero, the way the app separates its own sections.
  stats: {
    flexDirection: "row", gap: 24, marginTop: 12, paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255, 255, 255, 0.24)",
  },
  stat: { gap: 2 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  statValue: {
    color: INK, fontSize: 21.5, fontFamily: font.semibold,
    letterSpacing: -0.4, fontVariant: ["tabular-nums"],
  },
  statUnit: { color: INK_FAINT, fontSize: 11, fontFamily: font.semibold },
  statLabel: { color: INK_FAINT, fontSize: 9.5, fontFamily: font.bold, letterSpacing: 1.2 },
});
