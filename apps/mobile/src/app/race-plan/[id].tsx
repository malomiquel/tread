import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { HoldButton } from "@/components/HoldButton";
import { LineChart } from "@/components/LineChart";
import { Panel } from "@/components/Panel";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { SummaryBanner } from "@/components/SummaryBanner";
import { listRuns, readRoute } from "@/lib/db";
import { fetchElevation, readRacePlan, writeRacePlan } from "@/lib/racePlan";
import { setRoute } from "@/lib/settings";
import { colors, font } from "@/lib/theme";
import type { Elevation } from "@tread/core/elevation";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@tread/core/format";
import { decimal, defineStrings, useStrings } from "@tread/core/i18n";
import { goalVerdict, racePlan, type GoalVerdict } from "@tread/core/raceDay";
import type { StoredRoute } from "@tread/core/route";
import { estimateRouteTime, type RouteEstimate } from "@tread/core/routeTime";
import { distanceUnit, elevationUnit, paceUnit, toDistanceUnits, unitLengthM } from "@tread/core/units";

const raceStrings = defineStrings({
  fr: {
    title: "Plan de course",
    goal: "Objectif",
    pace: "Allure moy.",
    distance: "Distance",
    gain: "D+",
    lede: "Ton temps réparti sur le parcours, pour un effort régulier : plus lent dans les montées, un peu plus vite ailleurs. Pendant la course, l'écran et la voix suivent ce plan.",
    slower: "Plus lent de 15 secondes",
    faster: "Plus rapide de 15 secondes",
    estimate: (time: string, low: string, high: string) => `D'après tes sorties : ${time} (${low} à ${high})`,
    noEstimate: "Pas assez de sorties récentes pour estimer ton temps.",
    verdict: {
      ambitious: "Ambitieux : plus vite que tes meilleurs jours récents.",
      realistic: "Réaliste : dans ce que tu cours en ce moment.",
      cautious: "Prudent : tu cours plus vite que ça en ce moment.",
    } satisfies Record<GoalVerdict, string>,
    profile: "Profil",
    flatProfile: "Profil indisponible pour l'instant : le plan est à allure régulière. Il sera recalculé dès que le téléphone aura du réseau.",
    splits: "Allure par kilomètre",
    splitsMile: "Allure par mile",
    climbs: "Montées",
    climbsAside: (count: number) => `${count}`,
    split: (n: number) => `Km ${n}`,
    splitMile: (n: number) => `Mile ${n}`,
    splitDetail: (grade: string, at: string) => `${grade} · passage ${at}`,
    flat: "plat",
    climb: (length: string, grade: string) => `${length} à ${grade}`,
    climbDetail: (from: string) => `à partir du ${from}`,
    climbCost: (seconds: number) => `+${seconds} s`,
    run: "Courir ce plan",
    missing: "Ce parcours n'existe plus.",
  },
  en: {
    title: "Race plan",
    goal: "Goal",
    pace: "Avg pace",
    distance: "Distance",
    gain: "Gain",
    lede: "Your time spread over the course for an even effort: slower on the climbs, a little quicker elsewhere. During the race, the screen and the voice follow this plan.",
    slower: "Slower by 15 seconds",
    faster: "Faster by 15 seconds",
    estimate: (time: string, low: string, high: string) => `From your runs: ${time} (${low} to ${high})`,
    noEstimate: "Not enough recent runs to estimate your time.",
    verdict: {
      ambitious: "Ambitious: faster than your best recent days.",
      realistic: "Realistic: within what you are running now.",
      cautious: "Cautious: you are running faster than that now.",
    },
    profile: "Profile",
    flatProfile: "Profile unavailable for now: the plan is an even pace. It will be worked out again once the phone has a signal.",
    splits: "Pace per kilometre",
    splitsMile: "Pace per mile",
    climbs: "Climbs",
    climbsAside: (count: number) => `${count}`,
    split: (n: number) => `Km ${n}`,
    splitMile: (n: number) => `Mile ${n}`,
    splitDetail: (grade: string, at: string) => `${grade} · at ${at}`,
    flat: "flat",
    climb: (length: string, grade: string) => `${length} at ${grade}`,
    climbDetail: (from: string) => `from ${from}`,
    climbCost: (seconds: number) => `+${seconds} s`,
    run: "Run this plan",
    missing: "This route no longer exists.",
  },
});

const GOAL_STEP_S = 15;
const percent = (grade: number) => `${grade > 0 ? "+" : ""}${decimal((grade * 100).toFixed(1))} %`;
const roundTo = (seconds: number, step: number) => Math.round(seconds / step) * step;

/**
 * A race on a route: the goal time, what the runner's recent outings say
 * about it, and the pace for every kilometre of the course.
 */
