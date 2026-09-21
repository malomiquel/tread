import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { personalRecords } from "@/lib/db";
import { formatDuration, formatPace } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import {
  buildPlan, clampWeeks, daysBetween, equivalentTimeS, GOALS, pacesFrom, projectedTimeS,
  startOfDay, type Goal, type GoalSpec, type PerWeek,
} from "@/lib/plan";
import { colors, font } from "@/lib/theme";

const DAY_MS = 86_400_000;

/** Displayed. Monday first, because that is where a training week starts. */
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

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

  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), i + 1).getTime()),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.weekdays}>
        {WEEKDAYS.map((letter, i) => (
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

function Choice({
  label, detail, on, onPress,
}: {
  label: string;
  detail?: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.choice, on && styles.choiceOn]}
    >
      <Text style={[styles.choiceLabel, on && styles.choiceLabelOn]}>{label}</Text>
      {detail ? (
        <Text style={[styles.choiceDetail, on && styles.choiceDetailOn]}>{detail}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * A stepper side that repeats while it is held.
 *
 * Reaching a target time thirty seconds at a time means forty taps to move
 * twenty minutes, which is how a control teaches someone to give up. Holding
 * covers the distance and tapping lands the second, so both gestures do the
 * thing they are naturally good at.
 *
 * The repeat starts slowly and quickens. A hold that accelerates immediately
 * overshoots every time, and the pause before the first repeat is also what
 * keeps a plain tap from being read as the beginning of a hold.
 */
function HoldButton({
  onStep, label, accessibilityLabel,
}: {
  onStep: () => void;
  label: string;
  accessibilityLabel: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticks = useRef(0);
  /** Read by the running chain, so a re-render never leaves it on stale state. */
  const step = useRef(onStep);
  step.current = onStep;

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    ticks.current = 0;
  }

  // A finger lifted outside the button, or a screen left mid-hold, would
  // otherwise leave the chain running against a component nobody can see.
  useEffect(() => stop, []);

  function tick() {
    ticks.current += 1;
    step.current();
    void Haptics.selectionAsync().catch(() => undefined);
    const delay = ticks.current < 6 ? 130 : ticks.current < 18 ? 70 : 40;
    timer.current = setTimeout(tick, delay);
  }

  return (
    <Pressable
      onPressIn={() => {
        step.current();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        timer.current = setTimeout(tick, 420);
      }}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
    >
      <Text style={styles.stepLabel}>{label}</Text>
    </Pressable>
  );
}

export interface PlanDraft {
  goal: Goal;
  raceAt: number;
  weeks: number;
  perWeek: PerWeek;
  targetTimeS: number;
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

export function PlanSetup({ onCreate }: { onCreate: (draft: PlanDraft) => void }) {
  const [goalId, setGoalId] = useState<Goal>("half");
  const [raceAt, setRaceAt] = useState<number | null>(null);
  const [perWeek, setPerWeek] = useState<PerWeek>(2);
  /** Set only once the runner moves the figure; null leaves the suggestion. */
  const [override, setOverride] = useState<number | null>(null);
  const [month, setMonth] = useState(() => new Date());
  /** The run the time was first guessed from, for the line explaining it. */
  const [reference, setReference] = useState<{ distanceM: number; durationS: number } | null>(null);
  /** Read after mount, never during a render: today is not a pure value. */
  const [today, setToday] = useState(0);
  // The bar floats over the screen rather than pushing it up, so the last
  // control has to leave room for it or it is simply unreachable.
  const tabBarSpace = useTabBarSpace();

  const goal = useMemo(() => GOALS.find((g) => g.id === goalId)!, [goalId]);
  const stepS = stepFor(goalId);

  useEffect(() => {
    const first = setTimeout(() => setToday(startOfDay(Date.now())), 0);
    return () => clearTimeout(first);
  }, []);

  // The best real performance on record, which is what makes the first
  // suggested time a projection rather than a number out of the air.
  useEffect(() => {
    let live = true;
    personalRecords()
      .then((records) => {
        const best = records.bestAvgPace;
        if (!live || !best || best.distanceM < 2000) return;
        setReference({ distanceM: best.distanceM, durationS: best.durationS });
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  // Derived rather than stored. Moving from a ten to a marathon must not
  // leave the ten's time behind, and an effect chasing that would be a second
  // source of truth for one number.
  const suggested = useMemo(() => {
    const projected = reference
      ? equivalentTimeS(reference.distanceM, reference.durationS, goal.distanceM)
      : null;
    // Snapped to the same grid the buttons move on, so the first tap never
    // has to first tidy up an odd number before it can change anything.
    return Math.round((projected ?? goal.defaultTimeS) / stepS) * stepS;
  }, [goal, reference, stepS]);
  const targetTimeS = override ?? suggested;

  const earliest = today + goal.minWeeks * 7 * DAY_MS;
  const latest = today + goal.maxWeeks * 7 * DAY_MS;
  // A date picked for one distance may be out of reach for another, since a
  // marathon needs twelve weeks where a ten needs six. Ignored rather than
  // cleared, so that switching distance and back does not lose the choice.
  const chosen = raceAt !== null && raceAt >= earliest && raceAt <= latest ? raceAt : null;

  const weeks = chosen === null ? null : clampWeeks(goal, daysBetween(today, chosen) / 7);
  const paces = pacesFrom(goal.distanceM, targetTimeS);
  const ready = chosen !== null && weeks !== null && paces !== null;
  const sessions = ready ? buildPlan({ goal: goalId, weeks, perWeek, targetTimeS }).length : 0;

  // One frame, before the clock has been read.
  if (today === 0) return <ScrollView contentContainerStyle={styles.content} />;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + 20 }]}>
      <Text style={styles.title}>Ton objectif</Text>
      <Text style={styles.lede}>
        {"Choisis une course et une date. Le programme se construit à l'envers, depuis le jour J."}
      </Text>

      <Text style={styles.section}>Distance</Text>
      <View style={styles.row}>
        {GOALS.map((spec: GoalSpec) => (
          <Choice
            key={spec.id}
            label={spec.name}
            on={spec.id === goalId}
            onPress={() => { setGoalId(spec.id); setOverride(null); }}
          />
        ))}
      </View>

      <Text style={styles.section}>Date de la course</Text>
      <Text style={styles.hint}>
        {`Entre ${goal.minWeeks} et ${goal.maxWeeks} semaines d'ici. En deçà, il n'y a pas le temps de construire quoi que ce soit.`}
      </Text>
      <View style={styles.monthHead}>
        <Pressable
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
          hitSlop={10}
        >
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthName}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          onPress={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
          hitSlop={10}
        >
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>
      <MonthGrid
        month={month}
        chosen={chosen}
        earliest={earliest}
        latest={latest}
        onPick={setRaceAt}
      />

      <Text style={styles.section}>Séances par semaine</Text>
      <View style={styles.row}>
        <Choice label="1" detail="la sortie longue" on={perWeek === 1} onPress={() => setPerWeek(1)} />
        <Choice label="2" detail="le minimum qui prépare" on={perWeek === 2} onPress={() => setPerWeek(2)} />
        <Choice label="3" detail="confortable" on={perWeek === 3} onPress={() => setPerWeek(3)} />
        <Choice label="4" detail="si tu cours déjà beaucoup" on={perWeek === 4} onPress={() => setPerWeek(4)} />
      </View>

      <Text style={styles.section}>Temps visé</Text>
      <Text style={styles.hint}>
        {reference
          ? "Projeté depuis ta meilleure course. C'est lui qui fixe toutes les allures du programme."
          : "Aucune course assez longue dans ton historique pour projeter. Pars de là et ajuste."}
      </Text>
      <View style={styles.stepper}>
        <HoldButton
          label="−"
          accessibilityLabel="Temps plus court"
          // Each sign moves the number it is next to, not the ambition behind
          // it. A minus that raised the figure because a faster target is more
          // ambitious would be reasoning nobody performs while looking at a
          // clock.
          //
          // Functional, because a hold fires faster than a render: reading the
          // displayed value each time would step from the same number over
          // and over.
          onStep={() => setOverride((current) => Math.max(stepS, (current ?? suggested) - stepS))}
        />
        <View style={styles.target}>
          <Text style={styles.targetValue}>
            {formatDuration(targetTimeS)}
          </Text>
          <Text style={styles.targetDetail}>
            {paces ? `${formatPace(projectedTimeS(goal, paces) / (goal.distanceM / 1000))} au km` : ""}
          </Text>
        </View>
        <HoldButton
          label="+"
          accessibilityLabel="Temps plus long"
          onStep={() => setOverride((current) => (current ?? suggested) + stepS)}
        />
      </View>

      {paces ? (
        <View style={styles.paces}>
          {([
            ["Footing", paces.easy],
            ["Sortie longue", paces.long],
            ["Seuil", paces.half],
            ["Fractionné", paces.interval],
          ] as const).map(([label, pace]) => (
            <View key={label} style={styles.pace}>
              <Text style={styles.paceLabel}>{label}</Text>
              <Text style={styles.paceValue}>{formatPace(pace)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          if (!ready) return;
          onCreate({ goal: goalId, raceAt: chosen, weeks, perWeek, targetTimeS });
        }}
        disabled={!ready}
        accessibilityRole="button"
        style={({ pressed }) => [styles.create, !ready && styles.createOff, pressed && styles.pressed]}
      >
        <Text style={[styles.createLabel, !ready && styles.createLabelOff]}>
          {ready ? `Créer ${weeks} semaines · ${sessions} séances` : "Choisis une date"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 30 },
  title: {
    color: colors.text, fontSize: 32, fontFamily: font.bold,
    letterSpacing: -0.6, paddingTop: 10,
  },
  lede: { color: colors.muted, fontFamily: font.regular, fontSize: 15.5, lineHeight: 22, marginTop: 4 },
  section: {
    color: colors.subtle, fontSize: 13, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase", marginTop: 26, marginBottom: 8,
  },
  hint: { color: colors.subtle, fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  choice: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, gap: 1,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceLabel: { color: colors.text, fontSize: 15.5, fontFamily: font.semibold },
  choiceLabelOn: { color: colors.accentText },
  choiceDetail: { color: colors.subtle, fontSize: 12, fontFamily: font.regular },
  choiceDetailOn: { color: colors.accentText, opacity: 0.8 },

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

  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  step: {
    width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  stepPressed: { backgroundColor: colors.sunken },
  stepLabel: { color: colors.text, fontSize: 24, fontFamily: font.semibold, lineHeight: 28 },
  target: { flex: 1, alignItems: "center" },
  targetValue: {
    color: colors.text, fontSize: 34, fontFamily: font.bold,
    letterSpacing: -0.5, fontVariant: ["tabular-nums"],
  },
  targetDetail: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular },

  paces: {
    flexDirection: "row", flexWrap: "wrap", marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, paddingTop: 12,
  },
  pace: { width: "50%", paddingVertical: 5 },
  paceLabel: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  paceValue: { color: colors.text, fontSize: 17, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },

  create: {
    marginTop: 28, borderRadius: 10, paddingVertical: 15,
    alignItems: "center", backgroundColor: colors.accent,
  },
  createOff: { backgroundColor: colors.sunken },
  createLabel: { color: colors.accentText, fontSize: 16.5, fontFamily: font.semibold },
  createLabelOff: { color: colors.subtle },
  pressed: { opacity: 0.85 },
});
