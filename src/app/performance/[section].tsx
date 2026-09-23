import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { RecordRow, type RecordIcon } from "@/components/RecordRow";
import { effortRecords, listRuns, personalRecords, type EffortRecord, type PersonalRecords, type Run } from "@/lib/db";
import { effortName } from "@/lib/efforts";
import { formatDate, formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { inSentence, performanceTitles, readSection } from "@/lib/performance";
import { goalName } from "@/lib/plan";
import { effortSamples, predictRaces } from "@/lib/predictions";
import { useSettings } from "@/lib/settings";
import { weeklyVolumeKm, weekStreak } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import { distanceUnit, elevationUnit, paceUnit } from "@/lib/units";

const pageStrings = defineStrings({
  fr: {
    longest: "Plus longue sortie",
    fastestKm: "Kilomètre le plus rapide",
    bestAvgPace: "Meilleure allure moyenne",
    bestAvgPaceDetail: "sur 2 km minimum",
    mostElevation: "Plus fort dénivelé",
    longestStreak: "Plus longue série",
    longestStreakGoal: "semaines d'affilée à l'objectif",
    longestStreakActive: "semaines d'affilée avec une sortie",
    weeks: (count: number) => `${count} sem.`,
    effortsLede: "Le passage le plus rapide sur chaque distance, trouvé dans toutes tes sorties.",
    predictionsLede: "Ce que tu pourrais courir aujourd'hui, d'après tes 12 dernières semaines. Une estimation, pas une promesse.",
    predictionFrom: (pace: string, effort: string) => `${pace} · d'après ton ${effort}`,
    nothing: "Rien à montrer pour l'instant : cours encore un peu.",
    openRun: (label: string) => `${label}, voir la course`,
  },
  en: {
    longest: "Longest run",
    fastestKm: "Fastest kilometre",
    bestAvgPace: "Best average pace",
    bestAvgPaceDetail: "over 2 km or more",
    mostElevation: "Most elevation gain",
    longestStreak: "Longest streak",
    longestStreakGoal: "weeks in a row on goal",
    longestStreakActive: "weeks in a row with a run",
    weeks: (count: number) => `${count} wk`,
    effortsLede: "Your fastest stretch over each distance, found inside every run.",
    predictionsLede: "What you could run today, from your last 12 weeks. An estimate, not a promise.",
    predictionFrom: (pace: string, effort: string) => `${pace} · from your ${effort}`,
    nothing: "Nothing to show yet: run a little more.",
    openRun: (label: string) => `${label}, see the run`,
  },
});

interface Row {
  key: string;
  icon: RecordIcon;
  label: string;
  value: string;
  detail?: string;
  /** The run it was set on, opened by a tap. */
  runId?: number;
}

/**
 * One of the profile's three lists, in full: records, best efforts or
 * predicted times.
 *
 * They used to be stacked on the profile itself, twenty rows under the week,
 * which made the page something to scroll through rather than read. The
 * profile now shows the headline of each, and this page the rest.
 */
export default function PerformanceScreen() {
  const s = useStrings(pageStrings);
  const titles = useStrings(performanceTitles);
  const section = readSection(useLocalSearchParams<{ section: string }>().section);
  const settings = useSettings();
  const router = useRouter();
  const [data, setData] = useState<{
    runs: Run[]; records: PersonalRecords; efforts: EffortRecord[]; readAt: number;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listRuns(), personalRecords(), effortRecords()])
        .then(([runs, records, efforts]) => {
          if (active) setData({ runs, records, efforts, readAt: Date.now() });
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const rows: Row[] = [];
  let lede: string | null = null;

  if (data && section === "records") {
    const { records } = data;
    if (records.longest) {
      rows.push({
        key: "longest", icon: "trail-sign-outline", label: s.longest,
        value: `${formatDistance(records.longest.distanceM)} ${distanceUnit()}`,
        detail: records.longest.name ?? undefined, runId: records.longest.id,
      });
    }
    if (records.fastestKm?.fastestKmS != null) {
      rows.push({
        key: "fastestKm", icon: "flash-outline", label: s.fastestKm,
        value: formatPace(records.fastestKm.fastestKmS),
        detail: records.fastestKm.name ?? undefined, runId: records.fastestKm.id,
      });
    }
    if (records.bestAvgPace?.avgPaceSKm != null) {
      rows.push({
        key: "bestAvgPace", icon: "speedometer-outline", label: s.bestAvgPace,
        value: formatPace(records.bestAvgPace.avgPaceSKm),
        detail: s.bestAvgPaceDetail, runId: records.bestAvgPace.id,
      });
    }
    if (records.mostElevation?.elevationGainM != null && records.mostElevation.elevationGainM > 0) {
      rows.push({
        key: "mostElevation", icon: "trending-up-outline", label: s.mostElevation,
        value: `${formatElevation(records.mostElevation.elevationGainM)} ${elevationUnit()}`,
        detail: records.mostElevation.name ?? undefined, runId: records.mostElevation.id,
      });
    }
    const streak = weekStreak(data.runs, settings.weeklyGoalM, data.readAt);
    if (streak.best >= 2) {
      rows.push({
        key: "streak", icon: "flame-outline", label: s.longestStreak, value: s.weeks(streak.best),
        detail: streak.kind === "goal" ? s.longestStreakGoal : s.longestStreakActive,
      });
    }
  }

  if (data && section === "efforts") {
    lede = s.effortsLede;
    for (const effort of data.efforts) {
      rows.push({
        key: effort.key, icon: "stopwatch-outline", label: effortName(effort.key),
        value: formatDuration(Math.round(effort.seconds)),
        detail: effort.run.name ?? formatDate(effort.run.startedAt), runId: effort.run.id,
      });
    }
  }

  if (data && section === "predictions") {
    lede = s.predictionsLede;
    // Projected with the weekly volume the plans use, so a race time here and
    // the pace a programme hands out come from the same runner.
    const predictions = predictRaces(effortSamples(data.runs), data.readAt, weeklyVolumeKm(data.runs, data.readAt));
    for (const prediction of predictions) {
      rows.push({
        key: prediction.goal, icon: "flag-outline", label: goalName(prediction.goal),
        value: formatDuration(Math.round(prediction.timeS)),
        detail: s.predictionFrom(`${formatPace(prediction.paceSKm)}${paceUnit()}`, inSentence(effortName(prediction.from.key))),
      });
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: titles[section] }} />
      {lede ? <Text style={styles.lede}>{lede}</Text> : null}
      {rows.map((row, index) => (
        <RecordRow
          key={row.key}
          first={index === 0}
          icon={row.icon}
          label={row.label}
          value={row.value}
          detail={row.detail}
          onPress={row.runId === undefined ? undefined : () => router.push(`/run/${row.runId}`)}
          accessibilityLabel={row.runId === undefined ? undefined : s.openRun(`${row.label}, ${row.value}`)}
        />
      ))}
      {data && rows.length === 0 ? <Text style={styles.lede}>{s.nothing}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 4, paddingBottom: 40 },
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, paddingBottom: 12,
  },
});
