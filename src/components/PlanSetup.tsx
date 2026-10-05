import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useScrollToTop } from "expo-router";
import { Button } from "@/components/Button";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { ofSport } from "@/lib/activity";
import { listRuns, personalRecords } from "@/lib/db";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { HoldButton } from "@/components/HoldButton";
import { defineStrings, intlLocale, plural, useStrings } from "@/lib/i18n";
import { useTabBarSpace } from "@/lib/layout";
import {
  buildPlan, clampWeeks, daysBetween, equivalentTimeS, goalName, GOALS, pacesFrom, projectedTimeS,
  isNovice, longCeilingMin, longestReachedMin, longestRunMin, SLOT_DAYS, startOfDay,
  type Goal, type GoalSpec, type PerWeek,
} from "@/lib/plan";
import {
  startingLongestMin, startingVolumeKm, suggestedRace, type RunnerProfile,
} from "@/lib/runner";
import { weeklyVolumeKm } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import { distanceUnit, paceUnit } from "@/lib/units";

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

const DAY_MS = 86_400_000;

/**
 * Displayed. Monday first, because that is where a training week starts.
 *
 * The labels and the `Date.getDay` numbers are kept side by side rather than
 * derived from each other: the week the calendar counts in starts on Sunday,
 * the week a runner lives in starts on Monday, and writing the mapping out
 * once is cheaper than converting between them at every use.
 */
const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0];

