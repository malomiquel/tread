import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listRuns, type Run } from "@/lib/db";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { colors, shadows } from "@/lib/theme";

export default function HistoryScreen() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const router = useRouter();

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
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          runs === null ? null : (
            <Text style={styles.empty}>
              Aucune course pour l&apos;instant. La première t&apos;attend dans l&apos;onglet Courir.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/run/[id]", params: { id: String(item.id) } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.name}>{item.name ?? formatDate(item.startedAt)}</Text>
              {item.name ? <Text style={styles.when}>{formatDate(item.startedAt)}</Text> : null}
              <Text style={styles.detail}>
                {formatDuration(item.durationS)} · {formatPace(item.avgPaceSKm)} /km
              </Text>
            </View>
            <Text style={styles.distance}>
              {formatDistance(item.distanceM)} <Text style={styles.km}>km</Text>
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.subtle, fontSize: 11.5, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  empty: {
    color: colors.muted, fontSize: 13, textAlign: "center",
    marginTop: 60, lineHeight: 20, paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, ...shadows.card,
  },
  rowPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  rowLeft: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  when: { color: colors.subtle, fontSize: 11 },
  detail: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  distance: { color: colors.accent, fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  km: { color: colors.muted, fontSize: 11.5, fontWeight: "500" },
});
