import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlanSetup, type PlanDraft } from "@/components/PlanSetup";
import { EmptyState } from "@/components/EmptyState";
import { SessionDetail } from "@/components/SessionDetail";
import {
  activePlan, createPlan, deletePlan, markPlanSessionDone, planDone, recentExertions,
  type StoredPlan,
} from "@/lib/db";
import { formatDuration, formatPace } from "@/lib/format";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { useTabBarSpace } from "@/lib/layout";
import { useKnownLocation } from "@/lib/location";
import {
  buildPlan, daysBetween, goalById, goalName, kindName, nextSession, phaseName, planProgress, ranCount,
  schedule,
  easeFactor, startOfDay, type Done, type Exertion, type ScheduledSession,
} from "@/lib/plan";
import { refreshReminders } from "@/lib/planReminders";
import { syncReminders } from "@/lib/reminders";
import { markRaceSetupOffered, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";
import { chooseSession } from "@/lib/tracker";
import {
  forecastBrief, forecastLine, forecastOn, useForecasts, weatherIcon, type Forecast,
} from "@/lib/weather";
import { eased, sessionMinutes, sessionName } from "@/lib/workout";

/** Displayed, indexed by `Date.getDay`. */
/**
 * Midnight of the day this module was loaded.
 *
 * Read once, at import, so that a screen has a usable day on its very first
 * frame. Asking the clock during a render is forbidden and asking it in an
 * effect costs a frame — a frame in which the screen had nothing to draw and
 * showed white. It is refreshed on every focus, so an app left open overnight
 * still moves on with the calendar.
 */
const BOOT_DAY = startOfDay(Date.now());

const planStrings = defineStrings({
  fr: {
    days: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    months: [
      "janv.", "févr.", "mars", "avr.", "mai", "juin",
      "juil.", "août", "sept.", "oct.", "nov.", "déc.",
    ],
    skippedLabel: (name: string) => `${name}, passée`,
    doneLabel: (name: string, day: string) => `${name}, faite le ${day}, voir la course`,
    skipped: "Passée",
    today: "aujourd'hui",
    title: "Plan",
    runNow: "Courir maintenant",
    runNowDetail: "Une sortie libre, avec une séance ou un parcours si tu veux.",
    prepareRace: "Préparer une course",
    prepareRaceDetail:
      "Du 5 km au marathon, des séances jusqu'au jour J.",
    startNote: "Avec ou sans programme, le bouton ▶ au centre de la barre lance une course à tout moment.",
    abandonTitle: "Abandonner le programme ?",
    abandonBody: "Les courses déjà faites restent dans ton historique. Seul le programme disparaît.",
    cancel: "Annuler",
    abandon: "Abandonner",
    programme: "Programme",
    method: "Comment ce programme est construit",
    raceLine: (date: string, daysLeft: number, target: string) =>
      `${date} · ${daysLeft > 0 ? `dans ${plural(daysLeft, "jour", "jours")}` : "c'est aujourd'hui"} · ${target} visé`,
    progress: (ran: number, total: number, skipped: number) =>
      `${plural(ran, "séance", "séances")} sur ${total}`
      + (skipped > 0 ? ` · ${plural(skipped, "passée", "passées")}` : ""),
    eased: (percent: number) =>
      `Tes deux dernières séances t'ont paru dures, donc le programme en retire ${percent} %. Il reprendra son cours dès qu'une séance te semblera plus facile.`,
    dueNow: "À faire maintenant",
    nextOn: (day: string) => `Prochaine · ${day}`,
    week: (week: number) => `semaine ${week}`,
    weekTitle: (week: number, phase: string) => `Semaine ${week} · ${phase}`,
    finished: "Le programme est terminé. Il ne reste plus qu'à courir.",
    abandonPlan: "Abandonner le programme",
  },
  en: {
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ],
    skippedLabel: (name: string) => `${name}, skipped`,
    doneLabel: (name: string, day: string) => `${name}, done on ${day}, view the run`,
    skipped: "Skipped",
    today: "today",
    title: "Plan",
    runNow: "Run now",
    runNowDetail: "A free run, with a session or a route if you like.",
    prepareRace: "Train for a race",
    prepareRaceDetail:
      "From 5K to marathon, sessions all the way to race day.",
    startNote: "With or without a plan, the ▶ button in the middle of the bar starts a run at any time.",
    abandonTitle: "Abandon the training plan?",
    abandonBody: "Runs you have already done stay in your history. Only the plan goes away.",
    cancel: "Cancel",
    abandon: "Abandon",
    programme: "Training plan",
    method: "How this plan is built",
    raceLine: (date: string, daysLeft: number, target: string) =>
      `${date} · ${daysLeft > 0 ? `in ${plural(daysLeft, "day", "days")}` : "it's today"} · aiming for ${target}`,
    progress: (ran: number, total: number, skipped: number) =>
      `${ran} of ${total} ${total === 1 ? "session" : "sessions"}`
      + (skipped > 0 ? ` · ${skipped} skipped` : ""),
    eased: (percent: number) =>
      `Your last two sessions felt hard, so the plan is taking off ${percent}%. It will return to normal as soon as a session feels easier.`,
    dueNow: "Due now",
    nextOn: (day: string) => `Next · ${day}`,
    week: (week: number) => `week ${week}`,
    weekTitle: (week: number, phase: string) => `Week ${week} · ${phase}`,
    finished: "The plan is complete. All that's left is to run.",
    abandonPlan: "Abandon the training plan",
  },
});

