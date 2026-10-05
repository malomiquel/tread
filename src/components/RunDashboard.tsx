import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useColorScheme, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { formatPace } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { paceStatus, type PaceState } from "@/lib/pace";
import { colors, font, literalColors } from "@/lib/theme";
import { paceUnit, toPaceUnits } from "@/lib/units";

const strings = defineStrings({
  fr: {
    now: "Allure actuelle",
    onPace: "Dans le rythme",
    slow: "Trop lent, accélère",
    fast: "Trop rapide, ralentis",
    free: "Allure libre",
    easy: "À ton aise",
    walk: "Marche",
    measuring: "Mesure de l'allure",
    target: (pace: string) => `objectif ${pace}`,
    block: (index: number, count: number) => `Bloc ${index}/${count}`,
    left: (what: string) => `reste ${what}`,
    next: (what: string) => `Ensuite : ${what}`,
    last: "Dernier bloc",
    tooSlow: "Trop lent",
    tooFast: "Trop rapide",
  },
  en: {
    now: "Current pace",
    onPace: "On pace",
    slow: "Too slow, speed up",
    fast: "Too fast, ease off",
    free: "Free pace",
    easy: "Take it easy",
    walk: "Walk",
    measuring: "Reading your pace",
    target: (pace: string) => `target ${pace}`,
    block: (index: number, count: number) => `Block ${index}/${count}`,
    left: (what: string) => `${what} left`,
    next: (what: string) => `Next: ${what}`,
    last: "Last block",
    tooSlow: "Too slow",
    tooFast: "Too fast",
  },
});

export interface DashboardBlock {
  index: number;
  count: number;
  label: string;
  /** What is left of it, already formatted: "420 m", "1:30". */
  remaining: string;
  /** Share of the block done, 0 to 1. */
  done: number;
  /** What comes after, or null on the last block. */
  next: string | null;
  /** A block run at whatever pace: recovery, warm-up. */
  easy: boolean;
  /** A walking block, in a beginner's run-walk. */
  walk: boolean;
}

interface Props {
  currentPaceSKm: number | null;
  /** The pace to hold now, or null when running free. */
  targetPaceSKm: number | null;
  block: DashboardBlock | null;
  /** What to say while the run is paused ("Paused", "Auto-paused"), or null while it moves. */
  paused: string | null;
  /** Room left for the controls floating at the top and the panel at the bottom. */
  topSpace: number;
  bottomSpace: number;
}

const SPRING = { damping: 20, stiffness: 180 };
const MARKER = 24;

/**
 * The run screen without the map: whether the pace is the one the session
 * asks for, and where the session stands. The panel under it keeps the
 * run's other figures.
 *
 * A map answers "where am I", which a runner rarely asks while running; the
 * question during a session is "am I on pace", and it gets the whole screen.
 * The answer is given three ways at once, a sentence, a colour and a marker
 * on a gauge, so it reads at a glance mid-stride whichever the eye lands on.
 */