const planSetupStrings = defineStrings({
  fr: {
    weekdays: ["L", "M", "M", "J", "V", "S", "D"],
    cancel: "Annuler",
    leaveTitle: "Abandonner ce programme ?",
    leaveBody: "Les réponses déjà données seront perdues.",
    keepGoing: "Continuer",
    leave: "Abandonner",
    createFailedTitle: "Programme non créé",
    createFailedBody: "Tes réponses sont gardées. Réessaie dans un instant.",
    dateHint: (min: number, max: number) =>
      `Entre ${min} et ${max} semaines d'ici. En deçà, il n'y a pas le temps de construire quoi que ce soit.`,
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    perWeekDetails: {
      1: "la sortie longue",
      2: "le minimum qui prépare",
      3: "confortable",
      4: "si tu cours déjà beaucoup",
    } as Record<PerWeek, string>,
    whichDays: "Quels jours",
    daysReady: "Les séances tomberont sur ces jours, et les rattrapages entre eux.",
    daysMissing: (needed: number, picked: number) =>
      `Il en faut ${needed} — ${picked} ${picked > 1 ? "choisis" : "choisi"}.`,
    longest: "Ta plus longue sortie",
    longestUnknown: "Aujourd'hui, pas ce que tu voudrais faire. Toute la progression part de là.",
    longestKnown: "Reprise de ta plus longue course. Ajuste si elle ne te ressemble plus.",
    shorterRun: "Sortie plus courte",
    longerRun: "Sortie plus longue",
    today: "aujourd'hui",
    never: "Jamais couru",
    reached: (duration: string) => `le programme t'amènera à ${duration}`,
    novice: "Le programme commence en alternant course et marche, une minute de course au départ, jusqu'à courir 20 minutes sans t'arrêter. Pas de fractionné : à ton aise, sans allure imposée.",
    tooShort: (goal: string) =>
      `C'est en dessous de ce que ${goal} demande vraiment. Le programme t'y amènera aussi loin qu'il est raisonnable — plus vite serait une blessure écrite d'avance — mais vise une date plus lointaine si tu peux.`,
    volume: "Ton volume actuel",
    volumeMeasured: "Mesuré sur tes huit dernières semaines, semaines sans course comprises.",
    volumeUnknown: "Deux coureurs au même chrono sur 10 km n'ont pas le même marathon : celui qui court beaucoup perd moins sur la distance. Sans données, Tread part de l'hypothèse la plus prudente.",
    lessVolume: "Moins de volume",
    moreVolume: "Plus de volume",
    perWeekUnit: "par semaine",
    targetTime: "Temps visé",
    targetProjected: "Projeté depuis ta meilleure course. C'est lui qui fixe toutes les allures du programme.",
    targetUnknown: "Aucune course assez longue dans ton historique pour projeter. Pars de là et ajuste.",
    shorterTime: "Temps plus court",
    longerTime: "Temps plus long",
    perKm: (pace: string) => `${pace} ${paceUnit()}`,
    easy: "Footing",
    long: "Sortie longue",
    threshold: "Seuil",
    intervals: "Fractionné",
    pickDate: "Choisis une date",
    pickDays: (count: number) => `Choisis ${plural(count, "jour", "jours")}`,
    back: "Retour",
    next: "Continuer",
    backToRecap: "Valider",
    raceQuestion: "Quelle course prépares-tu ?",
    raceLede: "Le programme se construit à l'envers, depuis le jour J.",
    raceWeeks: (min: number, max: number) => `${min} à ${max} semaines de préparation`,
    dateQuestion: "Quand est-ce ?",
    dateChosen: (date: string, weeks: number) => `${date} · dans ${plural(weeks, "semaine", "semaines")}`,
    rhythmQuestion: "Combien de fois par semaine ?",
    rhythmLede: "Mieux vaut un rythme que tu tiendras qu'un rythme idéal.",
    fitnessQuestion: "Où en es-tu aujourd'hui ?",
    fitnessLede: "Aujourd'hui, pas ce que tu voudrais faire : toute la progression part de là.",
    targetQuestion: "Quel temps vises-tu ?",
    recapQuestion: "Ton programme",
    recapLede: "Vérifie avant de le créer. Touche une ligne pour la changer.",
    recapRace: "Course",
    recapDate: "Date",
    recapRhythm: "Rythme",
    recapRhythmValue: (count: number, days: string) => `${plural(count, "séance", "séances")} · ${days}`,
    recapLongest: "Sortie longue",
    recapLongestValue: (today: string, reached: string) => `${today} → ${reached}`,
    recapVolume: "Volume actuel",
    recapVolumeValue: (km: string) => `${km} ${distanceUnit()} par semaine`,
    recapTarget: "Temps visé",
    recapTargetValue: (time: string, pace: string) => `${time} · ${pace}`,
    recapPaces: "Tes allures",
    recapSize: (weeks: number, sessions: number) =>
      `${plural(weeks, "semaine", "semaines")} · ${plural(sessions, "séance", "séances")}, puis la course.`,
    createPlan: "Créer le programme",
  },
  en: {
    weekdays: ["M", "T", "W", "T", "F", "S", "S"],
    cancel: "Cancel",
    leaveTitle: "Leave this plan?",
    leaveBody: "The answers you've given will be lost.",
    keepGoing: "Keep going",
    leave: "Leave",
    createFailedTitle: "Plan not created",
    createFailedBody: "Your answers are kept. Try again in a moment.",
    dateHint: (min: number, max: number) =>
      `Between ${min} and ${max} weeks from now. Any sooner, and there is no time to build anything.`,
    previousMonth: "Previous month",
    nextMonth: "Next month",
    perWeekDetails: {
      1: "the long run",
      2: "the minimum that prepares you",
      3: "comfortable",
      4: "if you already run a lot",
    },
    whichDays: "Which days",
    daysReady: "Sessions will fall on these days, with catch-ups in between.",
    daysMissing: (needed: number, picked: number) => `You need ${needed} — ${picked} chosen.`,
    longest: "Your longest run",
    longestUnknown: "Today, not what you would like to do. Everything builds from there.",
    longestKnown: "Taken from your longest run. Adjust it if it no longer fits you.",
    shorterRun: "Shorter run",
    longerRun: "Longer run",
    today: "today",
    never: "Never run",
    reached: (duration: string) => `the plan will take you to ${duration}`,
    novice: "The plan starts by alternating running and walking, a minute of running at first, until you run 20 minutes without stopping. No intervals: by feel, with no pace to hold.",
    tooShort: (goal: string) =>
      `That is below what the ${goal.toLowerCase()} really asks for. The plan will take you as far as is reasonable — any faster would be an injury waiting to happen — but aim for a later date if you can.`,
    volume: "Your current volume",
    volumeMeasured: "Measured over your last eight weeks, weeks without a run included.",
    volumeUnknown: "Two runners with the same 10 km time do not run the same marathon: the one who runs more loses less over the distance. Without data, Tread starts from the most cautious assumption.",
    lessVolume: "Less volume",
    moreVolume: "More volume",
    perWeekUnit: "per week",
    targetTime: "Target time",
    targetProjected: "Projected from your best run. It sets every pace in the plan.",
    targetUnknown: "No run in your history is long enough to project from. Start here and adjust.",
    shorterTime: "Shorter time",
    longerTime: "Longer time",
    perKm: (pace: string) => `${pace} ${paceUnit()}`,
    easy: "Easy run",
    long: "Long run",
    threshold: "Threshold",
    intervals: "Intervals",
    pickDate: "Pick a date",
    pickDays: (count: number) => `Pick ${plural(count, "day", "days")}`,
    back: "Back",
    next: "Continue",
    backToRecap: "Done",
    raceQuestion: "Which race are you training for?",
    raceLede: "The plan is built backwards, from race day.",
    raceWeeks: (min: number, max: number) => `${min} to ${max} weeks of training`,
    dateQuestion: "When is it?",
    dateChosen: (date: string, weeks: number) => `${date} · in ${plural(weeks, "week", "weeks")}`,
    rhythmQuestion: "How many times a week?",
    rhythmLede: "A rhythm you will keep beats an ideal one.",
    fitnessQuestion: "Where are you today?",
    fitnessLede: "Today, not what you would like to do: everything builds from there.",
    targetQuestion: "What time are you aiming for?",
    recapQuestion: "Your plan",
    recapLede: "Check it before it is made. Tap a line to change it.",
    recapRace: "Race",
    recapDate: "Date",
    recapRhythm: "Rhythm",
    recapRhythmValue: (count: number, days: string) => `${plural(count, "session", "sessions")} · ${days}`,
    recapLongest: "Long run",
    recapLongestValue: (today: string, reached: string) => `${today} → ${reached}`,
    recapVolume: "Current volume",
    recapVolumeValue: (km: string) => `${km} ${distanceUnit()} a week`,
    recapTarget: "Target time",
    recapTargetValue: (time: string, pace: string) => `${time} · ${pace}`,
    recapPaces: "Your paces",
    recapSize: (weeks: number, sessions: number) =>
      `${plural(weeks, "week", "weeks")} · ${plural(sessions, "session", "sessions")}, then the race.`,
    createPlan: "Create the plan",
  },
});

