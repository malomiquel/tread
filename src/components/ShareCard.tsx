import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Run } from "@/lib/db";
import { formatDate, formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { font } from "@/lib/theme";

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
 * Nothing, now that nothing covers it. The lift existed to keep the route's
 * lowest point clear of writing laid over the map; the writing has its own
 * ground, so the track can sit where it belongs — in the middle of the frame
 * it was given.
 */
export const TRACK_LIFT = 0;

/** The black band above the map, which carries the mark. */
export const CARD_BAND_TOP = 104;

/** The black band below it, which carries the figures and the date. */
export const CARD_BAND_BOTTOM = 272;

/**
 * What is left for the map, and the size its snapshot is taken at.
 *
 * Two solid bands rather than two gradients. A fade reads as a photograph
 * with something written over it; a band reads as a card, which is what this
 * is. It also means the map is never half visible — the strip it gets is
 * wholly its own, and the route is framed for that strip rather than for a
 * frame two thirds of which was about to be painted over.
 */
export const CARD_MAP_HEIGHT = CARD_HEIGHT - CARD_BAND_TOP - CARD_BAND_BOTTOM;

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
  /** "Chartres, France", or null when it could not be looked up. */
  place?: string | null;
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
export const ShareCard = forwardRef<View, Props>(function ShareCard({ run, mapUri, place = null }, ref) {
  const elevation = run.elevationGainM;

  return (
    // collapsable={false} keeps this view real in the native tree; React
    // Native flattens plain container views away, and a view that no longer
    // exists cannot be captured.
    <View ref={ref} collapsable={false} style={styles.card}>
      {mapUri ? (
        <Image source={{ uri: mapUri }} style={styles.mapImage} resizeMode="cover" />
      ) : null}


      <View style={styles.brand}>
        {/* The app's own icon rather than a disc standing in for it. The disc
            was a placeholder from before there was a mark to use, and the
            point of putting a name on a picture somebody else will see is
            that they can recognise it again in a shop. */}
        <Image source={require("@/assets/images/icon.png")} style={styles.brandMark} />
        <Text style={styles.brandName}>TREAD</Text>
      </View>

      <View style={styles.footer}>
        {/* No name. A picture of a run is read in a second, and a line saying
            "Course du soir" spends that second on the only thing in the frame
            the distance and the map have not already said. The date earns its
            place by being unrepeatable; so does where it happened. */}
        <Text style={styles.date} numberOfLines={1}>
          {formatDate(run.startedAt)}{place ? ` · ${place}` : ""}
        </Text>

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
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  mapImage: {
    position: "absolute", top: CARD_BAND_TOP, left: 0,
    width: CARD_WIDTH, height: CARD_MAP_HEIGHT,
  },

  brand: {
    position: "absolute", top: 16, left: GUTTER,
    flexDirection: "row", alignItems: "center", gap: 7,
  },
  // Squared off the way iOS shows it, so it reads as the app rather than as a
  // logo someone drew for the occasion.
  brandMark: { width: 22, height: 22, borderRadius: 5 },
  brandName: { color: INK, fontSize: 19, fontFamily: font.extrabold, letterSpacing: 3.4 },

  footer: { position: "absolute", left: GUTTER, right: GUTTER, bottom: 18 },
  // unreadable at the size these pictures are actually looked at.
  // The one caption left, so it carries a little more weight than a caption
  // usually would.
  date: { color: INK_SOFT, fontSize: 17, fontFamily: font.medium },

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