const dayName = (at: number): string =>
  `${planStrings().days[new Date(at).getDay()]} ${new Date(at).getDate()}`;
const dateName = (at: number): string =>
  `${new Date(at).getDate()} ${planStrings().months[new Date(at).getMonth()]}`;

const ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  easy: "walk",
  long: "trail-sign",
  interval: "flash",
  tempo: "speedometer",
  race: "flag",
};

/**
 * What the sky is expected to do, under the session it belongs to.
 *
 * Handed its forecast rather than going to get one: the whole fortnight
 * arrives in a single answer, read once at the top of the screen, so a
 * programme showing a dozen sessions costs exactly one request.
 */
function ForecastLine({ forecast }: { forecast: Forecast }) {
  return (
    <View style={styles.forecast}>
      <Ionicons name={weatherIcon(forecast.code, true)} size={14} color={colors.accentText} />
      <Text style={styles.forecastText} numberOfLines={1}>{forecastLine(forecast)}</Text>
    </View>
  );
}

function SessionRow({
  entry, today, forecast, onPress,
}: {
  entry: ScheduledSession;
  today: number;
  /** The day's outlook, or null for a day no model reaches. */
  forecast: Forecast | null;
  onPress: (entry: ScheduledSession) => void;
}) {
  const s = useStrings(planStrings);
  const name = sessionName(entry.session);
  const done = entry.settled;
  const skipped = entry.settled && entry.runId === null;
  const isToday = entry.at === today;
  const minutes = sessionMinutes(entry.session);

  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={
        skipped
          ? s.skippedLabel(name)
          : done
            ? s.doneLabel(name, dayName(entry.at))
            : `${name}, ${dayName(entry.at)}`
      }
      style={({ pressed }) => [styles.row, isToday && styles.rowToday, pressed && styles.pressed]}
    >
      <View style={[styles.mark, (done || entry.kind === "race") && styles.markFilled]}>
        <Ionicons
          name={skipped ? "remove" : done ? "checkmark" : ICONS[entry.kind]}
          size={15}
          color={done || entry.kind === "race" ? colors.accentText : colors.accent}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, done && styles.rowDone]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowDetail}>
          {skipped ? s.skipped : kindName(entry.kind)} · {minutes} min · {formatPace(entry.targetSKm)}
        </Text>
      </View>
      {/* The day and its weather in one column, because the weather belongs
          to the day rather than to the session: it is the same thing the
          right-hand side was already answering — when — said twice over.
          Only ahead of you. What the sky did on a session already run or
          already passed changes nothing anybody can act on. */}
      <View style={styles.rowWhen}>
        <Text style={[styles.rowDay, isToday && styles.rowDayToday]}>
          {isToday && !done ? s.today : dayName(entry.at)}
        </Text>
        {forecast && !entry.settled ? (
          <View style={styles.rowWeather}>
            <Ionicons name={weatherIcon(forecast.code, true)} size={12} color={colors.subtle} />
            <Text style={styles.rowWeatherText}>{forecastBrief(forecast)}</Text>
          </View>
        ) : null}
      </View>
      {/* A done session leads somewhere, so it says so. Without the chevron
          nothing suggests the line is still worth touching. */}
      {done && !skipped ? <Ionicons name="chevron-forward" size={15} color={colors.subtle} /> : null}
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
  const s = useStrings(planStrings);
  const page = useRef<ScrollView>(null);
  useScrollToTop(page);
  const [plan, setPlan] = useState<StoredPlan | null | undefined>(undefined);
  const [done, setDone] = useState<Map<number, Done>>(new Map());
  /** Refreshed on arrival; never read from the clock during a render. */
  const [today, setToday] = useState(BOOT_DAY);
  /** The session being looked at, before deciding to run it. */
  const [viewing, setViewing] = useState<ScheduledSession | null>(null);
  /** The programme form, opened from the page shown when there is none. */
  const [settingUp, setSettingUp] = useState(false);
  const settings = useSettings();
  /*
   * Somebody who said in the welcome that they came to prepare a race lands
   * on the programme form, already filled in from their answers — once.
   * Derived rather than stored in state, so it needs no effect to open.
   */
  const offeringRace = settings.runner?.goal === "race" && !settings.raceSetupOffered;
  const showingSetup = settingUp || offeringRace;

  function closeSetup() {
    setSettingUp(false);
    if (offeringRace) void markRaceSetupOffered();
  }
  /** How the last few sessions felt, newest first. */
  const [recent, setRecent] = useState<Exertion[]>([]);
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();
  // Asked once for the whole screen, and before anything is known about the
  // programme: a hook cannot be called after the early returns below, and the
  // forecast does not depend on there being a programme at all.
  const known = useKnownLocation();
  const forecasts = useForecasts(known);

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
        // What is pending on the lock screen is rebuilt from the programme
        // every time the programme is looked at, which is the cheapest place
        // to notice that a session has been run, skipped or slid a week.
        void refreshReminders();
      })
      .catch(() => live && setPlan(null));
    return () => { live = false; };
  }, []);

  useFocusEffect(load);

  async function create(draft: PlanDraft) {
    const sessions = buildPlan(draft);
    if (!sessions.length) return;
    await createPlan({ ...draft, sessions });
    closeSetup();
    load();
  }

  function abandon() {
    const text = planStrings();
    Alert.alert(
      text.abandonTitle,
      text.abandonBody,
      [
        { text: text.cancel, style: "cancel" },
        {
          text: text.abandon,
          style: "destructive",
          // The reminders go with it. A programme nobody is following any
          // more must not go on tapping them on the shoulder about it.
          onPress: () => void deletePlan()
            .then(() => syncReminders([]))
            .then(load)
            .catch(() => undefined),
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
  /**
   * A session leads to its run once it has one, and to its blocks until then.
   *
   * The same line answering two different questions, in the order they are
   * asked: what am I about to do, and then what did I actually do.
   */
  function open(entry: ScheduledSession) {
    if (entry.runId !== null && entry.runId > 0) {
      router.push({ pathname: "/run/[id]", params: { id: String(entry.runId) } });
      return;
    }
    setViewing(entry);
  }

  /**
   * Put a session behind you without running it.
   *
   * Reporting it indefinitely was the only option before: the programme
   * would offer it again every day until the calendar ran out of room for
   * it. That is right for a footing nobody fancied on a tuesday and wrong
   * for a session that does not suit — a hill workout with no hills,
   * repetitions on a sore tendon. It is recorded as passed rather than done,
   * so nothing later claims you ran it.
   */
  function skipSession(entry: ScheduledSession) {
    setViewing(null);
    void markPlanSessionDone(entry.order, null).then(load).catch(() => undefined);
  }

  function startSession(entry: ScheduledSession) {
    setViewing(null);
    chooseSession(entry.session, entry.order);
    router.push("/record");
  }

  // Something rather than nothing while the programme is read off disk. Which
  // of the two screens follows is not known yet, so the heading is the tab's
  // own name — true either way, and enough to stop the change of tab looking
  // like a failure.
  if (plan === undefined) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.head}>
          <Text style={styles.title}>{s.title}</Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * No programme: the two ways to begin, rather than the form.
   *
   * This tab is where the app opens, and the form is eight questions about a
   * race. Shown straight away, it told somebody who only wanted to go for a
   * run that the app would not let them until they had signed up for a
   * marathon.
   */
  if (plan === null && !showingSetup) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingBottom: tabBarSpace }}>
          <View style={[styles.head, styles.headEmpty]}>
            <Text style={styles.title}>{s.title}</Text>
          </View>
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
                title: s.prepareRace,
                detail: s.prepareRaceDetail,
                onPress: () => setSettingUp(true),
              },
            ]}
            note={s.startNote}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (plan === null) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* A plain view. The tab itself cross-fades this screen in, and a
          second opacity animation on top of that one was not a second effect
          but a second chance to fail: when the inner fade did not run to
          completion the screen stayed at zero, which is the white page that
          appeared on some tab changes and not others. */}
        <View style={styles.fill}>
          <PlanSetup
            onCreate={(draft) => void create(draft)}
            onCancel={closeSetup}
            profile={settings.runner}
          />
        </View>
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
  const nextForecast = next === null ? null : forecastOn(forecasts, next.at);
  const ran = ranCount(done);
  const progress = planProgress(plan.sessions, ran);
  const daysLeft = daysBetween(today, plan.raceAt);

  // Grouped by the week a session belongs to in the programme, not by the
  // calendar week it landed in: what a runner is doing is week nine of a plan,
  // whatever the sliding has done to the dates.
  const weeks = [...new Set(scheduled.map((entry) => entry.week))].sort((a, b) => a - b);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.fill}>
        <ScrollView ref={page} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{goal ? goalName(goal.id) : s.programme}</Text>
            {/* The reasoning behind the plan, one tap from the plan itself.
                Someone told what to run for three months is owed the why —
                including which parts of it are only my judgement. */}
            <Pressable
              onPress={() => router.push("/plan-method")}
              accessibilityRole="button"
              accessibilityLabel={s.method}
              hitSlop={10}
              style={({ pressed }) => [styles.method, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={23} color={colors.subtle} />
            </Pressable>
          </View>
          <Text style={styles.lede}>
            {s.raceLine(dateName(plan.raceAt), daysLeft, formatDuration(plan.targetTimeS))}
          </Text>

          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.caption}>
            {s.progress(ran, plan.sessions.length, done.size - ran)}
          </Text>

          {factor < 1 ? (
            <Text style={styles.eased}>
              {s.eased(Math.round((1 - factor) * 100))}
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
                  {next.at <= today ? s.dueNow : s.nextOn(dayName(next.at))}
                </Text>
                <Text style={styles.nextName}>{sessionName(next.session)}</Text>
                <Text style={styles.nextDetail}>
                  {kindName(next.kind)} · {formatPace(next.targetSKm)} · {s.week(next.week)}
                </Text>
                {nextForecast ? <ForecastLine forecast={nextForecast} /> : null}
              </View>
              <Ionicons name="play" size={20} color={colors.accentText} />
            </Pressable>
          ) : (
            <Text style={styles.finished}>
              {s.finished}
            </Text>
          )}

          {weeks.map((week) => {
            const entries = scheduled.filter((entry) => entry.week === week);
            return (
              <View key={week} style={styles.week}>
                <Text style={styles.weekTitle}>
                  {s.weekTitle(week, phaseName(entries[0].phase))}
                </Text>
                {entries.map((entry) => (
                  <SessionRow
                    key={entry.order}
                    entry={entry}
                    today={today}
                    forecast={forecastOn(forecasts, entry.at)}
                    onPress={open}
                  />
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
            onSkip={viewing && viewing.kind !== "race" ? () => skipSession(viewing) : undefined}
            onClose={() => setViewing(null)}
          />

          <Pressable onPress={abandon} accessibilityRole="button" style={styles.abandon}>
            <Text style={styles.abandonLabel}>{s.abandonPlan}</Text>
          </Pressable>
        </ScrollView>
      </View>
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

  // The same room under the heading as every other tab leaves above its
  // content, so an empty plan lines up with an empty history.
  headEmpty: { paddingBottom: 14 },
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
  // Set apart from the line above it, because it is the one thing in the card
  // that is not about the session itself.
  forecast: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  forecastText: {
    color: colors.accentText, opacity: 0.8, fontSize: 13.5,
    fontFamily: font.medium, flexShrink: 1,
  },
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
  rowWhen: { alignItems: "flex-end", gap: 2 },
  rowDay: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  rowWeather: { flexDirection: "row", alignItems: "center", gap: 3 },
  rowWeatherText: {
    color: colors.subtle, fontSize: 12, fontFamily: font.medium,
    fontVariant: ["tabular-nums"],
  },
  rowDayToday: { color: colors.accent, fontFamily: font.semibold },

  abandon: { alignItems: "center", paddingVertical: 24 },
  abandonLabel: { color: colors.danger, fontSize: 14.5, fontFamily: font.semibold },
  pressed: { opacity: 0.85 },
});
