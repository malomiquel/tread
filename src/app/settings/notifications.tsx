import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { refreshReminders } from "@/lib/planReminders";
import {
  askReminders, REMINDER_NAMES, testReminder, TEST_DELAY_S, type ReminderWhen,
} from "@/lib/reminders";
import { setReminder, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

/** Where a reminder lands when it is switched on without a moment being chosen. */
const DEFAULT_WHEN: ReminderWhen = "evening";

/**
 * Everything the app is allowed to interrupt you for.
 *
 * One switch and one choice today. It is its own page because the list will
 * grow — a run left unfinished, a record beaten — and because notifications
 * are the one thing an app does when nobody asked it to, which is worth a
 * page somebody can find in the dark.
 */
export default function NotificationSettings() {
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const on = settings.reminder !== "off";

  /**
   * Permission is asked for here, at the moment somebody has just said they
   * want to be reminded. Refused, the choice is not recorded: a setting that
   * reads "the evening before" while iOS silently drops every notification is
   * a lie the app would be telling once a week.
   */
  async function choose(when: ReminderWhen) {
    if (busy) return;
    setBusy(true);
    try {
      if (when !== "off" && !(await askReminders())) {
        blocked();
        return;
      }
      await setReminder(when);
      // Rebuilt straight away rather than on the next visit to the plan:
      // this is not the plan, and somebody could turn reminders on here and
      // not open that tab for a fortnight. Forced, because switching off is
      // exactly the case where something pending has to be cancelled.
      await refreshReminders({ force: true });
    } finally {
      setBusy(false);
    }
  }

  /** Temporary, and meant to be deleted. See testReminder(). */
  async function tryOne() {
    if (!(await askReminders())) {
      blocked();
      return;
    }
    if (await testReminder()) {
      Alert.alert(
        "Rappel envoyé",
        `Il arrive dans ${TEST_DELAY_S} secondes. Tu peux verrouiller l'écran en attendant.`,
      );
    } else {
      Alert.alert(
        "Rappel impossible",
        "Cette version de l'app ne sait pas envoyer de notification. Elle demande une version installée, pas Expo Go.",
      );
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.group}>
        <SettingRow
          label="Rappel de séance"
          detail="Une notification avant chaque séance du programme, avec la météo du jour."
          right={
            <Switch
              value={on}
              onValueChange={(next) => void choose(next ? DEFAULT_WHEN : "off")}
              disabled={busy}
              trackColor={{ true: colors.accent, false: colors.hairline }}
              accessibilityLabel="Rappel de séance"
            />
          }
        />
      </View>

      {/* Only once there is something to place. A choice of moment above a
          switch that is off is a question about nothing. */}
      {on ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Quand</Text>
          {(["evening", "morning"] as const).map((when) => (
            <SettingRow
              key={when}
              label={REMINDER_NAMES[when]}
              detail={when === "evening"
                ? "La veille à 19 h, quand il est encore temps de déplacer la séance"
                : "À 6 h 30, avant la journée qu'elle concerne"}
              selected={settings.reminder === when}
              onPress={() => void choose(when)}
            />
          ))}
        </View>
      ) : null}

      {/* Temporary: a reminder whose only proof arrives at seven tomorrow
          evening is one nobody can check. To be deleted once it has. */}
      <View style={styles.group}>
        <SettingRow
          label="Tester le rappel"
          detail="Envoie une notification d'exemple tout de suite"
          onPress={() => void tryOne()}
        />
      </View>
    </ScrollView>
  );
}

function blocked() {
  Alert.alert(
    "Rappels bloqués",
    "Tread n'a pas le droit de t'envoyer de notification. Tu peux le lui donner dans Réglages › Notifications › Tread.",
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  group: {
    paddingHorizontal: GUTTER, paddingVertical: 6, marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  groupTitle: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.semibold,
    letterSpacing: 1.3, textTransform: "uppercase", paddingTop: 8,
  },
});
