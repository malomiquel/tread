import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { listRuns, type Run } from "@/lib/db";
import { createDemoRun } from "@/lib/demo";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { colors } from "@/lib/theme";

export default function HistoryScreen() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [seeding, setSeeding] = useState(false);
  const router = useRouter();

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

  const totalM = (runs ?? []).reduce((total, run) => total + run.distanceM, 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
        {runs && runs.length > 0 && (
          <Text style={styles.subtitle}>
            {runs.length} course{runs.length > 1 ? "s" : ""} · {formatDistance(totalM)} km au total
          </Text>
        )}
      </View>

      <FlatList
        data={runs ?? []}
        keyExtractor={(run) => String(run.id)}
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
        )}
      />
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.6 },
  subtitle: { color: colors.subtle, fontSize: 12, marginTop: 3 },

  emptyBlock: { marginTop: 56, paddingHorizontal: GUTTER, gap: 18, alignItems: "stretch" },
  empty: { color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 21 },
  emptyHint: { color: colors.subtle, fontSize: 11.5, textAlign: "center", lineHeight: 17 },

  // A plain list separated by rules, the way a timetable or a statement is
  // set. Boxing each run in its own floating card added nothing but noise.
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16,
    paddingHorizontal: GUTTER, paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.sunken },
  rowLeft: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15.5, fontWeight: "600", letterSpacing: -0.2 },
  when: { color: colors.subtle, fontSize: 11.5 },
  detail: { color: colors.muted, fontSize: 12.5, fontVariant: ["tabular-nums"] },
  distance: {
    color: colors.text, fontSize: 22, fontWeight: "600",
    letterSpacing: -0.8, fontVariant: ["tabular-nums"],
  },
  km: { color: colors.subtle, fontSize: 11.5, fontWeight: "600", letterSpacing: 0 },
});
