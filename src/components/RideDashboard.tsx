import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { formatSpeed } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";
import { speedUnit } from "@/lib/units";

const strings = defineStrings({
  fr: {
    now: "Vitesse actuelle",
    average: (speed: string) => `moyenne ${speed}`,
    top: "Vitesse max",
  },
  en: {
    now: "Current speed",
    average: (speed: string) => `average ${speed}`,
    top: "Top speed",
  },
});

interface Props {
  /** Speed of the moment, in metres per second, or null before there is one. */
  speedMs: number | null;
  averageMs: number;
  topMs: number | null;
  /** What to say while the ride is paused, or null while it moves. */
  paused: string | null;
  /** Room left for the controls floating at the top and the panel at the bottom. */
  topSpace: number;
  bottomSpace: number;
}

/**
 * The ride screen without the map: the speed of the moment, large, with the
 * average beside its unit and the top speed under it.
 *
 * A ride has no pace to hold and no session to follow, so there is no
 * verdict and no gauge: a cyclist glancing down wants one figure, and gets
 * it the size the run screen gives its pace.
 */
export function RideDashboard({ speedMs, averageMs, topMs, paused, topSpace, bottomSpace }: Props) {
  const s = useStrings(strings);
  return (
    <View style={[styles.screen, { paddingTop: topSpace, paddingBottom: bottomSpace }]}>
      {/* Only while paused, in the room kept for it, so the speed below
          never moves: a stopped clock has to be seen at a glance. */}
      <View
        style={[styles.chip, paused === null && styles.hidden]}
        accessibilityElementsHidden={paused === null}
        accessibilityLiveRegion="polite"
      >
        <Ionicons name="pause" size={17} color={colors.accentText} />
        <Text style={styles.chipText}>{paused ?? " "}</Text>
      </View>
      <View style={styles.speedBlock}>
        <Text style={styles.label}>{s.now}</Text>
        <Text style={styles.speed} numberOfLines={1} adjustsFontSizeToFit>
          {formatSpeed(speedMs ?? 0)}
        </Text>
        <Text style={styles.unit}>
          {speedUnit()}  ·  {s.average(`${formatSpeed(averageMs)} ${speedUnit()}`)}
        </Text>
      </View>
      {/* The room is kept before the first reading, so nothing moves when it comes. */}
      <View style={[styles.topBlock, topMs === null && styles.hidden]}>
        <Text style={styles.label}>{s.top}</Text>
        <Text style={styles.top}>
          {formatSpeed(topMs ?? 0)}
          <Text style={styles.topUnit}> {speedUnit()}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, gap: 28, justifyContent: "center", backgroundColor: colors.background,
  },
  speedBlock: { alignItems: "center" },
  chip: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8,
    height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.warning,
  },
  chipText: { color: colors.accentText, fontSize: 18, fontFamily: font.semibold },
  label: {
    color: colors.subtle, fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.3, textTransform: "uppercase",
  },
  speed: {
    color: colors.text, fontSize: 104, lineHeight: 110, fontFamily: font.bold, letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  unit: { color: colors.subtle, fontSize: 16, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
  topBlock: { alignItems: "center", gap: 2 },
  hidden: { opacity: 0 },
  top: {
    color: colors.text, fontSize: 32, fontFamily: font.semibold, letterSpacing: -0.9, fontVariant: ["tabular-nums"],
  },
  topUnit: { color: colors.subtle, fontSize: 16, fontFamily: font.medium, letterSpacing: 0 },
});
