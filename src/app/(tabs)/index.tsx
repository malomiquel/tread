import Ionicons from "@expo/vector-icons/Ionicons";
import { useKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { listRuns, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { currentPace, elevationGainM, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { useInitialLocation } from "@/lib/location";
import { toggleSetting, useSettings } from "@/lib/settings";
import { timeAgo, weekTotals } from "@/lib/stats";
import { colors, shadows } from "@/lib/theme";
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
 * A small round control. On or off by default, with its state shown by
 * colour; `action` turns it into a plain button instead, because announcing a
 * one-shot action as a switch misleads anyone using a screen reader.
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
      hitSlop={6}
      style={({ pressed }) => [styles.toggle, on && styles.toggleOn, pressed && styles.togglePressed]}
    >
      <Ionicons name={icon} size={19} color={on ? colors.accent : colors.subtle} />
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
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Run[]>([]);

  const recording = tracker.status !== "idle";

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // The idle screen shows what has already been run, so reload on focus: a run
  // may have finished since the tab was last seen.
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
    tracker.accuracyM === null ? "Recherche du GPS…"
    : tracker.accuracyM <= 10 ? `GPS précis, ±${Math.round(tracker.accuracyM)} m`
    : tracker.accuracyM <= 30 ? `GPS moyen, ±${Math.round(tracker.accuracyM)} m`
    : `GPS faible, ±${Math.round(tracker.accuracyM)} m, points ignorés`;

  const idleMessage =
    granted === false ? "Localisation refusée, la course ne pourra pas être tracée"
    : coords === null ? "Acquisition du GPS…"
    : "GPS prêt, le suivi démarre avec la course";

  const weakSignal =
    (recording && tracker.accuracyM !== null && tracker.accuracyM > 30) || granted === false;

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

  const controls = (
    <View style={styles.controlBar}>
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
      <Toggle action on={false} onPress={() => setExpanded(true)} icon="map" label="Voir la carte" />
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      {!recording && <Button label="Démarrer" onPress={() => void start()} />}
      {tracker.status === "running" && (
        <>
          <Button label="Pause" variant="secondary" onPress={pause} />
          <Button label="Terminer" variant="danger" onPress={confirmFinish} disabled={finishing} />
        </>
      )}
      {tracker.status === "paused" && (
        <>
          <Button label="Reprendre" onPress={resume} />
          <Button label="Terminer" variant="danger" onPress={confirmFinish} disabled={finishing} />
        </>
      )}
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
          onToggleFullscreen={() => setExpanded(false)}
          controlsBottom={112}
          style={styles.expandedMap}
        />
        {recording && <KeepAwake />}

        <SafeAreaView edges={["top"]} pointerEvents="box-none" style={styles.overlayTop}>
          <View style={styles.banner}>
            <Metric label="Distance" value={formatDistance(distance)} unit="km" />
            <Metric label="Durée" value={formatDuration(duration)} />
            <Metric label="Allure" value={formatPace(pace ?? avgPace)} unit="/km" />
          </View>
        </SafeAreaView>

        <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={styles.overlayBottom}>
          {actions}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {recording && <KeepAwake />}

      <View style={styles.header}>
        <Text style={styles.title}>
          {recording
            ? tracker.status === "paused"
              ? tracker.autoPaused
                ? "Pause automatique"
                : "En pause"
              : "Course en cours"
            : "Prêt à courir"}
        </Text>
        <Text style={[styles.signal, weakSignal && styles.signalWeak]}>
          {recording ? signal : idleMessage}
          {recording && !tracker.backgroundMode ? " · écran maintenu allumé" : ""}
        </Text>
      </View>

      {recording ? (
        <View style={styles.card}>
          <Metric label="Distance" value={formatDistance(distance)} unit="km" large />
          <View style={styles.row}>
            <Metric label="Durée" value={formatDuration(duration)} />
            <Metric label="Allure" value={formatPace(pace ?? avgPace)} unit="/km" />
          </View>
          <View style={styles.row}>
            <Metric label="Allure moyenne" value={formatPace(avgPace)} unit="/km" />
            <Metric label="Dénivelé" value={formatElevation(elevation)} unit="m" />
          </View>
        </View>
      ) : (
        <>
          {/* Idle, live figures would all read zero. What is worth showing is
              what has already been run: this week, and the last outing. */}
          <View style={styles.card}>
            <Metric label="Cette semaine" value={formatDistance(week.distanceM)} unit="km" large />
            <Text style={styles.cardNote}>
              {week.runs === 0
                ? "Aucune sortie depuis lundi"
                : `${week.runs} sortie${week.runs > 1 ? "s" : ""} · ${formatDuration(week.durationS)}`}
            </Text>
          </View>

          {last && (
            <Pressable
              onPress={() => router.push({ pathname: "/run/[id]", params: { id: String(last.id) } })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, styles.lastRun, pressed && styles.lastRunPressed]}
            >
              <View style={styles.lastRunText}>
                <Text style={styles.cardLabel}>Dernière sortie</Text>
                <Text style={styles.lastRunName}>{last.name ?? "Course"}</Text>
                <Text style={styles.cardNote}>
                  {timeAgo(last.startedAt)} · {formatPace(last.avgPaceSKm)} /km
                </Text>
              </View>
              <View style={styles.lastRunRight}>
                <Text style={styles.lastRunDistance}>{formatDistance(last.distanceM)}</Text>
                <Text style={styles.lastRunUnit}>km</Text>
              </View>
            </Pressable>
          )}
        </>
      )}

      <View style={styles.spacer} />

      {tracker.error && <Text style={styles.error}>{tracker.error}</Text>}

      {controls}
      {actions}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, gap: 12 },
  header: { paddingTop: 8, paddingBottom: 2 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  signal: { color: colors.subtle, fontSize: 11.5, marginTop: 3, fontWeight: "500" },
  signalWeak: { color: colors.warning },

  // One card shape for every block, so the screen reads as one system rather
  // than a pile of unrelated panels.
  card: { gap: 12, backgroundColor: colors.surface, borderRadius: 20, padding: 20, ...shadows.card },
  cardLabel: {
    color: colors.subtle, fontSize: 10, fontWeight: "600",
    letterSpacing: 1, textTransform: "uppercase",
  },
  cardNote: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", gap: 12, paddingTop: 2 },

  lastRun: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lastRunPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  lastRunText: { flex: 1, gap: 3 },
  lastRunName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  lastRunRight: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  lastRunDistance: {
    color: colors.accent, fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"],
  },
  lastRunUnit: { color: colors.muted, fontSize: 12, fontWeight: "600" },

  spacer: { flex: 1 },
  error: { color: colors.danger, fontSize: 12 },

  // The settings sit on the same card shape as everything else, rather than
  // floating in a corner as three unexplained circles.
  controlBar: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 10, ...shadows.card,
  },
  toggle: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
  toggleOn: { backgroundColor: colors.accentSoft },
  togglePressed: { transform: [{ scale: 0.94 }] },

  actions: { flexDirection: "row", gap: 12, paddingBottom: 12 },

  expandedScreen: { flex: 1, backgroundColor: colors.background },
  expandedMap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },
  overlayTop: { position: "absolute", top: 0, left: 0, right: 0, padding: 12 },
  overlayBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12 },
  banner: {
    flexDirection: "row", gap: 10,
    backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12,
    ...shadows.card,
  },
});
