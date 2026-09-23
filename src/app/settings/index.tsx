import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Switch } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { WeeklyGoalSheet } from "@/components/WeeklyGoalSheet";
import { currentBuild } from "@/lib/build";
import { listRuns, listShoes } from "@/lib/db";
import { defineStrings, useStrings } from "@/lib/i18n";
import { LANGUAGE_NAMES } from "@/lib/language";
import { radiusLabel } from "@/lib/privacy";
import { reminderName } from "@/lib/reminders";
import { runnerWords } from "@/lib/runner";
import { unitChoiceWords } from "@/lib/unitChoice";
import { forgetWelcome, toggleAutoPause, toggleVoice, useSettings, weeklyGoal } from "@/lib/settings";
import { goalAmount } from "@/lib/goals";
import { suggestedWeeklyGoalM } from "@/lib/stats";
import { colors } from "@/lib/theme";

const settingsStrings = defineStrings({
  fr: {
    training: "Entraînement",
    weeklyGoal: "Objectif hebdomadaire",
    noGoal: "Aucun",
    reminders: "Rappels de séance",
    shoes: "Chaussures",
    noShoe: "Aucune",
    runner: "Mon profil de coureur",
    runnerUnset: "À définir",
    running: "Pendant la course",
    voice: "Annonces vocales",
    autoPause: "Pause automatique",
    runningFooter: "Les annonces disent chaque kilomètre (ou mile), les écarts d'allure et les blocs de séance. La pause automatique arrête le chrono après dix secondes à l'arrêt, et le relance quand tu repars.",
    app: "Application",
    language: "Langue",
    units: "Unités",
    languageAuto: "Automatique",
    sharing: "Partage",
    hideEnds: "Masquer départ et arrivée",
    hideNothing: "Non",
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
    reminders: "Session reminders",
    shoes: "Shoes",
    noShoe: "None",
    runner: "My runner profile",
    runnerUnset: "Not set",
    running: "While running",
    voice: "Voice announcements",
    autoPause: "Auto-pause",
    runningFooter: "Announcements read out every kilometre (or mile), pace drift and workout blocks. Auto-pause stops the clock after ten seconds standing still, and restarts it when you set off.",
    app: "App",
    language: "Language",
    units: "Units",
    languageAuto: "Automatic",
    sharing: "Sharing",
    hideEnds: "Hide start and finish",
    hideNothing: "Off",
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
  const goal = weeklyGoal(settings);
  const [editingGoal, setEditingGoal] = useState(false);
  /** Their own recent average, so the goal sheet opens on a figure they know. */
  const [suggestedM, setSuggestedM] = useState(5000);
  /** The pair new runs go to, shown on its row. */
  const [shoeName, setShoeName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRuns()
        .then((runs) => {
          if (active) setSuggestedM(suggestedWeeklyGoalM(runs));
        })
        .catch(() => undefined);
      void listShoes()
        .then((shoes) => {
          if (active) setShoeName(shoes.find((shoe) => shoe.isDefault)?.name ?? null);
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
          value={goal === null ? s.noGoal : goalAmount(goal.kind, goal.target)}
          onPress={() => setEditingGoal(true)}
        />
        <SettingRow
          icon="person-circle-outline"
          label={s.runner}
          value={settings.runner === null
            ? s.runnerUnset
            : runnerWords().frequencyShort(settings.runner.perWeek)}
          onPress={() => router.push("/settings/runner")}
        />
        <SettingRow
          icon="footsteps-outline"
          label={s.shoes}
          value={shoeName ?? s.noShoe}
          onPress={() => router.push("/settings/shoes")}
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
      <SettingsGroup title={s.running} footer={s.runningFooter}>
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
        <SettingRow
          icon="pause-circle-outline"
          label={s.autoPause}
          right={
            <Switch
              value={settings.autoPause}
              onValueChange={() => void toggleAutoPause()}
              trackColor={{ true: colors.accent, false: colors.hairline }}
              accessibilityLabel={s.autoPause}
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
        <SettingRow
          icon="speedometer-outline"
          label={s.units}
          value={unitChoiceWords().names[settings.units]}
          onPress={() => router.push("/settings/units")}
        />
      </SettingsGroup>

      <SettingsGroup title={s.sharing}>
        <SettingRow
          icon="eye-off-outline"
          label={s.hideEnds}
          value={settings.privacyRadiusM === 0 ? s.hideNothing : radiusLabel(settings.privacyRadiusM)}
          onPress={() => router.push("/settings/sharing")}
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
