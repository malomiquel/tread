import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { HoldButton } from "@/components/HoldButton";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { readRun, rewriteRun, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import type { TrackPoint } from "@/lib/geo";
import { forgetRunInHealth, syncRunToHealth } from "@/lib/health";
import { defineStrings, useStrings } from "@/lib/i18n";
import { editRun, maxCutS } from "@/lib/runEdit";
import { colors, font } from "@/lib/theme";
import { distanceUnit, paceUnit, unitLengthM } from "@/lib/units";

const strings = defineStrings({
  fr: {
    cut: "Couper",
    cutFooter: "Pour un départ lancé trop tôt ou un arrêt oublié : le tracé coupé disparaît de la carte, du temps et des records.",
    start: "Au début",
    end: "À la fin",
    none: "Rien",
    cutValue: (time: string) => `− ${time}`,
    less: "Couper moins",
    more: "Couper plus",
    result: "Après modification",
    distance: "Distance",
    time: "Temps",
    pace: "Allure",
    correct: "Corriger la distance",
    correctFooter: "Si le GPS s'est trompé : la distance et l'allure prennent ta valeur, les fractionnés et les records restent ceux du tracé.",
    shorter: "Distance plus courte",
    longer: "Distance plus longue",
    save: "Enregistrer",
    saveFailed: "Enregistrement impossible",
    tryAgain: "La course n'a pas pu être modifiée. Réessaie.",
    notFound: "Course introuvable.",
  },
  en: {
    cut: "Cut",
    cutFooter: "For a run started too early or stopped too late: the cut part leaves the map, the time and the records.",
    start: "At the start",
    end: "At the end",
    none: "Nothing",
    cutValue: (time: string) => `− ${time}`,
    less: "Cut less",
    more: "Cut more",
    result: "After editing",
    distance: "Distance",
    time: "Time",
    pace: "Pace",
    correct: "Correct the distance",
    correctFooter: "If the GPS got it wrong: distance and pace take your figure, splits and records stay the track's.",
    shorter: "Shorter distance",
    longer: "Longer distance",
    save: "Save",
    saveFailed: "Couldn't save",
    tryAgain: "The run couldn't be edited. Try again.",
    notFound: "Run not found.",
  },
});

/** Seconds cut per step: five at a time, faster while held. */
const CUT_STEP_S = 5;

/** − value +, each side repeating while held. */
function Stepper({ value, onLess, onMore, lessLabel, moreLabel, canLess, canMore }: {
  value: string;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
  canLess: boolean;
  canMore: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <HoldButton label="−" accessibilityLabel={lessLabel} onStep={onLess} disabled={!canLess} />
      <Text style={styles.stepValue}>{value}</Text>
      <HoldButton label="+" accessibilityLabel={moreLabel} onStep={onMore} disabled={!canMore} />
    </View>
  );
}

/**
 * Putting a run right: cut a forgotten start or finish, correct a distance
 * the GPS got wrong. Nothing is written until "Save", and the map shows what
 * will be kept as the cuts move.
 */
export default function EditRunScreen() {
  const s = useStrings(strings);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ run: Run; points: TrackPoint[] } | null | undefined>(undefined);
  const [cutStartS, setCutStartS] = useState(0);
  const [cutEndS, setCutEndS] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [correctedM, setCorrectedM] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    readRun(Number(id))
      .then((loaded) => {
        if (!active) return;
        setData(loaded);
        if (loaded) setCorrectedM(Math.round(loaded.run.distanceM / 10) * 10);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => { active = false; };
  }, [id]);

  if (data === undefined) {
    return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (data === null || data.run.endedAt === null) {
    return <View style={styles.centered}><Text style={styles.muted}>{s.notFound}</Text></View>;
  }

  const { run, points } = data;
  const endedAt = run.endedAt ?? run.startedAt;
  const edited = editRun({ ...run, endedAt }, points, cutStartS, cutEndS, correcting ? correctedM : null);
  // A hundredth of the unit per step: ten metres, or a sixteenth of a furlong.
  const distanceStep = unitLengthM() / 100;
  const cutLabel = (seconds: number) => (seconds === 0 ? s.none : s.cutValue(formatDuration(seconds)));

  const save = async () => {
    setSaving(true);
    try {
      // The copy in Health holds the old figures: it goes, and the new ones
      // are written in its place once the run is saved.
      if (run.healthUuid) await forgetRunInHealth(run);
      await rewriteRun(run.id, edited);
      if (run.healthUuid) void syncRunToHealth(run.id);
      router.back();
    } catch {
      setSaving(false);
      Alert.alert(s.saveFailed, s.tryAgain);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RunMap points={edited.points} fitAll style={styles.map} />

      <SettingsGroup title={s.cut} footer={s.cutFooter}>
        <SettingRow
          icon="play-skip-forward-outline"
          label={s.start}
          right={
            <Stepper
              value={cutLabel(cutStartS)}
              onLess={() => setCutStartS((held) => Math.max(0, held - CUT_STEP_S))}
              onMore={() => setCutStartS((held) => Math.min(maxCutS(points, cutEndS), held + CUT_STEP_S))}
              lessLabel={s.less}
              moreLabel={s.more}
              canLess={cutStartS > 0}
              canMore={cutStartS < maxCutS(points, cutEndS)}
            />
          }
        />
        <SettingRow
          icon="play-skip-back-outline"
          label={s.end}
          right={
            <Stepper
              value={cutLabel(cutEndS)}
              onLess={() => setCutEndS((held) => Math.max(0, held - CUT_STEP_S))}
              onMore={() => setCutEndS((held) => Math.min(maxCutS(points, cutStartS), held + CUT_STEP_S))}
              lessLabel={s.less}
              moreLabel={s.more}
              canLess={cutEndS > 0}
              canMore={cutEndS < maxCutS(points, cutStartS)}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup footer={s.correctFooter}>
        <SettingRow
          icon="create-outline"
          label={s.correct}
          right={
            <Switch
              value={correcting}
              onValueChange={setCorrecting}
              trackColor={{ true: colors.accent, false: colors.hairline }}
              accessibilityLabel={s.correct}
            />
          }
        />
        {correcting ? (
          <SettingRow
            icon="resize-outline"
            label={s.distance}
            right={
              <Stepper
                value={`${formatDistance(correctedM)} ${distanceUnit()}`}
                onLess={() => setCorrectedM((held) => Math.max(distanceStep, held - distanceStep))}
                onMore={() => setCorrectedM((held) => held + distanceStep)}
                lessLabel={s.shorter}
                moreLabel={s.longer}
                canLess={correctedM > distanceStep}
                canMore
              />
            }
          />
        ) : null}
      </SettingsGroup>

      <Text style={styles.resultTitle}>{s.result}</Text>
      <View style={styles.result}>
        <Metric label={s.distance} value={formatDistance(edited.distanceM)} unit={distanceUnit()} />
        <Metric label={s.time} value={formatDuration(edited.durationS)} />
        <Metric label={s.pace} value={formatPace(edited.avgPaceSKm)} unit={paceUnit()} />
      </View>

      <View style={styles.actions}>
        <Button label={s.save} onPress={() => void save()} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 15, fontFamily: font.regular },
  map: { height: 220 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepValue: {
    color: colors.text, fontSize: 15.5, fontFamily: font.semibold,
    minWidth: 76, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  resultTitle: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.medium, letterSpacing: 1,
    textTransform: "uppercase", marginTop: 24, marginBottom: 8, marginHorizontal: 20,
  },
  result: { flexDirection: "row", gap: 16, paddingHorizontal: 20 },
  actions: { marginTop: 28, paddingHorizontal: 16 },
});
