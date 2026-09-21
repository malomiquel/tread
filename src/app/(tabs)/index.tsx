import Ionicons from "@expo/vector-icons/Ionicons";
import { useKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassPanel } from "@/components/GlassPanel";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { listRuns, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { currentPace, elevationGainM, MAX_ACCURACY_M, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { CONTROL_SIZE, useTabBarSpace } from "@/lib/layout";
import { useInitialLocation } from "@/lib/location";
import { toggleSetting, useSettings } from "@/lib/settings";
import { weekTotals } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import { activeDurationS, discard, finish, pause, resume, start, useTracker } from "@/lib/tracker";

/**
 * Holds the screen awake for as long as it is mounted. Inside Expo Go the GPS
 * stops with the screen, so this is only mounted while a run is recording.
 */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/** A round control sized for a panel laid over the map. */
function RoundButton({
  icon, label, onPress, primary = false, danger = false, size = 46, disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        primary && styles.roundPrimary,
        danger && styles.roundDanger,
        pressed && styles.pressed,
        disabled && styles.roundDisabled,
      ]}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.45)}
        color={primary ? colors.accentText : danger ? colors.danger : colors.text}
        // A play triangle centred geometrically reads as off-centre: its mass
        // sits left of its box.
        style={icon === "play" ? styles.play : undefined}
      />
    </Pressable>
  );
}

