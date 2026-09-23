import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { deleteRun, listRuns, planSessionOfRun, type Run } from "@/lib/db";
import { importRunFiles } from "@/lib/files";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { forgetRunInHealth } from "@/lib/health";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { useTabBarSpace } from "@/lib/layout";
import { colors, font } from "@/lib/theme";

const historyStrings = defineStrings({
  fr: {
    title: "Historique",
    summary: (count: number, km: string) => `${plural(count, "course", "courses")} · ${km} km au total`,
    importDone: "Import terminé",
    importFailed: "Import impossible",
    unexpectedError: "Erreur inattendue.",
    deleteTitle: "Supprimer cette course ?",
    defaultRunName: "Course",
    deleteBody: "Ses points GPS seront effacés et l'action est définitive.",
    deleteLinked: " La séance correspondante redeviendra à faire dans ton programme.",
    cancel: "Annuler",
    delete: "Supprimer",
    empty:
      "Aucune course pour l'instant. Touche le bouton ▶ au centre de la barre pour enregistrer ta première sortie.",
    importing: "Import…",
    importFromApp: "Importer depuis une autre app",
    importHint: "Strava, Garmin, une montre : exporte tes courses en fichiers GPX, puis ouvre-les ici.",
    thisRun: "cette course",
  },
  en: {
    title: "History",
    summary: (count: number, km: string) => `${plural(count, "run", "runs")} · ${km} km in total`,
    importDone: "Import complete",
    importFailed: "Import failed",
    unexpectedError: "Unexpected error.",
    deleteTitle: "Delete this run?",
    defaultRunName: "Run",
    deleteBody: "Its GPS points will be erased, and this cannot be undone.",
    deleteLinked: " The matching session will be back on your training plan.",
    cancel: "Cancel",
    delete: "Delete",
    empty: "No runs yet. Tap the ▶ button in the middle of the bar to record your first run.",
    importing: "Importing…",
    importFromApp: "Import from another app",
    importHint: "Strava, Garmin, a watch: export your runs as GPX files, then open them here.",
    thisRun: "this run",
  },
});

export default function HistoryScreen() {
  /**
   * Tapping the section you are already in walks back to the top.
   *
   * The navigator emits a press even when the tab is already the one showing,
   * and this hook is what listens for it. Without it that tap does nothing at
   * all, which reads as the app having missed the finger rather than as
   * having nothing to do.
   */
  const s = useStrings(historyStrings);
  const list = useRef<FlatList<Run>>(null);
  useScrollToTop(list);

  const [runs, setRuns] = useState<Run[] | null>(null);
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
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

  /**
   * The row leaves the list at once, then the database catches up. Waiting for
   * the write would leave the row sitting there after the tap, which reads as
   * a broken button.
   */
  async function remove(run: Run) {
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
   * Runs from another app, offered where it matters most: on an empty
   * history, to somebody who did not start running the day they installed
   * this one. Also in Réglages › Données, for later.
   */
  async function importGpx() {
    if (importing) return;
    setImporting(true);
    try {
      const summary = await importRunFiles();
      if (summary === null) return;
      await reload();
      Alert.alert(historyStrings().importDone, summary);
    } catch (cause) {
      const text = historyStrings();
      Alert.alert(text.importFailed, cause instanceof Error ? cause.message : text.unexpectedError);
    } finally {
      setImporting(false);
    }
  }

  const totalM = (runs ?? []).reduce((total, run) => total + run.distanceM, 0);

  /**
   * Arm the deletion, and find out what else it would take with it.
   *
   * Asked here rather than in the dialog because the answer decides what the
   * dialog says, and a warning that appears a moment after the question is a
   * warning nobody reads.
   */
  async function askDelete(run: Run) {
    // Asked before the alert rather than after it, so the warning is complete
    // the first time anybody reads it.
    const linked = await planSessionOfRun(run.id).catch(() => null);
    const text = historyStrings();
    Alert.alert(
      text.deleteTitle,
      `${run.name ?? text.defaultRunName}, ${formatDistance(run.distanceM)} km. `
      + text.deleteBody
      + (linked ? text.deleteLinked : ""),
      [
        { text: text.cancel, style: "cancel" },
        { text: text.delete, style: "destructive", onPress: () => void remove(run) },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* The page arrives rather than appearing: coming from a screen that
          just slid its own furniture away, a list that simply exists in the
          next frame reads as a cut. */}
      {/* A plain view. The tab itself cross-fades this screen in, and a
          second opacity animation on top of that one was not a second effect
          but a second chance to fail: when the inner fade did not run to
          completion the screen stayed at zero, which is the white page that
          appeared on some tab changes and not others. */}
      <View style={styles.fill}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{s.title}</Text>
          {runs && runs.length > 0 && (
            <Text style={styles.subtitle}>
              {s.summary(runs.length, formatDistance(totalM))}
            </Text>
          )}
        </View>
      </View>

      <FlatList
        ref={list}
        data={runs ?? []}
        keyExtractor={(run) => String(run.id)}
        // Room for the bar and for the button floating above it, so the last
        // run in the list is never sitting underneath either of them.
        contentContainerStyle={{ paddingBottom: tabBarSpace + 60 }}
        ListEmptyComponent={
          runs === null ? null : (
            <View style={styles.emptyBlock}>
              <Text style={styles.empty}>{s.empty}</Text>
              <Button
                label={importing ? s.importing : s.importFromApp}
                variant="secondary"
                onPress={() => void importGpx()}
                disabled={importing}
              />
              <Text style={styles.emptyHint}>{s.importHint}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <SwipeToDelete label={item.name ?? s.thisRun} onDelete={() => void askDelete(item)}>
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

      </View>


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
