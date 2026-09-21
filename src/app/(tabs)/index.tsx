import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useState, useRef } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { archiveFileName, buildArchive } from "@/lib/archive";
import { deleteRun, importRun, listRuns, readRun, type Run } from "@/lib/db";
import { createDemoRun } from "@/lib/demo";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { parseGpx } from "@/lib/gpx";
import { forgetRunInHealth } from "@/lib/health";
import { useTabBarSpace } from "@/lib/layout";
import { colors, font } from "@/lib/theme";

export default function HistoryScreen() {
  /**
   * Tapping the section you are already in walks back to the top.
   *
   * The navigator emits a press even when the tab is already the one showing,
   * and this hook is what listens for it. Without it that tap does nothing at
   * all, which reads as the app having missed the finger rather than as
   * having nothing to do.
   */
  const list = useRef<FlatList<Run>>(null);
  useScrollToTop(list);

  const [runs, setRuns] = useState<Run[] | null>(null);
  const [seeding, setSeeding] = useState(false);
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const [pending, setPending] = useState<Run | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [importing, setImporting] = useState(false);

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
   * Brings runs in from GPX files: an old app, another watch, or an archive
   * this app wrote itself.
   *
   * Until now the door only opened outwards — runs could leave but never come
   * back, so an export was a copy you could look at and not a backup you
   * could restore. Several files at once, because an archive is rarely one
   * run, and already-known runs are counted and skipped rather than refused
   * with an error.
   */
  async function importGpx() {
    if (importing) return;
    setImporting(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Loose on purpose: a GPX arrives declared as XML, as plain text or as
        // nothing at all depending on where it was written.
        type: ["application/gpx+xml", "application/xml", "text/xml", "*/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      let added = 0;
      let known = 0;
      let unreadable = 0;
      for (const file of picked.assets) {
        try {
          const { name, points } = parseGpx(await new File(file.uri).text());
          const id = await importRun(name, points);
          if (id === null) known += 1;
          else added += 1;
        } catch {
          unreadable += 1;
        }
      }

      await reload();
      const summary = [
        added > 0 ? `${added} course${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}` : null,
        known > 0 ? `${known} déjà connue${known > 1 ? "s" : ""}` : null,
        unreadable > 0 ? `${unreadable} illisible${unreadable > 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(" · ");
      Alert.alert("Import terminé", summary || "Aucune course dans ces fichiers.");
    } catch (cause) {
      Alert.alert("Import impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setImporting(false);
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
      {/* The page arrives rather than appearing: coming from a screen that
          just slid its own furniture away, a list that simply exists in the
          next frame reads as a cut. */}
      <Animated.View style={styles.fill} entering={FadeIn.duration(220)}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Historique</Text>
          {runs && runs.length > 0 && (
            <Text style={styles.subtitle}>
              {runs.length} course{runs.length > 1 ? "s" : ""} · {formatDistance(totalM)} km au total
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => void importGpx()}
          disabled={importing}
          accessibilityRole="button"
          accessibilityLabel="Importer des courses depuis des fichiers GPX"
          hitSlop={10}
          style={({ pressed }) => [styles.export, pressed && styles.pressed]}
        >
          {importing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="add" size={22} color={colors.text} />
          )}
        </Pressable>
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
        ref={list}
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

      </Animated.View>

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
  fill: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
    paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14,
  },
  headerText: { flex: 1 },
  export: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  title: { color: colors.text, fontSize: 32, fontFamily: font.bold, letterSpacing: -0.6 },
  subtitle: { color: colors.subtle, fontFamily: font.regular, fontSize: 15, marginTop: 3 },

  emptyBlock: { marginTop: 56, paddingHorizontal: GUTTER, gap: 18, alignItems: "stretch" },
  empty: { color: colors.muted, fontFamily: font.regular, fontSize: 17.5, textAlign: "center", lineHeight: 27.5 },
  emptyHint: { color: colors.subtle, fontFamily: font.regular, fontSize: 14.5, textAlign: "center", lineHeight: 22 },

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
  name: { color: colors.text, fontSize: 20.5, fontFamily: font.semibold, letterSpacing: -0.2 },
  when: { color: colors.subtle, fontSize: 14.5 },
  detail: { color: colors.muted, fontFamily: font.regular, fontSize: 16, fontVariant: ["tabular-nums"] },
  distance: {
    color: colors.text, fontSize: 29, fontFamily: font.semibold,
    letterSpacing: -0.8, fontVariant: ["tabular-nums"],
  },
  km: { color: colors.subtle, fontSize: 14.5, fontFamily: font.semibold, letterSpacing: 0 },
});
