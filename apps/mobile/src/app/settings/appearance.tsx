import { ScrollView, StyleSheet } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { APPEARANCE_CHOICES, appearanceWords } from "@/lib/appearance";
import { useStrings } from "@tread/core/i18n";
import { setAppearanceChoice, useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";

/**
 * Light or dark.
 *
 * The phone's appearance by default. The change is immediate: this very page
 * redraws in the appearance just chosen.
 */
export default function AppearanceSettings() {
  const s = useStrings(appearanceWords);
  const settings = useSettings();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup>
        {APPEARANCE_CHOICES.map((choice) => (
          <SettingRow
            key={choice}
            label={s.names[choice]}
            detail={s.details[choice]}
            selected={settings.appearance === choice}
            onPress={() => void setAppearanceChoice(choice)}
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
