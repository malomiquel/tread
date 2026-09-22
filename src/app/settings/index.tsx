import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { formatDistance } from "@/lib/format";
import { REMINDER_NAMES } from "@/lib/reminders";
import { useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

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
  const router = useRouter();
  const settings = useSettings();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.group}>
        <SettingRow
          label="Notifications"
          detail="Quand le programme te rappelle une séance"
          value={REMINDER_NAMES[settings.reminder]}
          onPress={() => router.push("/settings/notifications")}
        />
        <SettingRow
          label="Transfert"
          detail="Emporter tout sur un autre téléphone"
          onPress={() => router.push("/settings/transfer")}
        />
        <SettingRow
          label="Plan"
          detail="Ce que tu vises, semaine après semaine"
          value={
            settings.weeklyGoalM === null
              ? "Aucun objectif"
              : `${formatDistance(settings.weeklyGoalM)} km / sem.`
          }
          onPress={() => router.push("/settings/plan")}
        />
      </View>

      <Text style={styles.note}>
        Les réglages d&apos;une course — la voix, l&apos;allure à tenir — restent sur
        l&apos;écran de course, là où ils se décident.
      </Text>
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
    paddingHorizontal: GUTTER, paddingVertical: 6, marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  note: {
    color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: GUTTER, paddingTop: 16,
  },
});
