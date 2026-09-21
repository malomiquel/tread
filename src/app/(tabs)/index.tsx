import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { currentPace, elevationGainM, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { useInitialLocation } from "@/lib/location";
import { colors } from "@/lib/theme";
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
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);

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
    granted === false ? "Localisation refusée, la carte ne peut pas te situer"
    : coords === null ? "Recherche de ta position…"
    : "Le GPS démarre avec la course";

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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {recording && <KeepAwake />}

      <View style={styles.header}>
        <Text style={styles.title}>
          {recording ? (tracker.status === "paused" ? "En pause" : "Course en cours") : "Prêt à courir"}
        </Text>
        <Text style={[styles.signal, weakSignal && styles.signalWeak]}>
          {recording ? signal : idleMessage}
          {recording && !tracker.backgroundMode ? " · écran maintenu allumé" : ""}
        </Text>
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

      <RunMap points={tracker.points} follow initialCenter={coords} style={styles.map} />

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, gap: 16 },
  header: { paddingTop: 8 },
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
  map: { flex: 1, minHeight: 200, borderRadius: 20 },
  error: { color: colors.danger, fontSize: 12 },
  actions: { flexDirection: "row", gap: 12, paddingBottom: 12 },
});
