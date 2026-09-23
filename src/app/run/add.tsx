import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { HoldButton } from "@/components/HoldButton";
import { Metric } from "@/components/Metric";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { addManualRun } from "@/lib/db";
import { autoName, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { paceSecPerKm } from "@/lib/geo";
import { defineStrings, intlLocale, useStrings } from "@/lib/i18n";
import { refreshHomeWidget } from "@/lib/homeWidget";
import { startOfDay } from "@/lib/plan";
import { colors, font } from "@/lib/theme";
import { distanceUnit, paceUnit, unitLengthM } from "@/lib/units";

const strings = defineStrings({
  fr: {
    when: "Quand",
    day: "Jour",
    today: "Aujourd'hui",
    yesterday: "Hier",
    start: "Départ",
    earlierDay: "Jour précédent",
    laterDay: "Jour suivant",
    earlier: "Plus tôt",
    later: "Plus tard",
    run: "La course",
    distance: "Distance",
    shorter: "Distance plus courte",
    longer: "Distance plus longue",
    minutes: "Durée",
    seconds: "Secondes",
    lessMinutes: "Une minute de moins",
    moreMinutes: "Une minute de plus",
    lessSeconds: "Une seconde de moins",
    moreSeconds: "Une seconde de plus",
    name: "Nom",
    footer: "Pour une sortie sur tapis ou sans téléphone. Sans tracé, elle n'a ni carte ni fractionnés, mais compte dans tes totaux et ton objectif.",
    time: "Temps",
    pace: "Allure",
    save: "Ajouter la course",
    saveFailed: "Ajout impossible",
    tryAgain: "La course n'a pas pu être ajoutée. Réessaie.",
  },
  en: {
    when: "When",
    day: "Day",
    today: "Today",
    yesterday: "Yesterday",
    start: "Start",
    earlierDay: "Previous day",
    laterDay: "Next day",
    earlier: "Earlier",
    later: "Later",
    run: "The run",
    distance: "Distance",
    shorter: "Shorter distance",
    longer: "Longer distance",
    minutes: "Time",
    seconds: "Seconds",
    lessMinutes: "One minute less",
    moreMinutes: "One minute more",
    lessSeconds: "One second less",
    moreSeconds: "One second more",
    name: "Name",
    footer: "For a treadmill run or one without your phone. With no track it has no map or splits, but it counts in your totals and your goal.",
    time: "Time",
    pace: "Pace",
    save: "Add the run",
    saveFailed: "Couldn't add",
    tryAgain: "The run couldn't be added. Try again.",
  },
});

const DAY_MS = 86_400_000;
const QUARTER_MS = 15 * 60_000;

function Stepper({ value, onLess, onMore, lessLabel, moreLabel, canLess = true, canMore = true }: {
  value: string;
  onLess: () => void;
  onMore: () => void;
  lessLabel: string;
  moreLabel: string;
  canLess?: boolean;
  canMore?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <HoldButton label="−" accessibilityLabel={lessLabel} onStep={onLess} disabled={!canLess} />
      <Text style={styles.stepValue}>{value}</Text>
      <HoldButton label="+" accessibilityLabel={moreLabel} onStep={onMore} disabled={!canMore} />
    </View>
  );
}

/** The start of the last quarter hour, as a sensible first guess. */
function lastQuarter(): number {
  return Math.floor(Date.now() / QUARTER_MS) * QUARTER_MS;
}

/**
 * A run typed in by hand: when, how far, how long.
 *
 * Every figure moves by steps rather than by keyboard, like the rest of the
 * app, and starts on a guess worth correcting — now, five kilometres, half an
 * hour — so a typical run is entered in a few taps.
 */
export default function AddRunScreen() {
  const s = useStrings(strings);
  const router = useRouter();
  const [startedAt, setStartedAt] = useState(() => lastQuarter() - 30 * 60_000);
  const [distanceM, setDistanceM] = useState(() => 5 * unitLengthM());
  const [durationS, setDurationS] = useState(30 * 60);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const today = startOfDay(Date.now());
  const day = startOfDay(startedAt);
  const dayName = day === today
    ? s.today
    : day === today - DAY_MS
      ? s.yesterday
      : new Date(startedAt).toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" });
  const clock = new Date(startedAt).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" });
  // Nothing in the future: a run typed in has happened.
  const latest = Date.now() - durationS * 1000;
  const tenth = unitLengthM() / 10;

  const save = async () => {
    setSaving(true);
    try {
      const id = await addManualRun({ startedAt, durationS, distanceM, name });
      void refreshHomeWidget();
      router.replace({ pathname: "/run/[id]", params: { id: String(id) } });
    } catch {
      setSaving(false);
      Alert.alert(s.saveFailed, s.tryAgain);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SettingsGroup title={s.when}>
        <SettingRow
          icon="calendar-outline"
          label={s.day}
          right={
            <Stepper
              value={dayName}
              onLess={() => setStartedAt((held) => held - DAY_MS)}
              onMore={() => setStartedAt((held) => Math.min(held + DAY_MS, latest))}
              lessLabel={s.earlierDay}
              moreLabel={s.laterDay}
              canMore={startedAt + DAY_MS <= latest}
            />
          }
        />
        <SettingRow
          icon="time-outline"
          label={s.start}
          right={
            <Stepper
              value={clock}
              onLess={() => setStartedAt((held) => held - QUARTER_MS)}
              onMore={() => setStartedAt((held) => Math.min(held + QUARTER_MS, latest))}
              lessLabel={s.earlier}
              moreLabel={s.later}
              canMore={startedAt + QUARTER_MS <= latest}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title={s.run} footer={s.footer}>
        <SettingRow
          icon="resize-outline"
          label={s.distance}
          right={
            <Stepper
              value={`${formatDistance(distanceM)} ${distanceUnit()}`}
              onLess={() => setDistanceM((held) => Math.max(tenth, held - tenth))}
              onMore={() => setDistanceM((held) => held + tenth)}
              lessLabel={s.shorter}
              moreLabel={s.longer}
              canLess={distanceM > tenth}
            />
          }
        />
        <SettingRow
          icon="stopwatch-outline"
          label={s.minutes}
          right={
            <Stepper
              value={formatDuration(durationS)}
              onLess={() => setDurationS((held) => Math.max(60, held - 60))}
              onMore={() => setDurationS((held) => held + 60)}
              lessLabel={s.lessMinutes}
              moreLabel={s.moreMinutes}
              canLess={durationS > 60}
            />
          }
        />
        <SettingRow
          icon="timer-outline"
          label={s.seconds}
          right={
            <Stepper
              value={String(durationS % 60).padStart(2, "0")}
              onLess={() => setDurationS((held) => Math.max(60, held - 1))}
              onMore={() => setDurationS((held) => held + 1)}
              lessLabel={s.lessSeconds}
              moreLabel={s.moreSeconds}
              canLess={durationS > 60}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title={s.name}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={autoName(startedAt)}
          placeholderTextColor={colors.subtle}
          style={styles.input}
          maxLength={60}
          accessibilityLabel={s.name}
        />
      </SettingsGroup>

      <View style={styles.result}>
        <Metric label={s.distance} value={formatDistance(distanceM)} unit={distanceUnit()} />
        <Metric label={s.time} value={formatDuration(durationS)} />
        <Metric label={s.pace} value={formatPace(paceSecPerKm(distanceM, durationS))} unit={paceUnit()} />
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
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepValue: {
    color: colors.text, fontSize: 15.5, fontFamily: font.semibold,
    minWidth: 84, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  input: { color: colors.text, fontSize: 17, fontFamily: font.semibold, paddingVertical: 13 },
  result: { flexDirection: "row", gap: 16, paddingHorizontal: 20, marginTop: 24 },
  actions: { marginTop: 28, paddingHorizontal: 16 },
});