export default function RacePlanScreen() {
  const s = useStrings(raceStrings);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Number(id);

  const [route, setRouteData] = useState<StoredRoute | null>(null);
  const [missing, setMissing] = useState(false);
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [elevation, setElevation] = useState<Elevation | null>(null);
  const [goalS, setGoalS] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const found = await readRoute(routeId);
      if (!active) return;
      if (!found) {
        setMissing(true);
        return;
      }
      setRouteData(found);
      const stored = await readRacePlan(routeId);
      let known = stored.elevation;
      // Asked once and kept, so the plan holds on a race morning without signal.
      if (!known) {
        known = await fetchElevation(found);
        if (known) await writeRacePlan(routeId, { ...stored, elevation: known });
      }
      const runs = await listRuns();
      const guess = estimateRouteTime(runs, found.distanceM, known?.gainM ?? 0);
      if (!active) return;
      setElevation(known);
      setEstimate(guess);
      // A first goal from the runner's own form, never a figure from nowhere.
      setGoalS(stored.goalS ?? (guess ? roundTo(guess.timeS, GOAL_STEP_S) : roundTo(found.distanceM * 0.33, GOAL_STEP_S)));
    })();
    return () => {
      active = false;
    };
  }, [routeId]);

  const changeGoal = (by: number) => {
    setGoalS((current) => {
      if (current === null) return current;
      const next = Math.max(GOAL_STEP_S * 8, current + by);
      void readRacePlan(routeId).then((stored) => writeRacePlan(routeId, { ...stored, goalS: next }));
      return next;
    });
  };

  const unitM = unitLengthM();
  const plan = useMemo(
    () => (route && goalS !== null ? racePlan(route.distanceM, goalS, elevation?.profile ?? null, unitM) : null),
    [route, goalS, elevation, unitM],
  );

  if (missing) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: s.title }} />
        <Text style={styles.lede}>{s.missing}</Text>
      </View>
    );
  }
  if (!route || !plan || goalS === null) {
    return <View style={styles.screen}><Stack.Screen options={{ title: s.title }} /></View>;
  }

  const verdict = goalVerdict(goalS, estimate);
  const metric = unitM === 1000;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: s.title }} />
      <Text style={styles.name} numberOfLines={2}>{route.name}</Text>

      <SummaryBanner
        label={s.goal}
        value={formatDuration(goalS)}
        figures={[
          { value: formatPace(goalS / (route.distanceM / 1000)), unit: paceUnit(), label: s.pace },
          { value: formatDistance(route.distanceM), unit: distanceUnit(), label: s.distance },
          ...(elevation ? [{ value: formatElevation(elevation.gainM), unit: elevationUnit(), label: s.gain }] : []),
        ]}
      />

      <Panel style={styles.panel}>
        <View style={styles.stepper}>
          <HoldButton label="−" accessibilityLabel={s.faster} onStep={() => changeGoal(-GOAL_STEP_S)} />
          <View style={styles.target}>
            <Text style={styles.targetValue}>{formatDuration(goalS)}</Text>
            <Text style={styles.targetDetail} numberOfLines={2}>
              {estimate
                ? s.estimate(formatDuration(estimate.timeS), formatDuration(estimate.lowS), formatDuration(estimate.highS))
                : s.noEstimate}
            </Text>
          </View>
          <HoldButton label="+" accessibilityLabel={s.slower} onStep={() => changeGoal(GOAL_STEP_S)} />
        </View>
        {/* Room kept for the verdict, so the page does not jump as it appears. */}
        <Text style={[styles.verdict, verdict === "ambitious" && styles.verdictWarn]} numberOfLines={2}>
          {verdict ? s.verdict[verdict] : " "}
        </Text>
      </Panel>

      <Text style={styles.lede}>{s.lede}</Text>

      <SectionHeader title={s.profile} />
      {elevation ? (
        <View style={styles.chart}>
          <LineChart points={elevation.profile} format={formatElevation} unit={elevationUnit()} />
        </View>
      ) : (
        <Text style={styles.lede}>{s.flatProfile}</Text>
      )}

      {plan.climbs.length > 0 ? (
        <>
          <SectionHeader title={s.climbs} aside={s.climbsAside(plan.climbs.length)} />
          {plan.climbs.map((climb, index) => (
            <RecordRow
              key={climb.fromM}
              first={index === 0}
              icon="trending-up"
              label={s.climb(`${formatDistance(climb.toM - climb.fromM)} ${distanceUnit()}`, percent(climb.grade))}
              detail={s.climbDetail(`${metric ? "km" : "mile"} ${decimal(toDistanceUnits(climb.fromM).toFixed(1))}`)}
              value={s.climbCost(climb.costS)}
            />
          ))}
        </>
      ) : null}

      <SectionHeader title={metric ? s.splits : s.splitsMile} />
      {plan.splits.map((split, index) => (
        <RecordRow
          key={split.fromM}
          first={index === 0}
          icon={split.grade >= 0.01 ? "trending-up" : split.grade <= -0.01 ? "trending-down" : "remove-outline"}
          label={metric ? s.split(index + 1) : s.splitMile(index + 1)}
          detail={s.splitDetail(Math.abs(split.grade) < 0.005 ? s.flat : percent(split.grade), formatDuration(split.atS))}
          value={`${formatPace(split.paceSKm)}${paceUnit()}`}
        />
      ))}

      <Button
        label={s.run}
        style={styles.run}
        onPress={() => {
          void setRoute(route.id);
          router.push("/record");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 10, paddingBottom: 60 },
  name: {
    color: colors.text, fontSize: 24, fontFamily: font.bold, letterSpacing: -0.6,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  panel: { marginTop: 12, paddingVertical: 16 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  target: { flex: 1, alignItems: "center" },
  targetValue: {
    color: colors.text, fontSize: 34, fontFamily: font.bold,
    letterSpacing: -0.5, fontVariant: ["tabular-nums"],
  },
  targetDetail: {
    color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, textAlign: "center",
    minHeight: 38, fontVariant: ["tabular-nums"],
  },
  verdict: {
    color: colors.muted, fontSize: 14.5, fontFamily: font.regular, lineHeight: 20,
    textAlign: "center", marginTop: 8, minHeight: 40,
  },
  verdictWarn: { color: colors.warning },
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, paddingTop: 14,
  },
  chart: { paddingHorizontal: 20 },
  run: { marginHorizontal: 20, marginTop: 24 },
});
