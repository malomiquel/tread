import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlanSetup, type PlanDraft } from "@/components/PlanSetup";
import { SessionDetail } from "@/components/SessionDetail";
import {
  activePlan, createPlan, deletePlan, planDone, recentExertions, type StoredPlan,
} from "@/lib/db";
import { formatDuration, formatPace } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import {
  buildPlan, daysBetween, goalById, KIND_NAMES, nextSession, PHASE_NAMES, planProgress, schedule,
  easeFactor, startOfDay, type Done, type Exertion, type ScheduledSession,
} from "@/lib/plan";
import { colors, font } from "@/lib/theme";
import { chooseSession } from "@/lib/tracker";
import { eased, sessionMinutes } from "@/lib/workout";

/** Displayed, indexed by `Date.getDay`. */
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

const dayName = (at: number): string => `${DAYS[new Date(at).getDay()]} ${new Date(at).getDate()}`;
const dateName = (at: number): string =>
  `${new Date(at).getDate()} ${MONTHS[new Date(at).getMonth()]}`;

const ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  easy: "walk",
  long: "trail-sign",
  interval: "flash",
  tempo: "speedometer",
  race: "flag",
};

function SessionRow({
  entry, today, onStart,
}: {
  entry: ScheduledSession;
  today: number;
  onStart: (entry: ScheduledSession) => void;
}) {
  const done = entry.runId !== null;
  const isToday = entry.at === today;
  const minutes = sessionMinutes(entry.session);

  return (
    <Pressable
      onPress={() => !done && onStart(entry)}
      disabled={done}
      accessibilityRole="button"
      accessibilityLabel={`${entry.session.name}, ${dayName(entry.at)}`}
      style={({ pressed }) => [styles.row, isToday && styles.rowToday, pressed && styles.pressed]}
    >
      <View style={[styles.mark, (done || entry.kind === "race") && styles.markFilled]}>
        <Ionicons
          name={done ? "checkmark" : ICONS[entry.kind]}
          size={15}
          color={done || entry.kind === "race" ? colors.accentText : colors.accent}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, done && styles.rowDone]} numberOfLines={1}>
          {entry.session.name}
        </Text>
        <Text style={styles.rowDetail}>
          {KIND_NAMES[entry.kind]} · {minutes} min · {formatPace(entry.targetSKm)}
        </Text>
      </View>
      <Text style={[styles.rowDay, isToday && styles.rowDayToday]}>
        {isToday ? "aujourd'hui" : dayName(entry.at)}
      </Text>
    </Pressable>
  );
}

