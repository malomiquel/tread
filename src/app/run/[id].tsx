import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { deleteRun, readRun, type Run } from "@/lib/db";
import { formatDate, formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { splits, type TrackPoint } from "@/lib/geo";
import { colors, shadows } from "@/lib/theme";

type Loaded = { run: Run; points: TrackPoint[] };

export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // undefined while loading, null when not found.
  const [data, setData] = useState<Loaded | null | undefined>(undefined);

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
        <Text style={styles.muted}>Run not found.</Text>
      </View>
    );
  }

  const { run, points } = data;
  const kilometres = splits(points);
  const fastest = kilometres
    .filter((split) => !split.partial)
    .reduce<number | null>((best, split) => (best === null || split.durationS < best ? split.durationS : best), null);
  const fullCount = kilometres.filter((split) => !split.partial).length;

  function confirmDelete() {
    Alert.alert("Delete this run?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
        {run.name ? <Text style={styles.name}>{run.name}</Text> : null}
        <Text style={styles.date}>{formatDate(run.startedAt)}</Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="Distance" value={formatDistance(run.distanceM)} unit="km" large />
        <View style={styles.row}>
          <Metric label="Duration" value={formatDuration(run.durationS)} />
          <Metric label="Avg pace" value={formatPace(run.avgPaceSKm)} unit="/km" />
        </View>
        {run.elevationGainM !== null && (
          <View style={styles.row}>
            <Metric label="Elevation gain" value={formatElevation(run.elevationGainM)} unit="m" />
            {run.fastestKmS !== null ? (
              <Metric label="Fastest km" value={formatPace(run.fastestKmS)} unit="/km" />
            ) : null}
          </View>
        )}
      </View>

      <RunMap points={points} fitAll style={styles.map} />

      {kilometres.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Splits</Text>
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

      <Text style={styles.muted}>{points.length} GPS points recorded</Text>
      <Button label="Delete run" variant="danger" onPress={confirmDelete} style={styles.delete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  heading: { gap: 2 },
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
  delete: { flex: 0 },
});
