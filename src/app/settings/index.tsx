import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Switch } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { WeeklyGoalSheet } from "@/components/WeeklyGoalSheet";
import { currentBuild } from "@/lib/build";
import { listRuns } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { LANGUAGE_NAMES } from "@/lib/language";
import { reminderName } from "@/lib/reminders";
import { forgetWelcome, toggleVoice, useSettings } from "@/lib/settings";
import { suggestedWeeklyGoalM } from "@/lib/stats";
import { colors } from "@/lib/theme";

const settingsStrings = defineStrings({
  fr: {
    training: "Entraînement",
    weeklyGoal: "Objectif hebdomadaire",
    noGoal: "Aucun",
    goalValue: (km: string) => `${km} km`,
    reminders: "Rappels de séance",
    running: "Pendant la course",
    voice: "Annonces vocales",
    voiceFooter: "Chaque kilomètre, les écarts d'allure et les blocs de séance sont annoncés à voix haute.",
    app: "Application",
    language: "Langue",
    languageAuto: "Automatique",
    data: "Données",
    importExport: "Importer et exporter",
    transfer: "Changer de téléphone",
    dataFooter: "Tes données restent sur ce téléphone. Exporte-les ou emporte-les ici.",
    about: "À propos",
    developer: "Développement",
    replayWelcome: "Revoir l'accueil",
  },
  en: {
    training: "Training",
    weeklyGoal: "Weekly goal",
    noGoal: "None",
    goalValue: (km: string) => `${km} km`,
    reminders: "Session reminders",
    running: "While running",
    voice: "Voice announcements",
    voiceFooter: "Every kilometre, pace drift and workout blocks are read out loud.",
    app: "App",
    language: "Language",
    languageAuto: "Automatic",
    data: "Data",
    importExport: "Import and export",
    transfer: "Switch phones",
    dataFooter: "Your data stays on this phone. Export it or take it with you from here.",
    about: "About",
    developer: "Development",
    replayWelcome: "Replay the welcome",
  },

});

/**
 * The way in to everything the app lets you decide.
 *
 * A page of its own rather than a section of the profile, and a list of rooms
 * rather than a list of switches. The app has one setting per room today and
 * will have four tomorrow; a flat list would have to be reorganised the day
 * it grows, and reorganising a settings page is how people lose the setting
 * they already knew where to find.
 *
 * Every row carries its own answer on the right, so the state of the whole
 * app is readable without opening anything.
 */
export default function SettingsScreen() {
  // Out of the compiler's memoisation: the values on the right of each row
  // are worked out by helpers that read the language themselves, and a row
  // memoised on the setting alone would keep the old language after a switch.
  "use no memo";
  const router = useRouter();
  const settings = useSettings();
  const s = useStrings(settingsStrings);
  const [editingGoal, setEditingGoal] = useState(false);
  /** Their own recent average, so the goal sheet opens on a figure they know. */
  const [suggestedM, setSuggestedM] = useState(5000);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRuns()
        .then((runs) => {
          if (active) setSuggestedM(suggestedWeeklyGoalM(runs));
        })
        .catch(() => undefined);
      return () => { active = false; };
    }, []),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/*
        * One block per subject, each row a mark, a name and where it stands.
        * The weekly goal is here as well as on the week it measures, in the
        * profile: both open the same sheet.
        */}
      <SettingsGroup title={s.training}>
        <SettingRow
          icon="flag-outline"
          label={s.weeklyGoal}
          value={settings.weeklyGoalM === null ? s.noGoal : s.goalValue(formatDistance(settings.weeklyGoalM))}
          onPress={() => setEditingGoal(true)}
        />
        <SettingRow
          icon="notifications-outline"
          label={s.reminders}
          value={reminderName(settings.reminder)}
          onPress={() => router.push("/settings/notifications")}
        />
      </SettingsGroup>

      {/* Also on the running screen, where it is changed mid-run. Here as
          well because this is where anybody looking for it looks first. */}
      <SettingsGroup title={s.running} footer={s.voiceFooter}>
        <SettingRow
          icon="volume-high-outline"
          label={s.voice}
          right={
            <Switch
              value={settings.voice}
              onValueChange={() => void toggleVoice()}
              trackColor={{ true: colors.accent, false: colors.hairline }}
              accessibilityLabel={s.voice}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title={s.app}>
        <SettingRow
          icon="language-outline"
          label={s.language}
          value={settings.language === "auto" ? s.languageAuto : LANGUAGE_NAMES[settings.language]}
          onPress={() => router.push("/settings/language")}
        />
      </SettingsGroup>

      <SettingsGroup title={s.data} footer={s.dataFooter}>
        <SettingRow
          icon="swap-vertical-outline"
          label={s.importExport}
          onPress={() => router.push("/settings/data")}
        />
        <SettingRow
          icon="phone-portrait-outline"
          label={s.transfer}
          onPress={() => router.push("/settings/transfer")}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          icon="information-circle-outline"
          label={s.about}
          value={currentBuild().version}
          onPress={() => router.push("/settings/about")}
        />
      </SettingsGroup>

      {/* Development builds only: never compiled into what ships. */}
      {__DEV__ ? (
        <SettingsGroup title={s.developer}>
          <SettingRow icon="refresh-outline" label={s.replayWelcome} onPress={() => void forgetWelcome()} />
        </SettingsGroup>
      ) : null}

      <WeeklyGoalSheet
        visible={editingGoal}
        goalM={settings.weeklyGoalM}
        suggestedM={suggestedM}
        onClose={() => setEditingGoal(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
});