export default function PlanScreen() {
  /**
   * Tapping the section you are already in walks back to the top.
   *
   * The navigator emits a press even when the tab is already the one showing,
   * and this hook is what listens for it. Without it that tap does nothing at
   * all, which reads as the app having missed the finger rather than as
   * having nothing to do.
   */
  const page = useRef<ScrollView>(null);
  useScrollToTop(page);
  const [plan, setPlan] = useState<StoredPlan | null | undefined>(undefined);
  const [done, setDone] = useState<Map<number, Done>>(new Map());
  /** Read on arrival, never during a render. A day is not a pure value. */
  const [today, setToday] = useState(0);
  /** The session being looked at, before deciding to run it. */
  const [viewing, setViewing] = useState<ScheduledSession | null>(null);
  /** How the last few sessions felt, newest first. */
  const [recent, setRecent] = useState<Exertion[]>([]);
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();

  const load = useCallback(() => {
    let live = true;
    activePlan()
      .then(async (found) => {
        if (!live) return;
        // On every arrival, so a plan left open overnight moves on with the
        // calendar instead of still pointing at yesterday.
        setToday(startOfDay(Date.now()));
        setPlan(found);
        setDone(found ? await planDone(found.id) : new Map());
        setRecent(await recentExertions());
      })
      .catch(() => live && setPlan(null));
    return () => { live = false; };
  }, []);

  useFocusEffect(load);

  async function create(draft: PlanDraft) {
    const sessions = buildPlan(draft);
    if (!sessions.length) return;
    await createPlan({ ...draft, sessions });
    load();
  }

  function abandon() {
    Alert.alert(
      "Abandonner le programme ?",
      "Les courses déjà faites restent dans ton historique. Seul le programme disparaît.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Abandonner",
          style: "destructive",
          onPress: () => void deletePlan().then(load).catch(() => undefined),
        },
      ],
    );
  }

  /**
   * Hand the session to the tracker whole, with its place in the programme.
   *
   * Whole because a plan's sessions are generated — six repetitions in week
   * three and eight in week nine — so there is no name in the catalogue to
   * pass instead. Its order travels with it so that finishing the run ticks
   * the right line off, and only once the run is safely written.
   */
  function startSession(entry: ScheduledSession) {
    setViewing(null);
    chooseSession(entry.session, entry.order);
    router.push("/record");
  }

  if (plan === undefined || today === 0) return <SafeAreaView style={styles.screen} edges={["top"]} />;

  if (plan === null) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Animated.View style={styles.fill} entering={FadeIn.duration(220)}>
          <PlanSetup onCreate={(draft) => void create(draft)} />
        </Animated.View>
      </SafeAreaView>
    );
  }

  const goal = goalById(plan.goal);
  const factor = easeFactor(recent);
  // Applied on the way out, never written back. The stored plan stays the
  // intention it was; what changes is what is asked of you this week, which
  // is the same reasoning that keeps the dates out of the database.
  //
  // A race is never eased. Nothing done is either: it is already behind you.
  const scheduled = schedule(plan.sessions, done, today, plan.raceAt, plan.days).map((entry) =>
    factor < 1 && entry.runId === null && entry.kind !== "race"
      ? { ...entry, session: eased(entry.session, factor) }
      : entry);
  const next = nextSession(scheduled);
  const progress = planProgress(plan.sessions, done.size);
  const daysLeft = daysBetween(today, plan.raceAt);

  // Grouped by the week a session belongs to in the programme, not by the
  // calendar week it landed in: what a runner is doing is week nine of a plan,
  // whatever the sliding has done to the dates.
  const weeks = [...new Set(scheduled.map((s) => s.week))].sort((a, b) => a - b);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Animated.View style={styles.fill} entering={FadeIn.duration(220)}>
        <ScrollView ref={page} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{goal?.name ?? "Programme"}</Text>
            {/* The reasoning behind the plan, one tap from the plan itself.
                Someone told what to run for three months is owed the why —
                including which parts of it are only my judgement. */}
            <Pressable
              onPress={() => router.push("/plan-method")}
              accessibilityRole="button"
              accessibilityLabel="Comment ce programme est construit"
              hitSlop={10}
              style={({ pressed }) => [styles.method, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={23} color={colors.subtle} />
            </Pressable>
          </View>
          <Text style={styles.lede}>
            {dateName(plan.raceAt)} · {daysLeft > 0 ? `dans ${daysLeft} jours` : "c'est aujourd'hui"}
            {" · "}
            {formatDuration(plan.targetTimeS)} visé
          </Text>

          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.caption}>
            {done.size} séance{done.size > 1 ? "s" : ""} sur {plan.sessions.length}
          </Text>

          {factor < 1 ? (
            <Text style={styles.eased}>
              {`Tes deux dernières séances t'ont paru dures, donc le programme en retire ${Math.round((1 - factor) * 100)} %. Il reprendra son cours dès qu'une séance te semblera plus facile.`}
            </Text>
          ) : null}

          {next ? (
            <Pressable
              onPress={() => setViewing(next)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.next, pressed && styles.pressed]}
            >
              <View style={styles.nextBody}>
                <Text style={styles.nextLabel}>
                  {next.at <= today ? "À faire maintenant" : `Prochaine · ${dayName(next.at)}`}
                </Text>
                <Text style={styles.nextName}>{next.session.name}</Text>
                <Text style={styles.nextDetail}>
                  {KIND_NAMES[next.kind]} · {formatPace(next.targetSKm)} · semaine {next.week}
                </Text>
              </View>
              <Ionicons name="play" size={20} color={colors.accentText} />
            </Pressable>
          ) : (
            <Text style={styles.finished}>
              {"Le programme est terminé. Il ne reste plus qu'à courir."}
            </Text>
          )}

          {weeks.map((week) => {
            const entries = scheduled.filter((s) => s.week === week);
            return (
              <View key={week} style={styles.week}>
                <Text style={styles.weekTitle}>
                  Semaine {week} · {PHASE_NAMES[entries[0].phase]}
                </Text>
                {entries.map((entry) => (
                  <SessionRow key={entry.order} entry={entry} today={today} onStart={setViewing} />
                ))}
              </View>
            );
          })}

          {/* Seeing what a session is made of before committing to it. The
              extra tap is nothing next to the forty minutes it precedes, and
              it means nobody starts a session blind. */}
          <SessionDetail
            visible={viewing !== null}
            session={viewing?.session ?? null}
            targetSKm={viewing?.targetSKm ?? null}
            onStart={() => viewing && startSession(viewing)}
            onClose={() => setViewing(null)}
          />

          <Pressable onPress={abandon} accessibilityRole="button" style={styles.abandon}>
            <Text style={styles.abandonLabel}>Abandonner le programme</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: {},
  head: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: GUTTER, paddingTop: 10,
  },
  title: {
    flex: 1, color: colors.text, fontSize: 32, fontFamily: font.bold, letterSpacing: -0.6,
  },
  method: { padding: 4 },
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15,
    paddingHorizontal: GUTTER, marginTop: 2,
  },

  bar: {
    height: 4, borderRadius: 2, backgroundColor: colors.accentSoft,
    marginHorizontal: GUTTER, marginTop: 16, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
  caption: {
    color: colors.subtle, fontSize: 13, fontFamily: font.regular,
    paddingHorizontal: GUTTER, marginTop: 6,
  },

  eased: {
    color: colors.warning, fontFamily: font.regular, fontSize: 13.5,
    lineHeight: 19, paddingHorizontal: GUTTER, paddingTop: 10,
  },
  next: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: GUTTER, marginTop: 18,
    backgroundColor: colors.accent, borderRadius: 12, padding: 16,
  },
  nextBody: { flex: 1, gap: 1 },
  nextLabel: {
    color: colors.accentText, opacity: 0.75, fontSize: 12,
    fontFamily: font.semibold, letterSpacing: 1.2, textTransform: "uppercase",
  },
  nextName: { color: colors.accentText, fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3 },
  nextDetail: { color: colors.accentText, opacity: 0.8, fontSize: 13.5, fontFamily: font.regular },
  finished: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15.5,
    paddingHorizontal: GUTTER, marginTop: 20, lineHeight: 22,
  },

  week: {
    marginTop: 22, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  weekTitle: {
    color: colors.subtle, fontSize: 13, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
    paddingHorizontal: GUTTER, marginBottom: 4,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: GUTTER, paddingVertical: 10,
  },
  rowToday: { backgroundColor: colors.sunken },
  mark: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  markFilled: { backgroundColor: colors.accent },
  rowBody: { flex: 1, gap: 1 },
  rowName: { color: colors.text, fontSize: 16.5, fontFamily: font.semibold },
  rowDone: { color: colors.subtle, textDecorationLine: "line-through" },
  rowDetail: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  rowDay: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  rowDayToday: { color: colors.accent, fontFamily: font.semibold },

  abandon: { alignItems: "center", paddingVertical: 24 },
  abandonLabel: { color: colors.danger, fontSize: 14.5, fontFamily: font.semibold },
  pressed: { opacity: 0.85 },
});