export default function RecordScreen() {
  const tracker = useTracker();
  const router = useRouter();
  const { coords, granted } = useInitialLocation();
  const settings = useSettings();
  const tabBarSpace = useTabBarSpace();
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState<Run[]>([]);
  // Measured rather than assumed: the panel grows when a run starts, and the
  // controls stacked above it have to move with it instead of being buried.
  const [panelHeight, setPanelHeight] = useState(0);

  const recording = tracker.status !== "idle";

  // The right-hand column, read from the bottom up: the panel, then the map's
  // locate button, then the two settings.
  const locateBottom = tabBarSpace + panelHeight + 12;
  const togglesBottom = locateBottom + CONTROL_SIZE + 10;

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listRuns()
        .then((runs) => {
          if (active) setHistory(runs);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const distance = totalDistanceM(tracker.points);
  const duration = activeDurationS(tracker, now);
  const avgPace = paceSecPerKm(distance, duration);
  const pace = tracker.status === "running" ? currentPace(tracker.points, now) : null;
  const elevation = elevationGainM(tracker.points);
  const week = weekTotals(history);

  const signal =
    tracker.accuracyM === null ? "recherche du GPS"
    : tracker.accuracyM <= 10 ? `GPS précis, ±${Math.round(tracker.accuracyM)} m`
    : tracker.accuracyM <= 30 ? `GPS moyen, ±${Math.round(tracker.accuracyM)} m`
    : `GPS faible, points ignorés`;

  const idleSignal =
    granted === false ? "localisation refusée"
    : coords === null ? "acquisition du GPS"
    : "GPS prêt";

  const state = recording
    ? tracker.status === "paused"
      ? tracker.autoPaused ? "Pause automatique" : "En pause"
      : "Course en cours"
    : "Prêt à courir";

  // The same threshold the tracker throws fixes away at, so the warning and
  // the filter can never disagree about what counts as a poor signal.
  const weakSignal =
    (recording && tracker.accuracyM !== null && tracker.accuracyM > MAX_ACCURACY_M) || granted === false;

  async function close() {
    setConfirming(false);
    setFinishing(true);
    const id = await finish();
    setFinishing(false);
    if (id !== null) router.push({ pathname: "/run/[id]", params: { id: String(id) } });
  }

  const tooShort = distance < 100;

  return (
    <View style={styles.screen}>
      {/* The map is the screen now, not something hidden behind a button. */}
      <RunMap
        points={tracker.points}
        follow
        initialCenter={coords}
        controlsBottom={locateBottom}
        style={styles.map}
      />
      {recording && <KeepAwake />}

      {/* Each setting in its own pill rather than two halves of one: they
          switch different things, and joining them made a single control with
          two states out of what is really two controls. */}
      <View pointerEvents="box-none" style={[styles.toggles, { bottom: togglesBottom }]}>
        <GlassPanel style={styles.togglePill}>
          <Toggle
            on={settings.voice}
            onPress={() => void toggleSetting("voice")}
            icon={settings.voice ? "volume-high" : "volume-mute"}
            name="VOIX"
            label="Annonce vocale des kilomètres"
          />
        </GlassPanel>
        <GlassPanel style={styles.togglePill}>
          <Toggle
            on={settings.autoPause}
            onPress={() => void toggleSetting("autoPause")}
            icon="pause-circle"
            name="PAUSE AUTO"
            label="Pause automatique à l'arrêt"
          />
        </GlassPanel>
      </View>

      {/* Sits above the tab bar rather than replacing it: the tab bar is how
          you leave this screen, so it has to stay reachable. */}
      <View
        pointerEvents="box-none"
        onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        style={[styles.bottom, { bottom: tabBarSpace }]}
      >
        <GlassPanel style={styles.panel} interactive>
          <Text style={[styles.state, weakSignal && styles.stateWeak]} numberOfLines={1}>
            {state} · {recording ? signal : idleSignal}
          </Text>

          <View style={styles.panelRow}>
            <View style={styles.panelMetrics}>
              {recording ? (
                // Two rows of two rather than four abreast: on a narrow phone
                // the single row fell to 46 points a column, which clipped the
                // unit off the pace.
                <>
                  <View style={styles.metricRow}>
                    <Metric compact label="Distance" value={formatDistance(distance)} unit="km" />
                    <Metric compact label="Durée" value={formatDuration(duration)} />
                  </View>
                  <View style={styles.metricRow}>
                    <Metric compact label="Allure" value={formatPace(pace ?? avgPace)} unit="/km" />
                    <Metric compact label="Dénivelé" value={formatElevation(elevation)} unit="m" />
                  </View>
                </>
              ) : (
                <Metric
                  compact
                  label="Cette semaine"
                  value={`${formatDistance(week.distanceM)} km`}
                  unit={week.runs > 0 ? `· ${week.runs} sortie${week.runs > 1 ? "s" : ""}` : undefined}
                />
              )}
            </View>

            <View style={styles.panelControls}>
              {!recording && (
                <RoundButton icon="play" label="Démarrer" onPress={() => void start()} primary size={52} />
              )}
              {tracker.status === "running" && (
                <RoundButton icon="pause" label="Pause" onPress={pause} />
              )}
              {tracker.status === "paused" && (
                <RoundButton icon="play" label="Reprendre" onPress={resume} primary />
              )}
              {recording && (
                <RoundButton
                  icon="stop"
                  label="Terminer"
                  onPress={() => setConfirming(true)}
                  danger
                  disabled={finishing}
                />
              )}
            </View>
          </View>

          {tracker.error && <Text style={styles.error}>{tracker.error}</Text>}
        </GlassPanel>
      </View>

      <ConfirmDialog
        visible={confirming}
        title={tooShort ? "Course très courte" : "Terminer la course ?"}
        message={
          tooShort
            ? "Moins de 100 m enregistrés. La garder quand même ?"
            : `${formatDistance(distance)} km en ${formatDuration(duration)}.`
        }
        confirmLabel={tooShort ? "Garder" : "Terminer"}
        cancelLabel={tooShort ? "Abandonner" : "Continuer"}
        onConfirm={() => void close()}
        onCancel={() => {
          setConfirming(false);
          if (tooShort) void discard();
        }}
      />
    </View>
  );
}

/**
 * A switch in the settings pill: an icon over what it does.
 *
 * The icons carried the whole meaning before, and three of them side by side
 * told you nothing — a speaker, a pause sign and a heart are each ambiguous
 * enough on their own, and a setting nobody can name is a setting nobody
 * touches. The word says what it is, the colour says whether it is on.
 */
function Toggle({
  on, onPress, icon, name, label,
}: {
  on: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** The word shown under the icon. Short enough to sit over a map. */
  name: string;
  /** The whole sentence, for anyone listening rather than looking. */
  label: string;
}) {
  const tint = on ? colors.accent : colors.subtle;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.toggleName, { color: tint }]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  map: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },

  // Right-aligned so the pills, the locate button and the panel's edge all
  // land on one line down the side of the screen.
  toggles: { position: "absolute", right: 12, flexDirection: "row", gap: 8 },
  togglePill: { flexDirection: "row", gap: 2, borderRadius: 16, padding: 3 },
  // Height fixed rather than left to its contents: the pill has to come out
  // at the same 42 points as the map's own buttons across the way, or the two
  // clusters stop reading as a pair.
  toggle: {
    minWidth: 42, height: 36, paddingHorizontal: 7,
    alignItems: "center", justifyContent: "center", gap: 1,
  },
  toggleName: { fontSize: 9.5, fontFamily: font.semibold, letterSpacing: 0.8 },

  bottom: { position: "absolute", left: 12, right: 12 },
  panel: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  state: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  stateWeak: { color: colors.warning },
  panelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  panelMetrics: { flex: 1, gap: 10, minWidth: 0 },
  metricRow: { flexDirection: "row", gap: 12 },
  panelControls: { flexDirection: "row", gap: 8, flexShrink: 0 },

  round: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  roundPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  roundDanger: { borderColor: colors.dangerSoft },
  roundDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.55 },
  play: { marginLeft: 2 },

  error: { color: colors.danger, fontSize: 15 },
});
