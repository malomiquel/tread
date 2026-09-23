import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Run } from "@/lib/db";
import { stepsFrom } from "@/lib/cadence";
import { fitRegion, regionAround, type MapRegion, type TrackPoint } from "@/lib/geo";
import {
  formatCount, formatDate, formatDistance, formatDuration, formatElevation, formatPace,
} from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { font } from "@/lib/theme";
import { distanceUnit, elevationUnit, paceUnit } from "@/lib/units";
import { formatTemperature, weatherIcon } from "@/lib/weather";

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
 * The camera the card is drawn with, in one place.
 *
 * Shared because two things now have to agree about it: the map that is
 * photographed, and the animated line drawn over that photograph. Fitted to
 * the card's shape here rather than left to the map, which would widen it
 * silently and leave the line landing somewhere else.
 */
export function cardRegion(points: TrackPoint[]): MapRegion | null {
  const region = regionAround(points, TRACK_MARGIN, TRACK_LIFT);
  return region === null ? null : fitRegion(region, CARD_WIDTH, CARD_HEIGHT);
}

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

const cardStrings = defineStrings({
  fr: { time: "TEMPS", pace: "ALLURE", elevation: "DÉNIVELÉ", steps: "PAS" },
  en: { time: "TIME", pace: "PACE", elevation: "ELEVATION", steps: "STEPS" },
});

