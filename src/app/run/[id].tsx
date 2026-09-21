import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Button } from "@/components/Button";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { deleteRun, readRun, renameRun, type Run } from "@/lib/db";
import { formatDate, formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { splits, type TrackPoint } from "@/lib/geo";
import { gpxFileName, toGpx } from "@/lib/gpx";
import { colors, shadows } from "@/lib/theme";

type Loaded = { run: Run; points: TrackPoint[] };

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // undefined while loading, null when not found.
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    readRun(Number(id))
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (data === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (data === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Course introuvable.</Text>
      </View>
    );
  }

  const { run, points } = data;
  const kilometres = splits(points);
  const fastest = kilometres
    .filter((split) => !split.partial)
    .reduce<number | null>((best, split) => (best === null || split.durationS < best ? split.durationS : best), null);
  const fullCount = kilometres.filter((split) => !split.partial).length;

  /**
   * Writes the run as GPX into the cache and hands it to the share sheet.
   * The cache is the right home: the system reclaims it on its own, and the
   * file only needs to survive long enough to be shared.
   */
  async function exportGpx() {
    if (exporting) return;
    setExporting(true);
    try {
      const file = new File(Paths.cache, gpxFileName(run));
      file.create({ overwrite: true });
      file.write(toGpx(run, points));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/gpx+xml", UTI: "com.topografix.gpx" });
      } else {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
      }
    } catch (cause) {
      Alert.alert("Export impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setExporting(false);
    }
  }

  async function saveName() {
    const next = draftName.trim();
    setRenaming(false);
    if (!next || next === run.name) return;
    await renameRun(run.id, next);
    setData({ run: { ...run, name: next }, points });
  }

  function confirmDelete() {
    Alert.alert("Supprimer cette course ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          void deleteRun(run.id).then(() => router.back());
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Pressable
          onPress={() => {
            setDraftName(run.name ?? "");
            setRenaming(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Renommer la course"
          hitSlop={8}
          style={styles.nameRow}
        >
          <Text style={styles.name}>{run.name ?? "Sans nom"}</Text>
          <Ionicons name="pencil" size={15} color={colors.subtle} />
        </Pressable>
        <Text style={styles.date}>{formatDate(run.startedAt)}</Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="Distance" value={formatDistance(run.distanceM)} unit="km" large />
        <View style={styles.row}>
          <Metric label="Durée" value={formatDuration(run.durationS)} />
          <Metric label="Allure moyenne" value={formatPace(run.avgPaceSKm)} unit="/km" />
        </View>
        {run.elevationGainM !== null && (
          <View style={styles.row}>
            <Metric label="Dénivelé positif" value={formatElevation(run.elevationGainM)} unit="m" />
            {run.fastestKmS !== null ? (
              <Metric label="Meilleur km" value={formatPace(run.fastestKmS)} unit="/km" />
            ) : null}
          </View>
        )}
      </View>

      <RunMap points={points} fitAll style={styles.map} />

      {kilometres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fractionnés</Text>
          {kilometres.map((split) => {
            const pace = split.durationS / (split.distanceM / 1000);
            const isBest = !split.partial && fastest !== null && split.durationS === fastest && fullCount > 1;
            return (
              <View key={split.km} style={styles.split}>
                <Text style={styles.splitKm}>
                  {split.partial ? `${formatDistance(split.distanceM)} km` : `km ${split.km}`}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${Math.min(100, ((fastest ?? pace) / pace) * 100)}%` },
                      isBest && styles.barBest,
                    ]}
                  />
                </View>
                <Text style={[styles.splitPace, isBest && styles.best]}>{formatPace(pace)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.muted}>{points.length} points GPS enregistrés</Text>

      <View style={styles.actions}>
        <Button
          label={exporting ? "Export…" : "Exporter en GPX"}
          variant="secondary"
          onPress={() => void exportGpx()}
          disabled={exporting || points.length === 0}
        />
        <Button label="Supprimer" variant="danger" onPress={confirmDelete} />
      </View>

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRenaming(false)}>
          {/* Stops a tap inside the card from closing it. */}
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text style={styles.dialogTitle}>Nom de la course</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Course matinale"
              placeholderTextColor={colors.subtle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void saveName()}
              style={styles.input}
            />
            <View style={styles.dialogActions}>
              <Button label="Annuler" variant="secondary" onPress={() => setRenaming(false)} />
              <Button label="Enregistrer" onPress={() => void saveName()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  heading: { gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  date: { color: colors.muted, fontSize: 13 },
  metrics: { gap: 16, backgroundColor: colors.surface, borderRadius: 20, padding: 20, ...shadows.card },
  row: { flexDirection: "row", gap: 12 },
  map: { height: 280 },
  section: { gap: 12, backgroundColor: colors.surface, borderRadius: 20, padding: 18, ...shadows.card },
  sectionTitle: {
    color: colors.subtle, fontSize: 10, fontWeight: "600",
    letterSpacing: 1, textTransform: "uppercase",
  },
  split: { flexDirection: "row", alignItems: "center", gap: 12 },
  splitKm: { color: colors.muted, width: 58, fontSize: 12, fontVariant: ["tabular-nums"] },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4, backgroundColor: "rgba(22, 163, 74, 0.35)" },
  barBest: { backgroundColor: colors.accent },
  splitPace: {
    color: colors.text, width: 52, textAlign: "right",
    fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"],
  },
  best: { color: colors.accent },
  muted: { color: colors.subtle, fontSize: 11, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12 },
  backdrop: {
    flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center", justifyContent: "center", padding: 28,
  },
  dialog: {
    width: "100%", backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 14,
    ...shadows.card,
  },
  dialogTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  dialogActions: { flexDirection: "row", gap: 10 },
});
