import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { refreshReminders } from "@/lib/planReminders";
import { defineStrings, useStrings } from "@/lib/i18n";
import {
  askReminders, reminderName, type ReminderWhen,
} from "@/lib/reminders";
import { setReminder, useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";

const notificationStrings = defineStrings({
  fr: {
    sessionReminder: "Rappel de séance",
    sessionReminderDetail: "Une notification avant chaque séance du programme, avec la météo du jour.",
    when: "Quand",
    eveningDetail: "La veille à 19 h, quand il est encore temps de déplacer la séance",
    morningDetail: "À 6 h 30, avant la journée qu'elle concerne",
    blockedTitle: "Rappels bloqués",
    blockedMessage:
      "Tread n'a pas le droit de t'envoyer de notification. Tu peux le lui donner dans les réglages du téléphone.",
    cancel: "Annuler",
    openSettings: "Ouvrir les réglages",
  },
  en: {
    sessionReminder: "Session reminder",
    sessionReminderDetail: "A notification before every session of your plan, with the day's weather.",
    when: "When",
    eveningDetail: "The day before at 7 pm, while there's still time to move the session",
    morningDetail: "At 6:30 am, before the day it's planned for",
    blockedTitle: "Reminders blocked",
    blockedMessage:
      "Tread isn't allowed to send you notifications. You can allow it in your phone's settings.",
    cancel: "Cancel",
    openSettings: "Open Settings",
  },
});

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
  const s = useStrings(notificationStrings);
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup>
        <SettingRow
          icon="notifications-outline"
          label={s.sessionReminder}
          detail={s.sessionReminderDetail}
          right={
            <Switch
              value={on}
              onValueChange={(next) => void choose(next ? DEFAULT_WHEN : "off")}
              disabled={busy}
              trackColor={{ true: colors.accent, false: colors.hairline }}
              accessibilityLabel={s.sessionReminder}
            />
          }
        />
      </SettingsGroup>

      {/* Only once there is something to place. A choice of moment above a
          switch that is off is a question about nothing. */}
      {on ? (
        <SettingsGroup title={s.when}>
          {(["evening", "morning"] as const).map((when) => (
            <SettingRow
              key={when}
              label={reminderName(when)}
              detail={when === "evening"
                ? s.eveningDetail
                : s.morningDetail}
              selected={settings.reminder === when}
              onPress={() => void choose(when)}
            />
          ))}
        </SettingsGroup>
      ) : null}
    </ScrollView>
  );
}

function blocked() {
  const s = notificationStrings();
  Alert.alert(
    s.blockedTitle,
    s.blockedMessage,
    [
      { text: s.cancel, style: "cancel" },
      { text: s.openSettings, onPress: () => void Linking.openSettings() },
    ],
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
});
