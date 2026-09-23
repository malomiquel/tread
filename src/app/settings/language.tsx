import { ScrollView, StyleSheet } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { defineStrings, useStrings } from "@/lib/i18n";
import { LANGUAGE_CHOICES, LANGUAGE_NAMES } from "@/lib/language";
import { setLanguageChoice, useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";

const languageStrings = defineStrings({
  fr: {
    auto: "Automatique",
    autoDetail: "Suit la langue du téléphone",
  },
  en: {
    auto: "Automatic",
    autoDetail: "Follows your phone's language",
  },
});

/**
 * Which language the app speaks.
 *
 * The phone's, by default, and that is the right answer for nearly
 * everybody. The two others are for the runner whose phone speaks one
 * language and whose running is done in the other. The change is immediate:
 * this very page redraws in the language just chosen.
 */
export default function LanguageSettings() {
  const s = useStrings(languageStrings);
  const settings = useSettings();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup>
        {LANGUAGE_CHOICES.map((choice) => (
          <SettingRow
            key={choice}
            label={choice === "auto" ? s.auto : LANGUAGE_NAMES[choice]}
            detail={choice === "auto" ? s.autoDetail : undefined}
            selected={settings.language === choice}
            onPress={() => void setLanguageChoice(choice)}
          />
        ))}
      </SettingsGroup>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
});
