import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { currentPace, elevationGainM, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { useInitialLocation } from "@/lib/location";
import { toggleSetting, useSettings } from "@/lib/settings";
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

export default function RecordScreen() {
  const tracker = useTracker();
  const router = useRouter();
  const { coords, granted } = useInitialLocation();
  const settings = useSettings();
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (tracker.status === "idle") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tracker.status]);

  const recording = tracker.status !== "idle";
  const distance = totalDistanceM(tracker.points);
  const duration = activeDurationS(tracker, now);
  const avgPace = paceSecPerKm(distance, duration);
  const pace = tracker.status === "running" ? currentPace(tracker.points, now) : null;
  const elevation = elevationGainM(tracker.points);

  const signal =
    tracker.accuracyM === null ? "Recherche du GPS…"
    : tracker.accuracyM <= 10 ? `GPS précis, ±${Math.round(tracker.accuracyM)} m`
    : tracker.accuracyM <= 30 ? `GPS moyen, ±${Math.round(tracker.accuracyM)} m`
    : `GPS faible, ±${Math.round(tracker.accuracyM)} m, points ignorés`;

  // While idle, say where the location stands rather than let the default
  // framing look like a broken map.
  const idleMessage =
    granted === false ? "Localisation refusée, la course ne pourra pas être tracée"
    : coords === null ? "Acquisition du GPS…"
    : "GPS prêt, le suivi démarre avec la course";

  const weakSignal = (recording && tracker.accuracyM !== null && tracker.accuracyM > 30) || granted === false;

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
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {recording && <KeepAwake />}

      <View style={styles.headerRow}>
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

      {/* Les réglages sont posés là où ils servent, plutôt que dans un écran
          à part que personne n'ouvrirait en courant. */}
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
        <Toggle action on={false} onPress={() => setExpanded(true)} icon="map" label="Voir la carte" />
      </View>
      </View>

      <View style={styles.metrics}>
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

      <View style={styles.spacer} />

      {tracker.error && <Text style={styles.error}>{tracker.error}</Text>}

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
    </SafeAreaView>
  );
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
      hitSlop={8}
      style={({ pressed }) => [styles.toggle, on && styles.toggleOn, pressed && styles.togglePressed]}
    >
      <Ionicons name={icon} size={18} color={on ? colors.accent : colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  header: { paddingTop: 8, flex: 1 },
  toggles: { flexDirection: "row", gap: 8, paddingTop: 8 },
  toggle: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  togglePressed: { transform: [{ scale: 0.96 }] },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  signal: { color: colors.subtle, fontSize: 11.5, marginTop: 3, fontWeight: "500" },
  signalWeak: { color: colors.warning },
  metrics: {
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  row: { flexDirection: "row", gap: 12, paddingTop: 2 },
  spacer: { flex: 1 },
  expandedScreen: { flex: 1, backgroundColor: colors.background },
  // No radius in full screen: rounded corners on an edge-to-edge map read as
  // a rendering fault rather than a deliberate shape.
  expandedMap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },
  overlayTop: { position: "absolute", top: 0, left: 0, right: 0, padding: 12 },
  overlayBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12 },
  banner: {
    flexDirection: "row", gap: 10,
    backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12,
    ...shadows.card,
  },
  error: { color: colors.danger, fontSize: 12 },
  actions: { flexDirection: "row", gap: 12, paddingBottom: 12 },
});
