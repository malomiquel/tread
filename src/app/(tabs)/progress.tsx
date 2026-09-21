import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listRuns, personalRecords, type PersonalRecords, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { weekStart } from "@/lib/stats";
import { colors, font } from "@/lib/theme";

const WEEKS_SHOWN = 6;
const DAY_MS = 86_400_000;

interface Week {
  start: number;
  distanceM: number;
  durationS: number;
  runs: number;
}

function byWeek(runs: Run[]): Week[] {
  const weeks = new Map<number, Week>();
  const thisWeek = weekStart(Date.now());

  // Seed the empty weeks first: a week without a run must show as a bar at
  // zero, not vanish from the chart.
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY_MS;
    weeks.set(start, { start, distanceM: 0, durationS: 0, runs: 0 });
  }

  for (const run of runs) {
    const week = weeks.get(weekStart(run.startedAt));
    if (!week) continue;
    week.distanceM += run.distanceM;
    week.durationS += run.durationS;
    week.runs += 1;
  }
  return [...weeks.values()];
}

function RecordRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.record}>
      <View style={styles.recordLeft}>
        <Text style={styles.recordLabel}>{label}</Text>
        {detail ? <Text style={styles.recordDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [records, setRecords] = useState<PersonalRecords | null>(null);
  const tabBarSpace = useTabBarSpace();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listRuns(), personalRecords()])
        .then(([runs, best]) => {
          if (!active) return;
          setWeeks(byWeek(runs));
          setRecords(best);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  if (!weeks || !records) return <SafeAreaView style={styles.screen} edges={["top"]} />;

  const current = weeks[weeks.length - 1];
  const peak = Math.max(...weeks.map((w) => w.distanceM), 1);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
        <Text style={styles.title}>Progression</Text>

        {records.totalRuns === 0 ? (
          <Text style={styles.empty}>
            Rien à afficher pour le moment. Tes statistiques se construiront course après course.
          </Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cette semaine</Text>
              <View style={styles.heroRow}>
                <Text style={styles.hero}>{formatDistance(current.distanceM)}</Text>
                <Text style={styles.heroUnit}>km</Text>
              </View>
              <Text style={styles.heroSub}>
                {current.runs} course{current.runs > 1 ? "s" : ""} · {formatDuration(current.durationS)}
              </Text>

              <View style={styles.chart}>
                {weeks.map((week, i) => (
                  <View key={week.start} style={styles.column}>
                    <View style={styles.barArea}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${Math.max(2, (week.distanceM / peak) * 100)}%` },
                          i === weeks.length - 1 && styles.barCurrent,
                        ]}
                      />
                    </View>
                    <Text style={styles.weekLabel}>
                      {i === weeks.length - 1 ? "auj." : `-${weeks.length - 1 - i}`}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.caption}>Distance par semaine, {WEEKS_SHOWN} dernières</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Records</Text>
              {records.longest && (
                <RecordRow
                  label="Plus longue sortie"
                  value={`${formatDistance(records.longest.distanceM)} km`}
                  detail={records.longest.name ?? undefined}
                />
              )}
              {records.fastestKm?.fastestKmS != null && (
                <RecordRow
                  label="Kilomètre le plus rapide"
                  value={formatPace(records.fastestKm.fastestKmS)}
                  detail={records.fastestKm.name ?? undefined}
                />
              )}
              {records.bestAvgPace?.avgPaceSKm != null && (
                <RecordRow
                  label="Meilleure allure moyenne"
                  value={formatPace(records.bestAvgPace.avgPaceSKm)}
                  detail="sur 2 km minimum"
                />
              )}
              {records.mostElevation?.elevationGainM != null && records.mostElevation.elevationGainM > 0 && (
                <RecordRow
                  label="Plus fort dénivelé"
                  value={`${formatElevation(records.mostElevation.elevationGainM)} m`}
                  detail={records.mostElevation.name ?? undefined}
                />
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Depuis le début</Text>
              <RecordRow label="Courses" value={String(records.totalRuns)} />
              <RecordRow label="Distance" value={`${formatDistance(records.totalDistanceM)} km`} />
              <RecordRow label="Temps" value={formatDuration(records.totalDurationS)} />
              <RecordRow label="Dénivelé" value={`${formatElevation(records.totalElevationM)} m`} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {},
  title: {
    color: colors.text, fontSize: 24, fontFamily: font.bold,
    letterSpacing: -0.6, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14,
  },
  empty: {
    color: colors.muted, fontFamily: font.regular, fontSize: 13.5, textAlign: "center",
    marginTop: 56, lineHeight: 21, paddingHorizontal: GUTTER,
  },

  // Sections run edge to edge, told apart by a rule rather than by floating on
  // their own surface.
  card: {
    paddingHorizontal: GUTTER, paddingVertical: 18, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  cardTitle: {
    color: colors.subtle, fontSize: 10, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  hero: {
    color: colors.text, fontSize: 56, fontFamily: font.bold,
    letterSpacing: -1.17, fontVariant: ["tabular-nums"],
  },
  heroUnit: { color: colors.subtle, fontSize: 15, fontFamily: font.semibold },
  heroSub: { color: colors.muted, fontFamily: font.regular, fontSize: 12.5, marginTop: -4, fontVariant: ["tabular-nums"] },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 84, marginTop: 8 },
  column: { flex: 1, alignItems: "center", gap: 6 },
  barArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2, backgroundColor: colors.accentSoft },
  barCurrent: { backgroundColor: colors.accent },
  weekLabel: { color: colors.subtle, fontFamily: font.regular, fontSize: 10, fontVariant: ["tabular-nums"] },
  caption: { color: colors.subtle, fontSize: 11 },

  record: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 9,
  },
  recordLeft: { flex: 1, gap: 1 },
  recordLabel: { color: colors.text, fontSize: 13.5 },
  recordDetail: { color: colors.subtle, fontSize: 11.5 },
  recordValue: {
    color: colors.text, fontSize: 15.5, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
});
