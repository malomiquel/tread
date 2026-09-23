import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { defineStrings, useStrings } from "@/lib/i18n";
import { LANGUAGE_NAMES } from "@/lib/language";
import { reminderName } from "@/lib/reminders";
import { toggleVoice, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

const settingsStrings = defineStrings({
  fr: {
    run: "Course",
    voice: "Annonces vocales",
    voiceDetail: "Chaque kilomètre, les écarts d'allure et les blocs de séance, à voix haute",
    language: "Langue",
    languageAuto: "Automatique",
    notifications: "Notifications",
    notificationsDetail: "Un rappel avant chaque séance du programme",
    data: "Données",
    importExport: "Importer et exporter",
    importExportDetail: "Fichiers GPX, depuis ou vers une autre app",
    transfer: "Changer de téléphone",
    transferDetail: "Tout emporter sur un nouveau téléphone",
    about: "À propos",
    aboutDetail: "Version, confidentialité, sources des données",
  },
  en: {
    run: "Running",
    voice: "Voice announcements",
    voiceDetail: "Every kilometre, pace drift and workout blocks, read out loud",
    language: "Language",
    languageAuto: "Automatic",
    notifications: "Notifications",
    notificationsDetail: "A reminder before every session of your plan",
    data: "Data",
    importExport: "Import and export",
    importExportDetail: "GPX files, from or to another app",
    transfer: "Switch phones",
    transferDetail: "Bring everything over to a new phone",
    about: "About",
    aboutDetail: "Version, privacy, data sources",
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/*
        * Grouped by subject rather than listed, so that every setting added
        * later has a place it obviously belongs.
        *
        * The weekly goal is not here: it lives on the week it measures, in
        * the profile, and a second door to it here was a second place to
        * wonder which one was the real one.
        */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{s.run}</Text>
        {/* Also on the running screen, where it is changed mid-run. Here as
            well because this is where anybody looking for it looks first. */}
        <SettingRow
          label={s.voice}
          detail={s.voiceDetail}
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
          label={s.language}
          value={settings.language === "auto" ? s.languageAuto : LANGUAGE_NAMES[settings.language]}
          onPress={() => router.push("/settings/language")}
        />
        <SettingRow
          label={s.notifications}
          detail={s.notificationsDetail}
          value={reminderName(settings.reminder)}
          onPress={() => router.push("/settings/notifications")}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{s.data}</Text>
        <SettingRow
          label={s.importExport}
          detail={s.importExportDetail}
          onPress={() => router.push("/settings/data")}
        />
        <SettingRow
          label={s.transfer}
          detail={s.transferDetail}
          onPress={() => router.push("/settings/transfer")}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Tread</Text>
        <SettingRow
          label={s.about}
          detail={s.aboutDetail}
          onPress={() => router.push("/settings/about")}
        />
      </View>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  // Sections run edge to edge, told apart by a rule rather than by floating
  // on their own surface, as everywhere else in the app.
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
