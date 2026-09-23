import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WeeklyGoalSheet } from "@/components/WeeklyGoalSheet";
import { listRuns, personalRecords, type PersonalRecords, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { useTabBarSpace } from "@/lib/layout";
import { useSettings } from "@/lib/settings";
import { goalProgress, suggestedWeeklyGoalM, weekStart } from "@/lib/stats";
import { colors, font } from "@/lib/theme";

const profileStrings = defineStrings({
  fr: {
    title: "Profil",
    settings: "Réglages",
    empty: "Rien à afficher pour le moment. Tes statistiques se construiront course après course.",
    thisWeek: "Cette semaine",
    runs: (count: number) => plural(count, "course", "courses"),
    goalEdit: (km: string) => `Objectif hebdomadaire, ${km} kilomètres, modifier`,
    goalSet: "Définir un objectif hebdomadaire",
    goalReached: (km: string, percent: number) => `Objectif de ${km} km atteint · ${percent} %`,
    goalRemaining: (remaining: string, km: string) =>
      `${remaining} km pour tenir l'objectif de ${km} km`,
    goalInvite: "Se fixer un objectif hebdomadaire",
    today: "auj.",
    chartCaption: (weeks: number) => `Distance par semaine, ${weeks} dernières`,
    records: "Records",
    longest: "Plus longue sortie",
    fastestKm: "Kilomètre le plus rapide",
    bestAvgPace: "Meilleure allure moyenne",
    bestAvgPaceDetail: "sur 2 km minimum",
    mostElevation: "Plus fort dénivelé",
    allTime: "Depuis le début",
    totalRuns: "Courses",
    distance: "Distance",
    time: "Temps",
    elevation: "Dénivelé",
  },
  en: {
    title: "Profile",
    settings: "Settings",
    empty: "Nothing to show yet. Your stats will build up run after run.",
    thisWeek: "This week",
    runs: (count: number) => plural(count, "run", "runs"),
    goalEdit: (km: string) => `Weekly goal, ${km} kilometres, edit`,
    goalSet: "Set a weekly goal",
    goalReached: (km: string, percent: number) => `${km} km goal reached · ${percent}%`,
    goalRemaining: (remaining: string, km: string) =>
      `${remaining} km to go to reach your ${km} km goal`,
    goalInvite: "Set yourself a weekly goal",
    today: "now",
    chartCaption: (weeks: number) => `Distance per week, last ${weeks}`,
    records: "Personal records",
    longest: "Longest run",
    fastestKm: "Fastest kilometre",
    bestAvgPace: "Best average pace",
    bestAvgPaceDetail: "over 2 km or more",
    mostElevation: "Most elevation gain",
    allTime: "All time",
    totalRuns: "Runs",
    distance: "Distance",
    time: "Time",
    elevation: "Elevation gain",
  },
});

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

/**
 * Who this runner is: the week, the records, the totals, and the way into the
 * settings.
 *
 * Progression used to be a tab of its own, beside this one — two pages about
 * the same person, one holding every figure and the other holding almost
 * nothing. That is how a tab bar ends up with a page nobody opens beside a
 * page nobody can find anything in. They are one page now, and the tab they
 * freed went to the routes, which had been living inside a button on a map.
 */
export default function ProfileScreen() {
  /**
   * Tapping the section you are already in walks back to the top.
   *
   * The navigator emits a press even when the tab is already the one showing,
   * and this hook is what listens for it. Without it that tap does nothing at
   * all, which reads as the app having missed the finger rather than as
   * having nothing to do.
   */
  const s = useStrings(profileStrings);
  const page = useRef<ScrollView>(null);
  useScrollToTop(page);
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [records, setRecords] = useState<PersonalRecords | null>(null);
  /** Their own recent average, to open the goal sheet on something familiar. */
  const [suggestedM, setSuggestedM] = useState(5000);
  const [settingGoal, setSettingGoal] = useState(false);
  const settings = useSettings();
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listRuns(), personalRecords()])
        .then(([runs, best]) => {
          if (!active) return;
          setWeeks(byWeek(runs));
          setRecords(best);
          setSuggestedM(suggestedWeeklyGoalM(runs));
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  // The heading stays while the figures are fetched. An empty screen for the
  // length of a query is indistinguishable from a broken one, and it is the
  // whole of what people were seeing as a white page between tabs.
  if (!weeks || !records) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.head}>
          <Text style={styles.title}>{s.title}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const current = weeks[weeks.length - 1];
  const peak = Math.max(...weeks.map((w) => w.distanceM), 1);
  const goal = goalProgress(current.distanceM, settings.weeklyGoalM);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Same arrival as the history: the page settles in rather than
          replacing what was there between two frames. */}
      {/* A plain view. The tab itself cross-fades this screen in, and a
          second opacity animation on top of that one was not a second effect
          but a second chance to fail: when the inner fade did not run to
          completion the screen stayed at zero, which is the white page that
          appeared on some tab changes and not others. */}
      <View style={styles.fill}>
      <ScrollView ref={page} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
        <View style={styles.head}>
          <Text style={styles.title}>{s.title}</Text>
          {/* Settings are a page, not a section, and a cog is where anybody
              looks for the rest. */}
          <Pressable
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel={s.settings}
            hitSlop={10}
            style={({ pressed }) => [styles.cog, pressed && styles.linkPressed]}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {records.totalRuns === 0 ? (
          <Text style={styles.empty}>{s.empty}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{s.thisWeek}</Text>
              <View style={styles.heroRow}>
                <Text style={styles.hero}>{formatDistance(current.distanceM)}</Text>
                <Text style={styles.heroUnit}>km</Text>
              </View>
              <Text style={styles.heroSub}>
                {s.runs(current.runs)} · {formatDuration(current.durationS)}
              </Text>

              {/* The week's figure on its own says how far; against a goal it
                  says whether that is enough, which is the only question
                  anybody was really asking of it. Tappable whether or not one
                  is set, because the way in has to exist before the goal
                  does. */}
              <Pressable
                onPress={() => setSettingGoal(true)}
                accessibilityRole="button"
                accessibilityLabel={
                  goal
                    ? s.goalEdit(formatDistance(settings.weeklyGoalM ?? 0))
                    : s.goalSet
                }
                style={({ pressed }) => [styles.goal, pressed && styles.goalPressed]}
              >
                {goal ? (
                  <>
                    <View style={styles.goalBar}>
                      <View
                        style={[styles.goalFill, { width: `${goal.share * 100}%` }]}
                      />
                    </View>
                    <Text style={styles.goalText}>
                      {goal.reached
                        ? s.goalReached(formatDistance(settings.weeklyGoalM ?? 0), goal.percent)
                        : s.goalRemaining(
                          formatDistance(goal.remainingM),
                          formatDistance(settings.weeklyGoalM ?? 0),
                        )}
                    </Text>
                  </>
                ) : (
                  <View style={styles.goalInvite}>
                    <Ionicons name="flag-outline" size={15} color={colors.accent} />
                    <Text style={styles.goalInviteText}>{s.goalInvite}</Text>
                  </View>
                )}
              </Pressable>

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
                      {i === weeks.length - 1 ? s.today : `-${weeks.length - 1 - i}`}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.caption}>{s.chartCaption(WEEKS_SHOWN)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{s.records}</Text>
              {records.longest && (
                <RecordRow
                  label={s.longest}
                  value={`${formatDistance(records.longest.distanceM)} km`}
                  detail={records.longest.name ?? undefined}
                />
              )}
              {records.fastestKm?.fastestKmS != null && (
                <RecordRow
                  label={s.fastestKm}
                  value={formatPace(records.fastestKm.fastestKmS)}
                  detail={records.fastestKm.name ?? undefined}
                />
              )}
              {records.bestAvgPace?.avgPaceSKm != null && (
                <RecordRow
                  label={s.bestAvgPace}
                  value={formatPace(records.bestAvgPace.avgPaceSKm)}
                  detail={s.bestAvgPaceDetail}
                />
              )}
              {records.mostElevation?.elevationGainM != null && records.mostElevation.elevationGainM > 0 && (
                <RecordRow
                  label={s.mostElevation}
                  value={`${formatElevation(records.mostElevation.elevationGainM)} m`}
                  detail={records.mostElevation.name ?? undefined}
                />
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{s.allTime}</Text>
              <RecordRow label={s.totalRuns} value={String(records.totalRuns)} />
              <RecordRow label={s.distance} value={`${formatDistance(records.totalDistanceM)} km`} />
              <RecordRow label={s.time} value={formatDuration(records.totalDurationS)} />
              <RecordRow label={s.elevation} value={`${formatElevation(records.totalElevationM)} m`} />
            </View>
          </>
        )}
      </ScrollView>
      </View>

      <WeeklyGoalSheet
        visible={settingGoal}
        goalM={settings.weeklyGoalM}
        suggestedM={suggestedM}
        onClose={() => setSettingGoal(false)}
      />
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: {},
  // The same room under the heading as the history and the routes leave:
  // without it the cog's ring sat right on the first card's rule.
  head: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14,
  },
  title: { color: colors.text, fontSize: 32, fontFamily: font.bold, letterSpacing: -0.6 },
  cog: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  // The one line that says who this is: everything below it is the detail.
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15,
    paddingHorizontal: GUTTER, marginTop: 2, paddingBottom: 12,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    color: colors.muted, fontFamily: font.regular, fontSize: 16.5, textAlign: "center",
    marginTop: 56, lineHeight: 27.5, paddingHorizontal: GUTTER,
  },

  // Sections run edge to edge, told apart by a rule rather than by floating on
  // their own surface.
  card: {
    paddingHorizontal: GUTTER, paddingVertical: 18, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  cardTitle: {
    color: colors.subtle, fontSize: 13, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  hero: {
    color: colors.text, fontSize: 53.5, fontFamily: font.bold,
    letterSpacing: -1.17, fontVariant: ["tabular-nums"],
  },
  heroUnit: { color: colors.subtle, fontSize: 16.5, fontFamily: font.semibold },
  heroSub: { color: colors.muted, fontFamily: font.regular, fontSize: 15, marginTop: -2, fontVariant: ["tabular-nums"] },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 84, marginTop: 8 },
  column: { flex: 1, alignItems: "center", gap: 6 },
  barArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2, backgroundColor: colors.accentSoft },
  barCurrent: { backgroundColor: colors.accent },
  weekLabel: { color: colors.subtle, fontFamily: font.regular, fontSize: 13, fontVariant: ["tabular-nums"] },
  caption: { color: colors.subtle, fontSize: 13 },

  goal: { gap: 6, paddingTop: 4 },
  goalPressed: { opacity: 0.6 },
  goalBar: { height: 7, borderRadius: 3.5, backgroundColor: colors.sunken, overflow: "hidden" },
  goalFill: { height: 7, borderRadius: 3.5, backgroundColor: colors.accent },
  goalText: { color: colors.muted, fontFamily: font.regular, fontSize: 14, fontVariant: ["tabular-nums"] },
  goalInvite: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalInviteText: { color: colors.accent, fontFamily: font.semibold, fontSize: 14.5 },

  linkPressed: { opacity: 0.6 },

  record: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 9,
  },
  recordLeft: { flex: 1, gap: 1 },
  recordLabel: { color: colors.text, fontSize: 16.5 },
  recordDetail: { color: colors.subtle, fontSize: 14 },
  recordValue: {
    color: colors.text, fontSize: 19, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
});
