import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { HeaderButton } from "@/components/HeaderButton";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { BannerTag, bannerText, SummaryBanner } from "@/components/SummaryBanner";
import { WeeklyGoalSheet } from "@/components/WeeklyGoalSheet";
import { effortRecords, listRuns, personalRecords, type EffortRecord, type PersonalRecords, type Run } from "@/lib/db";
import { effortName } from "@/lib/efforts";
import { formatDistance, formatDuration, formatElevation } from "@/lib/format";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { useTabBarSpace } from "@/lib/layout";
import { useSettings } from "@/lib/settings";
import { performanceTitles, type PerformanceSection } from "@/lib/performance";
import { goalName } from "@/lib/plan";
import { effortSamples, predictRaces } from "@/lib/predictions";
import { goalProgress, suggestedWeeklyGoalM, weeklyVolumeKm, weekStart, weekStreak } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import { distanceUnit, elevationUnit } from "@/lib/units";
import { chooseSession } from "@/lib/tracker";

const profileStrings = defineStrings({
  fr: {
    title: "Profil",
    summary: (count: number, km: string) => `${plural(count, "course", "courses")} · ${km} ${distanceUnit()} au total`,
    progress: "Progression",
    lastWeeks: (weeks: number) => `${weeks} dernières semaines`,
    settings: "Réglages",
    runNow: "Courir maintenant",
    runNowDetail: "Ta première sortie lance tes records et tes totaux.",
    goalDetail: "Une distance à viser, du lundi au dimanche.",
    goalCurrent: (km: string) => `Objectif : ${km} ${distanceUnit()} par semaine`,
    thisWeek: "Cette semaine",
    runs: (count: number) => plural(count, "course", "courses"),
    goalEdit: (km: string) => `Objectif hebdomadaire, ${km} ${distanceUnit()}, modifier`,
    goalSet: "Définir un objectif hebdomadaire",
    goalReached: (km: string, percent: number) => `Objectif de ${km} ${distanceUnit()} atteint · ${percent} %`,
    goalRemaining: (remaining: string, km: string) =>
      `${remaining} ${distanceUnit()} pour tenir l'objectif de ${km} ${distanceUnit()}`,
    goalInvite: "Se fixer un objectif hebdomadaire",
    today: "auj.",
    performance: "Performances",
    longest: "Plus longue sortie",
    allTime: "Depuis le début",
    totalRuns: "Courses",
    distance: "Distance",
    time: "Temps",
    elevation: "Dénivelé",
    streakGoal: (weeks: number) => `Objectif tenu ${weeks} semaines d'affilée`,
    streakActive: (weeks: number) => `${weeks} semaines d'affilée`,
    predicted: (race: string) => `${race}, prédit`,
  },
  en: {
    title: "Profile",
    summary: (count: number, km: string) => `${plural(count, "run", "runs")} · ${km} ${distanceUnit()} in total`,
    progress: "Progress",
    lastWeeks: (weeks: number) => `last ${weeks} weeks`,
    settings: "Settings",
    runNow: "Run now",
    runNowDetail: "Your first run starts your records and totals.",
    goalDetail: "A distance to aim for, Monday to Sunday.",
    goalCurrent: (km: string) => `Goal: ${km} ${distanceUnit()} a week`,
    thisWeek: "This week",
    runs: (count: number) => plural(count, "run", "runs"),
    goalEdit: (km: string) => `Weekly goal, ${km} ${distanceUnit()}, edit`,
    goalSet: "Set a weekly goal",
    goalReached: (km: string, percent: number) => `${km} ${distanceUnit()} goal reached · ${percent}%`,
    goalRemaining: (remaining: string, km: string) =>
      `${remaining} ${distanceUnit()} to go to reach your ${km} ${distanceUnit()} goal`,
    goalInvite: "Set yourself a weekly goal",
    today: "now",
    performance: "Performance",
    longest: "Longest run",
    allTime: "All time",
    totalRuns: "Runs",
    distance: "Distance",
    time: "Time",
    elevation: "Elevation gain",
    streakGoal: (weeks: number) => `Goal met ${weeks} weeks in a row`,
    streakActive: (weeks: number) => `${weeks} weeks in a row`,
    predicted: (race: string) => `${race}, predicted`,
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

/** One all-time figure, in a tile of its own. */
function Total({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalValue} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.totalUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
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
  const titles = useStrings(performanceTitles);
  const page = useRef<ScrollView>(null);
  useScrollToTop(page);
  const [runs, setRuns] = useState<Run[] | null>(null);
  /** When they were read: the moment every "recent" on this page counts back from. */
  const [readAt, setReadAt] = useState(0);
  const [records, setRecords] = useState<PersonalRecords | null>(null);
  /** Fastest time over each classic distance, across every run. */
  const [efforts, setEfforts] = useState<EffortRecord[]>([]);
  /** Their own recent average, to open the goal sheet on something familiar. */
  const [suggestedM, setSuggestedM] = useState(5000);
  const [settingGoal, setSettingGoal] = useState(false);
  const settings = useSettings();
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listRuns(), personalRecords(), effortRecords()])
        .then(([runs, best, fastest]) => {
          if (!active) return;
          setRuns(runs);
          setReadAt(Date.now());
          setRecords(best);
          setEfforts(fastest);
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
  if (!runs || !records) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.head}>
          <Text style={styles.title}>{s.title}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const weeks = byWeek(runs);
  const current = weeks[weeks.length - 1];
  const streak = weekStreak(runs, settings.weeklyGoalM, readAt);
  // Projected with the weekly volume the plans use, so a race time here and
  // the pace a programme hands out come from the same runner.
  const predictions = predictRaces(effortSamples(runs), readAt, weeklyVolumeKm(runs, readAt));
  const peak = Math.max(...weeks.map((w) => w.distanceM), 1);
  const goal = goalProgress(current.distanceM, settings.weeklyGoalM);

  // The headline of each list, and the way into the rest of it. The lists
  // themselves used to be stacked here, twenty rows under the week; the page
  // now says the one figure of each worth knowing and keeps the rest a tap
  // away.
  const open = (section: PerformanceSection) =>
    router.push({ pathname: "/performance/[section]", params: { section } });
  // The 5K and the 10K are the distances most runners know their time for,
  // so they are the ones worth leading with; failing that, the longest there is.
  const effort = efforts.find((held) => held.key === "5000") ?? efforts[efforts.length - 1] ?? null;
  const prediction = predictions.find((held) => held.goal === "tenK") ?? predictions[predictions.length - 1] ?? null;

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
          <View style={styles.headText}>
            <Text style={styles.title}>{s.title}</Text>
            {records.totalRuns > 0 ? (
              <Text style={styles.subtitle}>
                {s.summary(records.totalRuns, formatDistance(records.totalDistanceM))}
              </Text>
            ) : null}
          </View>
          {/* Settings are a page, not a section. Named, like every other
              action in a tab's corner, rather than a cog on its own. */}
          <HeaderButton icon="settings-outline" label={s.settings} onPress={() => router.push("/settings")} />
        </View>

        {records.totalRuns === 0 ? (
          <EmptyState
            actions={[
              {
                icon: "play",
                title: s.runNow,
                detail: s.runNowDetail,
                primary: true,
                onPress: () => {
                  chooseSession(null);
                  router.push("/record");
                },
              },
              {
                icon: "flag-outline",
                title: settings.weeklyGoalM === null
                  ? s.goalInvite
                  : s.goalCurrent(formatDistance(settings.weeklyGoalM)),
                detail: s.goalDetail,
                onPress: () => setSettingGoal(true),
              },
            ]}
          />
        ) : (
          <>
            {/* The week, on the same blue the history gives its month. The
                whole banner opens the weekly goal: the goal is what turns
                the figure into an answer, and the way in has to exist before
                the goal does. */}
            <SummaryBanner
              label={s.thisWeek}
              value={formatDistance(current.distanceM)}
              unit={distanceUnit()}
              detail={`${s.runs(current.runs)} · ${formatDuration(current.durationS)}`}
              onPress={() => setSettingGoal(true)}
              accessibilityLabel={goal ? s.goalEdit(formatDistance(settings.weeklyGoalM ?? 0)) : s.goalSet}
            >
              {goal ? (
                <View style={styles.goal}>
                  <View style={styles.goalBar}>
                    <View style={[styles.goalFill, { width: `${goal.share * 100}%` }]} />
                  </View>
                  <Text style={bannerText.soft}>
                    {goal.reached
                      ? s.goalReached(formatDistance(settings.weeklyGoalM ?? 0), goal.percent)
                      : s.goalRemaining(
                        formatDistance(goal.remainingM),
                        formatDistance(settings.weeklyGoalM ?? 0),
                      )}
                  </Text>
                </View>
              ) : null}
              {/* A streak is said only once there is one: a single week in a
                  row is just a week. */}
              {streak.current >= 2 || !goal ? (
                <View style={styles.tags}>
                  {streak.current >= 2 ? (
                    <BannerTag>
                      <Ionicons name="flame-outline" size={15} color={colors.accentText} />
                      <Text style={bannerText.tag}>
                        {streak.kind === "goal" ? s.streakGoal(streak.current) : s.streakActive(streak.current)}
                      </Text>
                    </BannerTag>
                  ) : null}
                  {!goal ? (
                    <BannerTag>
                      <Ionicons name="flag-outline" size={15} color={colors.accentText} />
                      <Text style={bannerText.tag}>{s.goalInvite}</Text>
                    </BannerTag>
                  ) : null}
                </View>
              ) : null}
            </SummaryBanner>

            <SectionHeader title={s.progress} aside={s.lastWeeks(WEEKS_SHOWN)} />
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
                  <Text style={[styles.weekLabel, i === weeks.length - 1 && styles.weekLabelCurrent]}>
                    {i === weeks.length - 1 ? s.today : `-${weeks.length - 1 - i}`}
                  </Text>
                </View>
              ))}
            </View>

            <SectionHeader title={s.performance} />
            {records.longest ? (
              <RecordRow
                first
                icon="trophy-outline"
                label={titles.records}
                detail={s.longest}
                value={`${formatDistance(records.longest.distanceM)} ${distanceUnit()}`}
                onPress={() => open("records")}
              />
            ) : null}
            {effort ? (
              <RecordRow
                first={!records.longest}
                icon="stopwatch-outline"
                label={titles.efforts}
                detail={effortName(effort.key)}
                value={formatDuration(Math.round(effort.seconds))}
                onPress={() => open("efforts")}
              />
            ) : null}
            {prediction ? (
              <RecordRow
                first={!records.longest && !effort}
                icon="flag-outline"
                label={titles.predictions}
                detail={s.predicted(goalName(prediction.goal))}
                value={formatDuration(Math.round(prediction.timeS))}
                onPress={() => open("predictions")}
              />
            ) : null}

            <SectionHeader title={s.allTime} />
            <View style={styles.totals}>
              <Total label={s.totalRuns} value={String(records.totalRuns)} />
              <Total label={s.distance} value={formatDistance(records.totalDistanceM)} unit={distanceUnit()} />
              <Total label={s.time} value={formatDuration(records.totalDurationS)} />
              <Total label={s.elevation} value={formatElevation(records.totalElevationM)} unit={elevationUnit()} />
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
  headText: { flex: 1 },
  title: { color: colors.text, fontSize: 32, fontFamily: font.bold, letterSpacing: -0.6 },
  subtitle: { color: colors.subtle, fontFamily: font.regular, fontSize: 15, marginTop: 3 },

  goal: { gap: 5, marginTop: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", columnGap: 6 },
  goalBar: {
    height: 5, borderRadius: 2.5, overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  goalFill: { height: 5, borderRadius: 2.5, backgroundColor: colors.accentText },

  chart: {
    flexDirection: "row", alignItems: "flex-end", gap: 8, height: 110,
    paddingHorizontal: GUTTER, paddingTop: 4,
  },
  column: { flex: 1, alignItems: "center", gap: 6 },
  barArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6, backgroundColor: colors.accentSoft },
  barCurrent: { backgroundColor: colors.accent },
  weekLabel: { color: colors.subtle, fontFamily: font.regular, fontSize: 13, fontVariant: ["tabular-nums"] },
  weekLabelCurrent: { color: colors.accent, fontFamily: font.semibold },

  totals: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: GUTTER, paddingTop: 2 },
  total: {
    flexBasis: "47%", flexGrow: 1, gap: 2,
    padding: 14, borderRadius: 14, backgroundColor: colors.accentSoft,
  },
  totalValue: {
    color: colors.accent, fontSize: 26, fontFamily: font.bold,
    letterSpacing: -0.6, fontVariant: ["tabular-nums"],
  },
  totalUnit: { fontSize: 15, fontFamily: font.semibold, letterSpacing: 0 },
  totalLabel: { color: colors.muted, fontSize: 14, fontFamily: font.medium },
});
