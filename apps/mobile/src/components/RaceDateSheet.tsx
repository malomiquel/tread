import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { HoldButton } from "@/components/HoldButton";
import { MonthPicker } from "@/components/MonthPicker";
import { colors, font } from "@/lib/theme";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";

const raceDateStrings = defineStrings({
  fr: {
    title: "Jour de course",
    lede: "La date et l'heure du départ : la course compte les jours, et reçoit sa météo dès que la prévision l'atteint.",
    start: "Départ",
    earlier: "Plus tôt de 15 minutes",
    later: "Plus tard de 15 minutes",
    cancel: "Annuler",
    keep: "Enregistrer",
    remove: "Retirer la date",
  },
  en: {
    title: "Race day",
    lede: "The date and start time: the race counts the days down, and gets its weather once the forecast reaches it.",
    start: "Start",
    earlier: "Earlier by 15 minutes",
    later: "Later by 15 minutes",
    cancel: "Cancel",
    keep: "Save",
    remove: "Remove the date",
  },
});

const STEP_MIN = 15;
const EARLIEST_MIN = 5 * 60;
const LATEST_MIN = 22 * 60;
/** Most races start in the morning. */
const DEFAULT_MIN = 9 * 60;
/** How far ahead a race can be set: a season, and the next one. */
const AHEAD_DAYS = 2 * 365;

const midnight = (at: number) => {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

interface Props {
  visible: boolean;
  /** The start already chosen, or null. */
  date: number | null;
  onKeep: (date: number | null) => void;
  onClose: () => void;
}

/**
 * Choosing a race's day and start time, in a sheet over the plan: a month
 * to pick the day from, the start on a stepper beside it.
 */
export function RaceDateSheet({ visible, date, onKeep, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounted only while open, so it starts from the stored date each time. */}
      {visible ? <Sheet date={date} onKeep={onKeep} onClose={onClose} /> : null}
    </Modal>
  );
}

function Sheet({ date, onKeep, onClose }: Omit<Props, "visible">) {
  const s = useStrings(raceDateStrings);
  const today = midnight(Date.now());
  const [day, setDay] = useState<number | null>(date === null ? null : midnight(date));
  const [minutes, setMinutes] = useState(() => {
    if (date === null) return DEFAULT_MIN;
    const at = new Date(date);
    return at.getHours() * 60 + at.getMinutes();
  });
  const [month, setMonth] = useState(() => new Date(date ?? Date.now()));

  const startLabel = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)
    .toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" });
  const move = (by: number) => setMinutes((held) => Math.min(LATEST_MIN, Math.max(EARLIEST_MIN, held + by)));

  const keep = () => {
    if (day === null) return;
    const at = new Date(day);
    at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    onKeep(at.getTime());
  };

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      {/* Stops a tap inside the sheet from closing it. */}
      <Pressable onPress={() => undefined} style={styles.sheet}>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.lede}>{s.lede}</Text>

        <MonthPicker
          month={month}
          onMonth={setMonth}
          chosen={day}
          earliest={today}
          latest={today + AHEAD_DAYS * 86_400_000}
          onPick={setDay}
        />

        <View style={styles.stepper}>
          <HoldButton label="−" accessibilityLabel={s.earlier} onStep={() => move(-STEP_MIN)} disabled={minutes <= EARLIEST_MIN} />
          <View style={styles.value}>
            <Text style={styles.number}>{startLabel}</Text>
            <Text style={styles.unit}>{s.start}</Text>
          </View>
          <HoldButton label="+" accessibilityLabel={s.later} onStep={() => move(STEP_MIN)} disabled={minutes >= LATEST_MIN} />
        </View>

        <View style={styles.actions}>
          <Button label={s.cancel} variant="secondary" onPress={onClose} />
          <Button label={s.keep} onPress={keep} disabled={day === null} />
        </View>

        {date !== null ? (
          <Pressable
            onPress={() => onKeep(null)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.drop, pressed && styles.dropPressed]}
          >
            <Text style={styles.dropLabel}>{s.remove}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheet: {
    width: "100%", maxWidth: 380, borderRadius: 18, padding: 22, gap: 12,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 24, fontFamily: font.bold, letterSpacing: -0.4 },
  lede: { color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  value: { flex: 1, alignItems: "center" },
  number: {
    color: colors.text, fontSize: 30, fontFamily: font.bold,
    letterSpacing: -0.6, fontVariant: ["tabular-nums"],
  },
  unit: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  drop: { alignItems: "center", paddingTop: 2 },
  dropPressed: { opacity: 0.6 },
  dropLabel: { color: colors.danger, fontSize: 14.5, fontFamily: font.semibold },
});