/**
 * The questions, one to a page, then a recap before anything is made: the
 * welcome's shape, for the same reason — eight settings on one scrolling
 * page read as a form to get through, and nobody checked what they had
 * chosen before the plan was built from it.
 */
type SetupStep = "race" | "date" | "rhythm" | "fitness" | "target" | "recap";
const STEPS: readonly SetupStep[] = ["race", "date", "rhythm", "fitness", "target", "recap"];

const round5 = (minutes: number): number => Math.max(5, Math.round(minutes / 5) * 5);

/** "1 h 15", "45 min" — displayed. */
function durationName(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Where a weekday falls in a grid that starts on Monday. */
function mondayIndex(day: number): number {
  return (day + 6) % 7;
}

/**
 * A month of days, as rows of seven.
 *
 * Built rather than borrowed. A date picker is the one control here that
 * would have meant a native dependency, and every native dependency in this
 * project has cost a rebuild and a round of Expo Go breakage. A month grid is
 * sixty lines and owes nothing to anybody.
 */
function MonthGrid({
  month, chosen, earliest, latest, onPick,
}: {
  month: Date;
  chosen: number | null;
  earliest: number;
  latest: number;
  onPick: (at: number) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = mondayIndex(first.getDay());

  const s = useStrings(planSetupStrings);
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), i + 1).getTime()),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.weekdays}>
        {s.weekdays.map((letter, i) => (
          <Text key={`${letter}${i}`} style={styles.weekday}>{letter}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((at, i) => {
            if (at === null) return <View key={i} style={styles.day} />;
            // Too soon and there is no time to build anything; too far and the
            // plan would outlast the interest. Both are shown greyed rather
            // than hidden, so the reason a date is unavailable stays visible.
            const reachable = at >= earliest && at <= latest;
            const picked = chosen !== null && at === chosen;
            return (
              <Pressable
                key={i}
                onPress={() => reachable && onPick(at)}
                disabled={!reachable}
                accessibilityRole="button"
                accessibilityState={{ disabled: !reachable, selected: picked }}
                // The whole date: "14, button" says nothing about which month.
                accessibilityLabel={new Date(at).toLocaleDateString(intlLocale(), {
                  weekday: "long", day: "numeric", month: "long",
                })}
                style={[styles.day, picked && styles.dayPicked]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    !reachable && styles.dayOut,
                    picked && styles.dayPickedLabel,
                  ]}
                >
                  {new Date(at).getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** One answer to a question, as the welcome sets them: a card, ticked when chosen. */
function Option({ title, detail, on, onPress }: { title: string; detail: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && styles.pressed]}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, on && styles.optionTitleOn]}>{title}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
      {on ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
    </Pressable>
  );
}

export interface PlanDraft {
  goal: Goal;
  raceAt: number;
  weeks: number;
  perWeek: PerWeek;
  /** Weekdays to train on, as `Date.getDay` numbers. */
  days: number[];
  targetTimeS: number;
  /** The runner's longest run today, in minutes. */
  longestMin: number;
  /** Kilometres a week today. */
  weeklyKm: number;
}

/**
 * How much a tap moves the target time, by race.
 *
 * Five minutes over a half or a marathon, one below. A minute at a time is
 * thirty taps to cross half an hour of a marathon target, and the odd minute
 * means nothing at that distance anyway. Over five and ten kilometres it is
 * the other way round: a minute is already a large share of the result.
 */
function stepFor(goal: Goal): number {
  return goal === "half" || goal === "marathon" ? 300 : 60;
}

export function PlanSetup({
  onCreate, onCancel, profile = null,
}: {
  /** Resolves once the plan is saved, and rejects when it could not be. */
  onCreate: (draft: PlanDraft) => Promise<void>;
  /** The way back out, for somebody who opened the form to see what it asks. */
  onCancel?: () => void;
  /**
   * What the runner said in the welcome. It picks the distance and the
   * rhythm to start from, and stands in for a history that does not exist
   * yet — real runs, once there are any, always win.
   */
  profile?: RunnerProfile | null;
}) {
  const s = useStrings(planSetupStrings);
  const [step, setStep] = useState<SetupStep>("race");
  /** While the plan is being written: a second tap would make a second plan. */
  const [creating, setCreating] = useState(false);

  /**
   * Leave the form, asking first once there is something to lose: five
   * pages of answers are not worth a tap that missed.
   */
  const cancel = () => {
    if (!onCancel) return;
    if (STEPS.indexOf(step) === 0) {
      onCancel();
      return;
    }
    const text = planSetupStrings();
    Alert.alert(text.leaveTitle, text.leaveBody, [
      { text: text.keepGoing, style: "cancel" },
      { text: text.leave, style: "destructive", onPress: onCancel },
    ]);
  };
  /**
   * The recap has been seen: from then on a page is opened to change one
   * answer, and leads straight back to it rather than through every page
   * after it.
   */
  const [reviewing, setReviewing] = useState(false);
  const [goalId, setGoalId] = useState<Goal>(() => (profile ? suggestedRace(profile) : "half"));
  const [raceAt, setRaceAt] = useState<number | null>(null);
  const [perWeek, setPerWeek] = useState<PerWeek>(() => profile?.perWeek ?? 2);
  const [days, setDays] = useState<number[]>(() => SLOT_DAYS[profile?.perWeek ?? 2]);
  /** Set only once the runner moves the figure; null leaves the suggestion. */
  const [override, setOverride] = useState<number | null>(null);
  const [month, setMonth] = useState(() => new Date());
  /** The run the time was first guessed from, for the line explaining it. */
  const [reference, setReference] = useState<{ distanceM: number; durationS: number } | null>(null);
  /** Minutes of the longest run, once history has answered or the runner has. */
  const [longestMin, setLongestMin] = useState<number | null>(null);
  /** Kilometres a week as actually recorded, when there are runs to measure. */
  const [measuredKm, setMeasuredKm] = useState<number | null>(null);
  /** What the runner says instead, which always wins. */
  const [declaredKm, setDeclaredKm] = useState<number | null>(null);
  /** Refreshed after mount; never read from the clock during a render. */
  const [today, setToday] = useState(BOOT_DAY);
  // The bar floats over the screen rather than pushing it up, so the last
  // control has to leave room for it or it is simply unreachable.
  const tabBarSpace = useTabBarSpace();
  // The setup is a long page too, and the plan tab has to answer a second tap
  // here the same way it does once a programme exists.
  const page = useRef<ScrollView>(null);
  useScrollToTop(page);

  const goal = useMemo(() => GOALS.find((g) => g.id === goalId)!, [goalId]);
  const stepS = stepFor(goalId);

  useEffect(() => {
    const first = setTimeout(() => setToday(startOfDay(Date.now())), 0);
    return () => clearTimeout(first);
  }, []);

  // The best real performance on record, which is what makes the first
  // suggested time a projection rather than a number out of the air.
  // Measured over eight weeks, zeros included: the figure describes a habit,
  // not a best effort.
  useEffect(() => {
    let live = true;
    listRuns()
      .then((runs) => {
        if (!live) return;
        const volume = weeklyVolumeKm(ofSport(runs));
        if (volume !== null) setMeasuredKm(Math.max(5, Math.round(volume / 5) * 5));
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    personalRecords()
      .then((records) => {
        if (!live) return;
        const best = records.bestAvgPace;
        if (best && best.distanceM >= 2000) {
          setReference({ distanceM: best.distanceM, durationS: best.durationS });
        }
        // Where the long run starts from. Only a suggestion, and left alone
        // once the runner has touched it.
        const longest = records.longest;
        if (longest) setLongestMin((current) => current ?? round5(longest.durationS / 60));
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  // Derived rather than stored. Moving from a ten to a marathon must not
  // leave the ten's time behind, and an effect chasing that would be a second
  // source of truth for one number.
  // No history to measure means the cautious end, not the middle. An
  // optimistic guess here becomes three months of paces nobody can hold.
  const weeklyKm = declaredKm ?? measuredKm ?? (profile ? startingVolumeKm(profile) : 20);

  const suggested = useMemo(() => {
    const projected = reference
      ? equivalentTimeS(reference.distanceM, reference.durationS, goal.distanceM, weeklyKm)
      : null;
    // Snapped to the same grid the buttons move on, so the first tap never
    // has to first tidy up an odd number before it can change anything.
    return Math.round((projected ?? goal.defaultTimeS) / stepS) * stepS;
  }, [goal, reference, stepS, weeklyKm]);
  const targetTimeS = override ?? suggested;

  const earliest = today + goal.minWeeks * 7 * DAY_MS;
  const latest = today + goal.maxWeeks * 7 * DAY_MS;
  // A date picked for one distance may be out of reach for another, since a
  // marathon needs twelve weeks where a ten needs six. Ignored rather than
  // cleared, so that switching distance and back does not lose the choice.
  const chosen = raceAt !== null && raceAt >= earliest && raceAt <= latest ? raceAt : null;

  // Thirty minutes for someone with no history: enough to be a run, short
  // enough that nobody is handed an hour they have never done.
  const longest = longestMin ?? (profile ? startingLongestMin(profile) : 30);
  const weeks = chosen === null ? null : clampWeeks(goal, daysBetween(today, chosen) / 7);
  const novice = isNovice(longest);
  const paces = pacesFrom(goal.distanceM, targetTimeS, weeklyKm);
  const plan = weeks !== null && paces !== null
    ? buildPlan({ goal: goalId, weeks, perWeek, targetTimeS, longestMin: longest, weeklyKm })
    : null;
  // A beginner's plan climbs a ladder before it grows a long run, so what it
  // reaches is read off the plan itself rather than off the growth rule.
  const reached = weeks === null
    ? null
    : novice
      ? plan === null ? null : longestRunMin(plan)
      : longestReachedMin(goalId, weeks, goal.taperWeeks, longest, targetTimeS / 60);
  const ready = chosen !== null && weeks !== null && paces !== null && days.length === perWeek;
  const sessions = ready && plan !== null ? plan.length : 0;


  const stepIndex = STEPS.indexOf(step);
  const go = (to: SetupStep) => {
    if (to === "recap") setReviewing(true);
    // The calendar opens on the first month with a date to pick: a marathon
    // is at least twelve weeks out, and opening on this month meant paging
    // past three months of greyed-out days to reach one.
    if (to === "date") {
      const first = new Date(chosen ?? earliest);
      setMonth(new Date(first.getFullYear(), first.getMonth(), 1));
    }
    setStep(to);
    page.current?.scrollTo({ y: 0, animated: false });
  };
  const forward = reviewing ? "recap" : STEPS[stepIndex + 1];
  // Each question is answered before the next: a date for the date, the
  // right number of days for the rhythm. Everything else has a sensible
  // answer already filled in.
  const answered = step === "date" ? chosen !== null : step === "rhythm" ? days.length === perWeek : true;
  const dayLetters = WEEKDAY_NUMBERS
    .map((number, i) => (days.includes(number) ? s.weekdays[i] : null))
    .filter(Boolean)
    .join(" ");
  const racePace = paces ? s.perKm(formatPace(projectedTimeS(goal, paces) / (goal.distanceM / 1000))) : "";
  const weeksAway = chosen === null ? null : Math.round(daysBetween(today, chosen) / 7);

  const stepper = (
    value: string, detail: string, less: () => void, more: () => void, lessLabel: string, moreLabel: string,
  ) => (
    <View style={styles.stepper}>
      <HoldButton label="−" accessibilityLabel={lessLabel} onStep={less} />
      <View style={styles.target}>
        <Text style={styles.targetValue}>{value}</Text>
        <Text style={styles.targetDetail}>{detail}</Text>
      </View>
      <HoldButton label="+" accessibilityLabel={moreLabel} onStep={more} />
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* A way back, where the questions stand, and a way out. */}
      <View style={styles.bar}>
        <Pressable
          onPress={() => (reviewing && step !== "recap"
            ? go("recap")
            : stepIndex > 0 ? go(STEPS[stepIndex - 1]) : cancel())}
          disabled={stepIndex === 0 && !onCancel}
          accessibilityRole="button"
          accessibilityLabel={stepIndex > 0 || reviewing ? s.back : s.cancel}
          hitSlop={10}
          style={({ pressed }) => [styles.barButton, pressed && styles.pressed]}
        >
          {stepIndex > 0 || onCancel ? <Ionicons name="chevron-back" size={24} color={colors.text} /> : null}
        </Pressable>
        <View style={styles.progress}>
          {STEPS.map((id, i) => (
            <View key={id} style={[styles.segment, i <= stepIndex && styles.segmentOn]} />
          ))}
        </View>
        {onCancel ? (
          <Pressable onPress={cancel} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.cancelLabel}>{s.cancel}</Text>
          </Pressable>
        ) : <View style={styles.barButton} />}
      </View>

      <ScrollView ref={page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === "race" ? (
          <>
            <Text style={styles.question}>{s.raceQuestion}</Text>
            <Text style={styles.lede}>{s.raceLede}</Text>
            <View style={styles.options}>
              {GOALS.map((spec: GoalSpec) => (
                <Option
                  key={spec.id}
                  title={goalName(spec.id)}
                  detail={s.raceWeeks(spec.minWeeks, spec.maxWeeks)}
                  on={spec.id === goalId}
                  onPress={() => { setGoalId(spec.id); setOverride(null); }}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === "date" ? (
          <>
            <Text style={styles.question}>{s.dateQuestion}</Text>
            <Text style={styles.lede}>{s.dateHint(goal.minWeeks, goal.maxWeeks)}</Text>
            <View style={styles.monthHead}>
              <Pressable
                onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                accessibilityRole="button"
                accessibilityLabel={s.previousMonth}
                hitSlop={10}
              >
                <Text style={styles.monthArrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthName}>
                {month.toLocaleDateString(intlLocale(), { month: "long" })} {month.getFullYear()}
              </Text>
              <Pressable
                onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                accessibilityRole="button"
                accessibilityLabel={s.nextMonth}
                hitSlop={10}
              >
                <Text style={styles.monthArrow}>›</Text>
              </Pressable>
            </View>
            <MonthGrid month={month} chosen={chosen} earliest={earliest} latest={latest} onPick={setRaceAt} />
            {/* Kept to one line's room either way, so the grid does not jump. */}
            <Text style={styles.chosenDate}>
              {chosen !== null && weeksAway !== null
                ? s.dateChosen(new Date(chosen).toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long" }), weeksAway)
                : " "}
            </Text>
          </>
        ) : null}

        {step === "rhythm" ? (
          <>
            <Text style={styles.question}>{s.rhythmQuestion}</Text>
            <Text style={styles.lede}>{s.rhythmLede}</Text>
            <View style={styles.options}>
              {([1, 2, 3, 4] as const).map((count) => (
                <Option
                  key={count}
                  title={String(count)}
                  detail={s.perWeekDetails[count]}
                  on={perWeek === count}
                  // Changing the rhythm re-proposes days that match it, rather
                  // than leaving a count that no longer adds up to fix by hand.
                  onPress={() => { setPerWeek(count); setDays(SLOT_DAYS[count]); }}
                />
              ))}
            </View>
            <Text style={styles.section}>{s.whichDays}</Text>
            <Text style={styles.hint}>
              {days.length === perWeek ? s.daysReady : s.daysMissing(perWeek, days.length)}
            </Text>
            <View style={styles.daysRow}>
              {WEEKDAY_NUMBERS.map((number, i) => {
                const on = days.includes(number);
                return (
                  <Pressable
                    key={number}
                    onPress={() =>
                      setDays((current) =>
                        current.includes(number)
                          ? current.filter((d) => d !== number)
                          : [...current, number].sort((a, b) => a - b))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    // "M" twice says nothing; the weekday in full does.
                    accessibilityLabel={new Date(2024, 0, 7 + number).toLocaleDateString(intlLocale(), { weekday: "long" })}
                    style={[styles.dayPick, on && styles.dayPickOn]}
                  >
                    <Text style={[styles.dayPickLabel, on && styles.dayPickLabelOn]}>{s.weekdays[i]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === "fitness" ? (
          <>
            <Text style={styles.question}>{s.fitnessQuestion}</Text>
            <Text style={styles.lede}>{s.fitnessLede}</Text>
            <Text style={styles.section}>{s.longest}</Text>
            <Text style={styles.hint}>{longestMin === null ? s.longestUnknown : s.longestKnown}</Text>
            {stepper(
              longest === 0 ? s.never : durationName(longest),
              reached === null ? s.today : s.reached(durationName(reached)),
              () => setLongestMin((current) => Math.max(0, (current ?? longest) - 5)),
              () => setLongestMin((current) => Math.min(240, (current ?? longest) + 5)),
              s.shorterRun, s.longerRun,
            )}
            {novice ? (
              <Text style={styles.hint}>{s.novice}</Text>
            ) : reached !== null && reached < longCeilingMin(goalId, targetTimeS / 60) * 0.7 ? (
              <Text style={styles.warn}>{s.tooShort(goalName(goalId))}</Text>
            ) : null}
            <Text style={styles.section}>{s.volume}</Text>
            <Text style={styles.hint}>
              {measuredKm !== null && declaredKm === null ? s.volumeMeasured : s.volumeUnknown}
            </Text>
            {stepper(
              `${formatDistance(weeklyKm * 1000)} ${distanceUnit()}`,
              s.perWeekUnit,
              () => setDeclaredKm((current) => Math.max(5, (current ?? weeklyKm) - 5)),
              () => setDeclaredKm((current) => Math.min(200, (current ?? weeklyKm) + 5)),
              s.lessVolume, s.moreVolume,
            )}
          </>
        ) : null}

        {step === "target" ? (
          <>
            <Text style={styles.question}>{s.targetQuestion}</Text>
            <Text style={styles.lede}>{reference ? s.targetProjected : s.targetUnknown}</Text>
            {stepper(
              formatDuration(targetTimeS),
              racePace,
              // Functional, because a hold fires faster than a render.
              () => setOverride((current) => Math.max(stepS, (current ?? suggested) - stepS)),
              () => setOverride((current) => (current ?? suggested) + stepS),
              s.shorterTime, s.longerTime,
            )}
            {paces ? (
              <View style={styles.paces}>
                {([
                  [s.easy, paces.easy],
                  [s.long, paces.long],
                  [s.threshold, paces.half],
                  [s.intervals, paces.interval],
                ] as const).map(([label, pace]) => (
                  <View key={label} style={styles.pace}>
                    <Text style={styles.paceLabel}>{label}</Text>
                    <Text style={styles.paceValue}>{formatPace(pace)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {step === "recap" && ready ? (
          <>
            <Text style={styles.question}>{s.recapQuestion}</Text>
            <Text style={styles.lede}>{s.recapLede}</Text>
            <View style={styles.recap}>
              <SettingsGroup>
                <SettingRow icon="flag-outline" label={s.recapRace} value={goalName(goalId)} onPress={() => go("race")} />
                <SettingRow
                  icon="calendar-outline"
                  label={s.recapDate}
                  value={new Date(chosen).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" })}
                  onPress={() => go("date")}
                />
                <SettingRow
                  icon="repeat-outline"
                  label={s.recapRhythm}
                  value={s.recapRhythmValue(perWeek, dayLetters)}
                  onPress={() => go("rhythm")}
                />
                <SettingRow
                  icon="trail-sign-outline"
                  label={s.recapLongest}
                  value={s.recapLongestValue(
                    longest === 0 ? s.never : durationName(longest),
                    durationName(reached ?? longest),
                  )}
                  onPress={() => go("fitness")}
                />
                <SettingRow
                  icon="stats-chart-outline"
                  label={s.recapVolume}
                  value={s.recapVolumeValue(formatDistance(weeklyKm * 1000))}
                  onPress={() => go("fitness")}
                />
                <SettingRow
                  icon="stopwatch-outline"
                  label={s.recapTarget}
                  value={s.recapTargetValue(formatDuration(targetTimeS), racePace)}
                  onPress={() => go("target")}
                />
              </SettingsGroup>
            </View>
            {paces ? (
              <>
                <Text style={styles.section}>{s.recapPaces}</Text>
                <View style={[styles.paces, styles.pacesFlat]}>
                  {([
                    [s.easy, paces.easy],
                    [s.long, paces.long],
                    [s.threshold, paces.half],
                    [s.intervals, paces.interval],
                  ] as const).map(([label, pace]) => (
                    <View key={label} style={styles.pace}>
                      <Text style={styles.paceLabel}>{label}</Text>
                      <Text style={styles.paceValue}>{formatPace(pace)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.size}>{s.recapSize(weeks, sessions)}</Text>
          </>
        ) : null}
        {/* A date that the race changed under it: send them back to pick one. */}
        {step === "recap" && !ready ? (
          <>
            <Text style={styles.question}>{s.recapQuestion}</Text>
            <Text style={styles.lede}>{s.dateHint(goal.minWeeks, goal.maxWeeks)}</Text>
            <View style={styles.recap}>
              <SettingsGroup>
                <SettingRow icon="calendar-outline" label={s.recapDate} value={s.pickDate} onPress={() => go("date")} />
              </SettingsGroup>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Above the tab bar, which floats over this screen. */}
      <View style={[styles.footer, { paddingBottom: tabBarSpace }]}>
        {step === "recap" ? (
          <Button
            label={s.createPlan}
            disabled={!ready || creating}
            onPress={() => {
              if (!ready || creating) return;
              setCreating(true);
              onCreate({
                goal: goalId, raceAt: chosen, weeks, perWeek, days, targetTimeS,
                longestMin: longest, weeklyKm,
              })
                .catch(() => {
                  const text = planSetupStrings();
                  Alert.alert(text.createFailedTitle, text.createFailedBody);
                })
                .finally(() => setCreating(false));
            }}
          />
        ) : (
          <Button
            label={answered
              ? reviewing ? s.backToRecap : s.next
              : step === "date" ? s.pickDate : s.pickDays(perWeek)}
            disabled={!answered}
            onPress={() => go(forward)}
          />
        )}
      </View>
    </View>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 30 },
  bar: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: GUTTER - 6, paddingTop: 10, paddingBottom: 4,
  },
  barButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.accentSoft },
  segmentOn: { backgroundColor: colors.accent },
  question: {
    color: colors.text, fontSize: 30, fontFamily: font.bold, letterSpacing: -0.6, lineHeight: 34,
  },
  options: { gap: 10, marginTop: 18 },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { color: colors.text, fontSize: 17, fontFamily: font.semibold },
  optionTitleOn: { color: colors.accent },
  optionDetail: { color: colors.muted, fontSize: 14, fontFamily: font.regular, lineHeight: 19 },
  chosenDate: {
    color: colors.accent, fontSize: 15.5, fontFamily: font.semibold, textAlign: "center", marginTop: 12,
  },
  recap: { marginHorizontal: -16, marginTop: -8 },
  pacesFlat: { marginTop: 0, borderTopWidth: 0, paddingTop: 0 },
  size: { color: colors.muted, fontSize: 15, fontFamily: font.regular, marginTop: 18, textAlign: "center" },
  footer: { paddingHorizontal: GUTTER, paddingTop: 8 },
  cancelLabel: { color: colors.accent, fontSize: 16.5, fontFamily: font.semibold },
  lede: { color: colors.muted, fontFamily: font.regular, fontSize: 15.5, lineHeight: 22, marginTop: 4 },
  section: {
    color: colors.subtle, fontSize: 13, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase", marginTop: 26, marginBottom: 8,
  },
  hint: { color: colors.subtle, fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, marginBottom: 10 },


  monthHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6,
  },
  monthName: { color: colors.text, fontSize: 17, fontFamily: font.semibold },
  monthArrow: { color: colors.accent, fontSize: 28, fontFamily: font.semibold, paddingHorizontal: 10 },
  weekdays: { flexDirection: "row", paddingBottom: 4 },
  weekday: {
    flex: 1, textAlign: "center", color: colors.subtle,
    fontSize: 12, fontFamily: font.semibold,
  },
  week: { flexDirection: "row" },
  day: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayPicked: { backgroundColor: colors.accent },
  dayLabel: { color: colors.text, fontSize: 15, fontFamily: font.regular, fontVariant: ["tabular-nums"] },
  dayOut: { color: colors.subtle, opacity: 0.35 },
  dayPickedLabel: { color: colors.accentText, fontFamily: font.semibold },

  daysRow: { flexDirection: "row", gap: 6 },
  dayPick: {
    flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  dayPickOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayPickLabel: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  dayPickLabelOn: { color: colors.accentText },

  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  target: { flex: 1, alignItems: "center" },
  targetValue: {
    color: colors.text, fontSize: 34, fontFamily: font.bold,
    letterSpacing: -0.5, fontVariant: ["tabular-nums"],
  },
  targetDetail: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular },

  warn: {
    color: colors.warning, fontFamily: font.regular, fontSize: 13.5,
    lineHeight: 19, marginTop: 10,
  },
  paces: {
    flexDirection: "row", flexWrap: "wrap", marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, paddingTop: 12,
  },
  pace: { width: "50%", paddingVertical: 5 },
  paceLabel: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  paceValue: { color: colors.text, fontSize: 17, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },

  pressed: { opacity: 0.85 },
});