interface Props {
  run: Run;
  /**
   * The map already rendered to a file, or null while it is being drawn — in
   * which case the card simply shows its own dark ground until it arrives.
   */
  mapUri: string | null;
  /** "Chartres, France", or null when it could not be looked up. */
  place?: string | null;
  /**
   * Drawn over the map and under everything else.
   *
   * The animation puts the run's own line here, on a photograph of a map that
   * has none. It sits under the gradients on purpose: they are what keeps the
   * writing legible, and a line laid over them would be the one thing on the
   * card fighting the words.
   */
  overlay?: React.ReactNode;
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
export const ShareCard = forwardRef<View, Props>(function ShareCard(
  { run, mapUri, place = null, overlay = null },
  ref,
) {
  const elevation = run.elevationGainM;
  // Read back out of the cadence, which is what the pedometer's count was
  // turned into before being stored. Every run already recorded therefore has
  // one, where keeping the raw figure from now on would have left the whole
  // history without.
  const steps = stepsFrom(run.cadenceSpm, run.durationS);
  const when = formatDate(run.startedAt);
  const weather = run.weather;
  const s = useStrings(cardStrings);

  return (
    // collapsable={false} keeps this view real in the native tree; React
    // Native flattens plain container views away, and a view that no longer
    // exists cannot be captured.
    <View ref={ref} collapsable={false} style={styles.card}>
      {mapUri ? (
        <Image source={{ uri: mapUri }} style={styles.mapImage} resizeMode="cover" />
      ) : null}
      {overlay}

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
        {/* The app's own icon rather than a disc standing in for it. The disc
            was a placeholder from before there was a mark to use, and the
            point of putting a name on a picture somebody else will see is
            that they can recognise it again in a shop. */}
        <Image source={require("@/assets/images/icon.png")} style={styles.brandMark} />
        <Text style={styles.brandName}>TREAD</Text>
      </View>

      {/* Across the top from the name, where a photograph carries the weather
          rather than in the row of figures below.
          The figures down there answer how the run went, and each of them is
          something the runner did; the weather is the one fact on the card
          that was done to them. It also keeps the footer to two rows of two —
          a fifth stat would have opened a third row and shrunk everything in
          it. Degrees alone, no felt temperature: the icon has already said
          what kind of day it was, and a picture read in a second cannot
          afford the second figure. */}
      {weather ? (
        <View style={styles.weather}>
          <Ionicons name={weatherIcon(weather.code, weather.day)} size={16} color={INK_SOFT} />
          <Text style={styles.weatherValue}>{formatTemperature(weather.temperatureC)}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {/* No name. A picture of a run is read in a second, and a line saying
            "Course du soir" spends that second on the only thing in the frame
            the distance and the map have not already said. The date earns its
            place by being unrepeatable; so does where it happened. */}

        <View style={styles.heroRow}>
          <View style={styles.distanceRow}>
            <Text style={styles.hero}>{formatDistance(run.distanceM)}</Text>
            <Text style={styles.heroUnit}>{distanceUnit()}</Text>
          </View>
          {/* Both lines in flow, but it is the place that has to meet "km".
              Flexbox only ever aligns a column on its first line, so the
              alignment lands on the date and the whole block is then lifted
              by exactly one line — which puts the second line where the first
              one was. The lift is a rendering offset, not a margin: the row
              keeps the height it would have had, so nothing below it moves. */}
          <View style={[styles.dateRow, place ? styles.dateRowTwoLines : null]}>
            <Text style={styles.date} numberOfLines={1}>{when}</Text>
            {place ? (
              <Text style={styles.date} numberOfLines={1}>{place}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={formatDuration(run.durationS)} label={s.time} />
          <Stat value={formatPace(run.avgPaceSKm)} unit={paceUnit()} label={s.pace} />
          {elevation !== null && elevation > 0 ? (
            <Stat value={formatElevation(elevation)} unit={elevationUnit()} label={s.elevation} />
          ) : null}
          {steps !== null ? <Stat value={formatCount(steps)} label={s.steps} /> : null}
        </View>
      </View>
    </View>
  );
});

const GUTTER = 20;

/**
 * How far up the card the darkening at the bottom reaches.
 *
 * Shared, because the animation has to know it too: it draws its line into a
 * photograph where this gradient is already baked in, and dims the line
 * across the same band so that both versions of the card look like the same
 * card.
 */
export const BOTTOM_VEIL = 272;

/** Height of one line of the caption, and so the distance the block is lifted. */
const DATE_LINE = 17;

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
  bottomVeil: { position: "absolute", left: 0, right: 0, bottom: 0, height: BOTTOM_VEIL },

  brand: {
    position: "absolute", top: 16, left: GUTTER,
    flexDirection: "row", alignItems: "center", gap: 7,
  },
  // Squared off the way iOS shows it, so it reads as the app rather than as a
  // logo someone drew for the occasion.
  brandMark: { width: 22, height: 22, borderRadius: 5 },
  brandName: { color: INK, fontSize: 19, fontFamily: font.extrabold, letterSpacing: 3.4 },

  // Level with the brand across the card, and centred against it rather than
  // against its own box: the mark is 22 points tall and this is not, so the
  // two would otherwise sit a couple of points out from one another.
  weather: {
    position: "absolute", top: 16, right: GUTTER, height: 22,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  weatherValue: {
    color: INK, fontSize: 16, fontFamily: font.semibold,
    letterSpacing: -0.2, fontVariant: ["tabular-nums"],
  },

  footer: { position: "absolute", left: GUTTER, right: GUTTER, bottom: 18 },

  // The distance and the date at opposite ends of one line, sharing its
  // baseline. Set apart like that they read as two separate facts rather than
  // as a caption trailing off the end of a number.
  heroRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
  },
  distanceRow: { flexDirection: "row", alignItems: "baseline" },
  // Ragged left, so the right edge stays flush with the card's margin however
  // long the place name turns out to be.
  dateRow: { alignItems: "flex-end" },
  // Only with something under it to bring down onto the baseline. One line
  // needs no lift at all, and lifting it would hang the date in mid air.
  //
  // The negative margin matters as much as the offset. `top` moves what is
  // drawn and nothing else, so the row went on reserving the height of a
  // block that had left — eight points of nothing between the figure and the
  // rule under it. Taking the same amount off the bottom lets the row close
  // up behind it.
  dateRowTwoLines: { top: -DATE_LINE, marginBottom: -DATE_LINE },
  // Stated rather than inherited, because the lift above is exactly one of
  // these: a line height left to the font would make the alignment depend on
  // which font happened to load.
  date: { color: INK_SOFT, fontSize: 14, lineHeight: DATE_LINE, fontFamily: font.regular },
  hero: {
    color: INK, fontSize: 54, fontFamily: font.semibold,
    letterSpacing: -0.99, fontVariant: ["tabular-nums"],
  },
  heroUnit: { color: INK_SOFT, fontSize: 17, fontFamily: font.bold, letterSpacing: -0.2 },

  // A rule under the hero, the way the app separates its own sections, pulled
  // up into the space the figure leaves below its own baseline. A line at
  // fifty four points reserves a descender nothing in it ever uses, and left
  // alone that emptiness reads as a gap somebody forgot to close.
  // Two across rather than four abreast — the same arithmetic the running
  // panel ran into. A time is nearly eighty points wide at this size, so four
  // of these on one line would each be squeezed to sixty, and the figures set
  // small enough to stop being the point of the card.
  stats: {
    flexDirection: "row", flexWrap: "wrap", rowGap: 9, marginTop: 4, paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255, 255, 255, 0.24)",
  },
  stat: { width: "50%", gap: 2 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  statValue: {
    color: INK, fontSize: 21.5, fontFamily: font.semibold,
    letterSpacing: -0.4, fontVariant: ["tabular-nums"],
  },
  statUnit: { color: INK_FAINT, fontSize: 11, fontFamily: font.semibold },
  statLabel: { color: INK_FAINT, fontSize: 9.5, fontFamily: font.bold, letterSpacing: 1.2 },
});
