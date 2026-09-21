import Ionicons from "@expo/vector-icons/Ionicons";
import { useKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { GlassPanel } from "@/components/GlassPanel";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { listRuns, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { currentPace, elevationGainM, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { useTabBarSpace } from "@/lib/layout";
import { useInitialLocation } from "@/lib/location";
import { toggleSetting, useSettings } from "@/lib/settings";
import { timeAgo, weekTotals } from "@/lib/stats";
import { colors } from "@/lib/theme";
import { setMapExpanded, useMapExpanded } from "@/lib/ui";
import { activeDurationS, discard, finish, pause, resume, start, useTracker } from "@/lib/tracker";

/**
 * Holds the screen awake for as long as it is mounted. Inside Expo Go the GPS
 * stops with the screen, so this is only mounted while a run is recording.
 */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/**
 * A flat icon control. On or off by default, with its state shown by colour
 * and weight; `action` turns it into a plain button instead, because
 * announcing a one-shot action as a switch misleads a screen reader.
 */
function Toggle({
  on, onPress, icon, label, action = false,
}: {
  on: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  action?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={action ? "button" : "switch"}
      accessibilityState={action ? undefined : { checked: on }}
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={on ? colors.accent : colors.subtle} />
    </Pressable>
  );
}

/**
 * A round icon control for the map panel, where a full width button would eat
 * the view it sits on.
 */
function RoundButton({
  icon, label, onPress, primary = false, danger = false, size = 40, disabled = false,
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
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [history, setHistory] = useState<Run[]>([]);
  const tabBarSpace = useTabBarSpace();
  const expanded = useMapExpanded();

  const recording = tracker.status !== "idle";

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // The idle screen reports what has already been run, so reload on focus: a
  // run may have finished since the tab was last seen.
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
  const last = history[0];

  const signal =
    tracker.accuracyM === null ? "Recherche du GPS"
    : tracker.accuracyM <= 10 ? `GPS précis, ±${Math.round(tracker.accuracyM)} m`
    : tracker.accuracyM <= 30 ? `GPS moyen, ±${Math.round(tracker.accuracyM)} m`
    : `GPS faible, ±${Math.round(tracker.accuracyM)} m, points ignorés`;

  const idleMessage =
    granted === false ? "Localisation refusée"
    : coords === null ? "Acquisition du GPS"
    : "GPS prêt";

  const weakSignal =
    (recording && tracker.accuracyM !== null && tracker.accuracyM > 30) || granted === false;

  const status = recording
    ? tracker.status === "paused"
      ? tracker.autoPaused ? "Pause automatique" : "En pause"
      : "Course en cours"
    : "Prêt à courir";

  async function close() {
    setFinishing(true);
    const id = await finish();
    setFinishing(false);
    if (id !== null) router.push({ pathname: "/run/[id]", params: { id: String(id) } });
  }

  function confirmFinish() {
    if (distance < 100) {
      Alert.alert("Course très courte", "Moins de 100 m enregistrés. La garder quand même ?", [
        { text: "Abandonner", style: "destructive", onPress: () => void discard() },
        { text: "Garder", onPress: () => void close() },
        { text: "Continuer", style: "cancel" },
      ]);
      return;
    }
    Alert.alert("Terminer la course ?", undefined, [
      { text: "Continuer", style: "cancel" },
      { text: "Terminer", onPress: () => void close() },
    ]);
  }

  // Idle, one plain call to action. Running, two icons: at that point the
  // gestures are known and a label only takes room from the figures.
  const actions = recording ? (
    <View style={styles.roundActions}>
      {tracker.status === "running" ? (
        <RoundButton icon="pause" label="Pause" onPress={pause} size={58} />
      ) : (
        <RoundButton icon="play" label="Reprendre" onPress={resume} primary size={58} />
      )}
      <RoundButton
        icon="stop"
        label="Terminer"
        onPress={confirmFinish}
        danger
        size={58}
        disabled={finishing}
      />
    </View>
  ) : (
    <View style={styles.actions}>
      <Button label="Démarrer" onPress={() => void start()} />
    </View>
  );

  if (expanded) {
    return (
      <View style={styles.expandedScreen}>
        <RunMap
          points={tracker.points}
          follow
          initialCenter={coords}
          fullscreen
          onToggleFullscreen={() => setMapExpanded(false)}
          // The panel now sits at the bottom, so the controls move out of its
          // way rather than trying to clear it from below.
          controlsAtTop
          style={styles.expandedMap}
        />
        {recording && <KeepAwake />}

        <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={styles.overlayBottom}>
          {/* Readings and controls share one panel, within thumb reach at the
              bottom. The tab bar is hidden here, so nothing covers it. */}
          <GlassPanel style={styles.banner} interactive>
            <View style={styles.bannerMetrics}>
              <Metric compact label="Distance" value={formatDistance(distance)} unit="km" />
              <Metric compact label="Durée" value={formatDuration(duration)} />
              <Metric compact label="Allure" value={formatPace(pace ?? avgPace)} unit="/km" />
            </View>
            <View style={styles.bannerControls}>
              {!recording && (
                <RoundButton icon="play" label="Démarrer" onPress={() => void start()} primary />
              )}
              {tracker.status === "running" && (
                <>
                  <RoundButton icon="pause" label="Pause" onPress={pause} />
                  <RoundButton icon="stop" label="Terminer" onPress={confirmFinish} danger disabled={finishing} />
                </>
              )}
              {tracker.status === "paused" && (
                <>
                  <RoundButton icon="play" label="Reprendre" onPress={resume} primary />
                  <RoundButton icon="stop" label="Terminer" onPress={confirmFinish} danger disabled={finishing} />
                </>
              )}
            </View>
          </GlassPanel>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {recording && <KeepAwake />}

      <View style={styles.header}>
        <Text style={styles.status}>{status}</Text>
        <Text style={[styles.signal, weakSignal && styles.signalWeak]}>
          {recording ? signal : idleMessage}
          {recording && !tracker.backgroundMode ? " · écran maintenu allumé" : ""}
        </Text>
      </View>

      {recording ? (
        // Running, the figures are the whole point of the screen, so they take
        // the whole height rather than huddling under the header.
        <View style={[styles.section, styles.sectionFill]}>
          <Metric label="Distance" value={formatDistance(distance)} unit="km" large />
          <View style={styles.row}>
            <Metric label="Durée" value={formatDuration(duration)} />
            <Metric label="Allure" value={formatPace(pace ?? avgPace)} unit="/km" align="right" />
          </View>
          <View style={styles.row}>
            <Metric label="Allure moyenne" value={formatPace(avgPace)} unit="/km" />
            <Metric label="Dénivelé" value={formatElevation(elevation)} unit="m" align="right" />
          </View>
        </View>
      ) : (
        <>
          {/* Idle, every live figure would read zero. What is worth showing is
              what has already been run: this week, and the last outing. */}
          <View style={styles.section}>
            <Metric label="Cette semaine" value={formatDistance(week.distanceM)} unit="km" large />
            <Text style={styles.note}>
              {week.runs === 0
                ? "Aucune sortie depuis lundi"
                : `${week.runs} sortie${week.runs > 1 ? "s" : ""} · ${formatDuration(week.durationS)}`}
            </Text>
          </View>

          {last && (
            <Pressable
              onPress={() => router.push({ pathname: "/run/[id]", params: { id: String(last.id) } })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.section, styles.lastRun, pressed && styles.pressed]}
            >
              <View style={styles.lastRunText}>
                <Text style={styles.label}>Dernière sortie</Text>
                <Text style={styles.lastRunName}>{last.name ?? "Course"}</Text>
                <Text style={styles.note}>
                  {timeAgo(last.startedAt)} · {formatPace(last.avgPaceSKm)} /km
                </Text>
              </View>
              <Text style={styles.lastRunDistance}>
                {formatDistance(last.distanceM)}
                <Text style={styles.lastRunUnit}> km</Text>
              </Text>
            </Pressable>
          )}
        </>
      )}

      {!recording && <View style={styles.spacer} />}

      {tracker.error && <Text style={styles.error}>{tracker.error}</Text>}

      <View style={[styles.footer, { paddingBottom: tabBarSpace }]}>
        <View style={styles.toggles}>
          <Toggle
            on={settings.voice}
            onPress={() => void toggleSetting("voice")}
            icon={settings.voice ? "volume-high" : "volume-mute"}
            label="Annonce vocale des kilomètres"
          />
          <Toggle
            on={settings.autoPause}
            onPress={() => void toggleSetting("autoPause")}
            icon="pause-circle"
            label="Pause automatique à l'arrêt"
          />
          <Toggle action on={false} onPress={() => setMapExpanded(true)} icon="map" label="Voir la carte" />
        </View>
        {actions}
      </View>
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 16 },
  status: { color: colors.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  signal: { color: colors.subtle, fontSize: 12, marginTop: 2 },
  signalWeak: { color: colors.warning },

  // Sections run edge to edge and are told apart by a rule, not by floating on
  // their own surface.
  section: {
    paddingHorizontal: GUTTER,
    paddingVertical: 18,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  row: { flexDirection: "row", gap: 16 },
  sectionFill: { flex: 1, justifyContent: "space-evenly", paddingVertical: 24 },
  label: {
    color: colors.subtle, fontSize: 10, fontWeight: "600",
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  note: { color: colors.muted, fontSize: 12.5, fontVariant: ["tabular-nums"] },

  lastRun: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  lastRunText: { flex: 1, gap: 4 },
  lastRunName: { color: colors.text, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  lastRunDistance: {
    color: colors.text, fontSize: 26, fontWeight: "600",
    letterSpacing: -0.9, fontVariant: ["tabular-nums"],
  },
  lastRunUnit: { color: colors.subtle, fontSize: 12, fontWeight: "600", letterSpacing: 0 },

  spacer: { flex: 1 },
  pressed: { opacity: 0.55 },
  error: { color: colors.danger, fontSize: 12.5, paddingHorizontal: GUTTER, paddingBottom: 8 },

  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: 14,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  toggles: { flexDirection: "row", gap: 22 },
  toggle: { paddingVertical: 2 },
  actions: { flexDirection: "row", gap: 10 },
  roundActions: { flexDirection: "row", gap: 18, justifyContent: "center" },

  expandedScreen: { flex: 1, backgroundColor: colors.background },
  expandedMap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },
  overlayBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12,
  },
  bannerMetrics: { flex: 1, flexDirection: "row", gap: 12, minWidth: 0 },
  bannerControls: { flexDirection: "row", gap: 8, flexShrink: 0 },
  round: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  roundPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  roundDanger: { borderColor: colors.dangerSoft },
  roundDisabled: { opacity: 0.35 },
  play: { marginLeft: 2 },
});