export function RunDashboard({
  currentPaceSKm, targetPaceSKm, block, paused, topSpace, bottomSpace,
}: Props) {
  const s = useStrings(strings);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const target = targetPaceSKm;
  const status = paceStatus(currentPaceSKm, target);
  const state: PaceState = status.state;
  // Paused, the chip says so in the warning colour, and no verdict is given
  // on a pace that is not being run.
  const off = paused !== null || state === "slow" || state === "fast";

  // Everything moves rather than jumps: the marker slides to its place, the
  // colour shifts, and a new verdict gives the chip a small nudge.
  const [gaugeWidth, setGaugeWidth] = useState(0);
  const marker = useSharedValue(0);
  const alarm = useSharedValue(0);
  const nudge = useSharedValue(1);
  const progress = useSharedValue(0);

  useEffect(() => {
    marker.set(withSpring(status.offset, SPRING));
  }, [status.offset, marker]);

  useEffect(() => {
    alarm.set(withTiming(off ? 1 : 0, { duration: 280 }));
    nudge.set(withSequence(withTiming(1.06, { duration: 120 }), withSpring(1, SPRING)));
  }, [off, state, alarm, nudge]);

  const done = block?.done ?? 0;
  useEffect(() => {
    progress.set(withTiming(Math.min(1, Math.max(0, done)), { duration: 400 }));
  }, [done, progress]);

  const calm = literalColors.track[scheme];
  const warn = literalColors.warning[scheme];
  const ink = literalColors.text[scheme];
  const reach = Math.max(0, (gaugeWidth - MARKER) / 2);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(alarm.get(), [0, 1], [calm, warn]),
    transform: [{ scale: nudge.get() }],
  }));
  const paceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(alarm.get(), [0, 1], [ink, warn]),
  }));
  const markerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(alarm.get(), [0, 1], [calm, warn]),
    transform: [{ translateX: -marker.get() * reach }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  // No reading yet, in the first seconds or after a pause: saying "on pace"
  // there would be a verdict on nothing.
  const measuring = target !== null && currentPaceSKm === null;
  const verdict = paused !== null
    ? paused
    : measuring
    ? s.measuring
    : block?.walk ? s.walk : state === "free" && block ? s.easy : s[state];
  const icon = paused !== null
    ? "pause"
    : measuring
    ? "time-outline"
    : block?.walk ? "walk-outline"
    : state === "slow" ? "arrow-up" : state === "fast" ? "arrow-down" : state === "free" ? "pulse" : "checkmark";
  const drift = off && paused === null
    ? `${status.driftS > 0 ? "+" : "−"}${Math.round(Math.abs(toPaceUnits(status.driftS)))} s`
    : null;

  return (
    <View style={[styles.screen, { paddingTop: topSpace, paddingBottom: bottomSpace }]}>
      <Animated.View style={[styles.chip, chipStyle]} accessibilityLiveRegion="polite">
        <Ionicons name={icon} size={17} color={colors.accentText} />
        <Text style={styles.chipText}>{verdict}</Text>
        {drift ? <Text style={styles.chipDrift}>{drift}</Text> : null}
      </Animated.View>

      {/* Named, because the panel below gives the run's average: two paces
          on one screen, unlabelled, read as one of them being wrong. */}
      <View style={styles.paceBlock}>
        <Text style={styles.paceLabel}>{s.now}</Text>
        <Animated.Text style={[styles.pace, paceStyle]} numberOfLines={1} adjustsFontSizeToFit>
          {formatPace(currentPaceSKm)}
        </Animated.Text>
        <Text style={styles.paceUnit}>
          {paceUnit()}
          {target !== null ? `  ·  ${s.target(`${formatPace(target)} ${paceUnit()}`)}` : ""}
        </Text>
      </View>

      {/* Read like a speedometer: slow to the left, fast to the right, the
          band that counts as on pace in the middle. The ends name where the
          marker is, not what to do: "Faster" at the left end was read as an
          order while the marker sat there for running too fast. The room is kept when there is no pace to hold,
          so the blocks below never jump. */}
      <View style={[styles.gaugeWrap, target === null && styles.hidden]} importantForAccessibility="no-hide-descendants">
        <View style={styles.gauge} onLayout={(event: LayoutChangeEvent) => setGaugeWidth(event.nativeEvent.layout.width)}>
          <View style={styles.band} />
          <Animated.View style={[styles.marker, markerStyle]} />
        </View>
        <View style={styles.gaugeLabels}>
          <Text style={styles.gaugeLabel}>{s.tooSlow}</Text>
          <Text style={styles.gaugeLabel}>{s.tooFast}</Text>
        </View>
      </View>

      {block ? (
        <View style={styles.blockCard}>
          <View style={styles.blockHead}>
            <Text style={styles.blockIndex}>{s.block(block.index, block.count)}</Text>
            <Text style={styles.blockLeft}>{s.left(block.remaining)}</Text>
          </View>
          <Text style={styles.blockLabel} numberOfLines={1}>{block.label}</Text>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Text style={styles.blockNext} numberOfLines={1}>{block.next ? s.next(block.next) : s.last}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, gap: 20, justifyContent: "center", backgroundColor: colors.background,
  },
  chip: {
    alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8,
    height: 40, paddingHorizontal: 18, borderRadius: 20,
  },
  chipText: { color: colors.accentText, fontSize: 18, fontFamily: font.semibold },
  chipDrift: { color: colors.accentText, fontSize: 16, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
  paceBlock: { alignItems: "center" },
  paceLabel: {
    color: colors.subtle, fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.3, textTransform: "uppercase",
  },
  pace: { fontSize: 104, lineHeight: 110, fontFamily: font.bold, letterSpacing: -2, fontVariant: ["tabular-nums"] },
  paceUnit: { color: colors.subtle, fontSize: 16, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
  gaugeWrap: { gap: 8 },
  hidden: { opacity: 0 },
  gauge: { height: 12, borderRadius: 6, backgroundColor: colors.sunken, justifyContent: "center", alignItems: "center" },
  // The tolerance: the middle third, where the marker rests when on pace.
  band: { position: "absolute", width: "33.3%", height: 12, borderRadius: 6, backgroundColor: colors.accentSoft },
  marker: { width: MARKER, height: MARKER, borderRadius: MARKER / 2, borderWidth: 4, borderColor: colors.background },
  gaugeLabels: { flexDirection: "row", justifyContent: "space-between" },
  gaugeLabel: {
    color: colors.subtle, fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.2, textTransform: "uppercase",
  },
  blockCard: { gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.sunken },
  blockHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  blockIndex: {
    color: colors.subtle, fontSize: 12, fontFamily: font.semibold, letterSpacing: 1.2, textTransform: "uppercase",
  },
  blockLeft: { color: colors.accent, fontSize: 15, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  blockLabel: { color: colors.text, fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.hairline },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  blockNext: { color: colors.muted, fontSize: 14.5, fontFamily: font.regular },
});
