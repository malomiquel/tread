import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { archiveFileName, buildArchive } from "@/lib/archive";
import { deleteRun, listRuns, readRun, type Run } from "@/lib/db";
import { createDemoRun } from "@/lib/demo";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { forgetRunInHealth } from "@/lib/health";
import { useTabBarSpace } from "@/lib/layout";
import { colors, font } from "@/lib/theme";

export default function HistoryScreen() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [seeding, setSeeding] = useState(false);
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const [pending, setPending] = useState<Run | null>(null);
  const [archiving, setArchiving] = useState(false);

  const reload = useCallback(() => listRuns().then(setRuns).catch(() => setRuns([])), []);

  // Reload whenever the tab regains focus: a run may have just finished.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listRuns()
        .then((rows) => {
          if (active) setRuns(rows);
        })
        .catch(() => {
          if (active) setRuns([]);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  // Only offered while the history is empty: it exists to show what a run
  // looks like before you have run one, not to clutter a real history.
  async function addDemo() {
    if (seeding) return;
    setSeeding(true);
    try {
      await createDemoRun();
      await reload();
    } finally {
      setSeeding(false);
    }
  }

  /**
   * The row leaves the list at once, then the database catches up. Waiting for
   * the write would leave the row sitting there after the tap, which reads as
   * a broken button.
   */
  async function remove(run: Run) {
    setPending(null);
    setRuns((current) => (current ?? []).filter((item) => item.id !== run.id));
    try {
      // Removes the copy in Apple Health too, so that throwing a run away here
      // does not leave a ghost of it there. Best effort, and silent.
      await forgetRunInHealth(run);
      await deleteRun(run.id);
    } catch {
      // The delete failed, so put the run back rather than pretend otherwise.
      await reload();
    }
  }

  /**
   * Writes every run to one zip of GPX files and hands it to the share sheet.
   *
   * This is the only backup the app has: the runs live in a single database on
   * this phone, and deleting the app takes them with it. Exporting them
   * somewhere else is what makes that survivable.
   */
  async function exportAll() {
    if (archiving || !runs?.length) return;
    setArchiving(true);
    try {
      const loaded = [];
      for (const run of runs) {
        const stored = await readRun(run.id);
        if (stored) loaded.push({ run: stored.run, points: stored.points });
      }

      const file = new File(Paths.cache, archiveFileName());
      file.create({ overwrite: true });
      file.write(await buildArchive(loaded), { encoding: "base64" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive" });
      } else {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
      }
    } catch (cause) {
      Alert.alert("Export impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setArchiving(false);
    }
  }

  const totalM = (runs ?? []).reduce((total, run) => total + run.distanceM, 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Historique</Text>
          {runs && runs.length > 0 && (
            <Text style={styles.subtitle}>
              {runs.length} course{runs.length > 1 ? "s" : ""} · {formatDistance(totalM)} km au total
            </Text>
          )}
        </View>
        {runs && runs.length > 0 && (
          <Pressable
            onPress={() => void exportAll()}
            disabled={archiving}
            accessibilityRole="button"
            accessibilityLabel="Exporter toutes les courses"
            hitSlop={10}
            style={({ pressed }) => [styles.export, pressed && styles.pressed]}
          >
            {archiving ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="share-outline" size={20} color={colors.text} />
            )}
          </Pressable>
        )}
      </View>

      <FlatList
        data={runs ?? []}
        keyExtractor={(run) => String(run.id)}
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        ListEmptyComponent={
          runs === null ? null : (
            <View style={styles.emptyBlock}>
              <Text style={styles.empty}>
                Aucune course pour l&apos;instant. La première t&apos;attend dans l&apos;onglet Courir.
              </Text>
              <Button
                label={seeding ? "Création…" : "Ajouter une course de démonstration"}
                variant="secondary"
                onPress={() => void addDemo()}
                disabled={seeding}
              />
              <Text style={styles.emptyHint}>
                Une sortie fictive de 5 km, pour voir le rendu. Supprimable depuis son détail.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <SwipeToDelete label={item.name ?? "cette course"} onDelete={() => setPending(item)}>
          <Pressable
            onPress={() => router.push({ pathname: "/run/[id]", params: { id: String(item.id) } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.name}>{item.name ?? formatDate(item.startedAt)}</Text>
              {item.name ? <Text style={styles.when}>{formatDate(item.startedAt)}</Text> : null}
              <Text style={styles.detail}>
                {formatDuration(item.durationS)} · {formatPace(item.avgPaceSKm)} /km
              </Text>
            </View>
            <Text style={styles.distance}>
              {formatDistance(item.distanceM)}
              <Text style={styles.km}> km</Text>
            </Text>
          </Pressable>
          </SwipeToDelete>
        )}
      />

      <ConfirmDialog
        visible={pending !== null}
        title="Supprimer cette course ?"
        message={
          pending
            ? `${pending.name ?? "Course"}, ${formatDistance(pending.distanceM)} km. Ses points GPS seront effacés et l'action est définitive.`
            : undefined
        }
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => pending && void remove(pending)}
        onCancel={() => setPending(null)}
      />
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14,
  },
  headerText: { flex: 1 },
  export: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  title: { color: colors.text, fontSize: 33, fontFamily: font.bold, letterSpacing: -0.6 },
  subtitle: { color: colors.subtle, fontFamily: font.regular, fontSize: 16, marginTop: 3 },

  emptyBlock: { marginTop: 56, paddingHorizontal: GUTTER, gap: 18, alignItems: "stretch" },
  empty: { color: colors.muted, fontFamily: font.regular, fontSize: 18.5, textAlign: "center", lineHeight: 28.5 },
  emptyHint: { color: colors.subtle, fontFamily: font.regular, fontSize: 15.5, textAlign: "center", lineHeight: 23 },

  // A plain list separated by rules, the way a timetable or a statement is
  // set. Boxing each run in its own floating card added nothing but noise.
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16,
    paddingHorizontal: GUTTER, paddingVertical: 15,
    // Opaque on purpose: the delete action sits behind the row, and a
    // transparent background would let its red show through.
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.sunken },
  rowLeft: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 21.5, fontFamily: font.semibold, letterSpacing: -0.2 },
  when: { color: colors.subtle, fontSize: 15.5 },
  detail: { color: colors.muted, fontFamily: font.regular, fontSize: 17, fontVariant: ["tabular-nums"] },
  distance: {
    color: colors.text, fontSize: 30, fontFamily: font.semibold,
    letterSpacing: -0.8, fontVariant: ["tabular-nums"],
  },
  km: { color: colors.subtle, fontSize: 15.5, fontFamily: font.semibold, letterSpacing: 0 },
});
