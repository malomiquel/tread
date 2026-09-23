import { ScrollView, StyleSheet } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { useStrings } from "@/lib/i18n";
import { setUnitChoice, useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";
import { UNIT_CHOICES, unitChoiceWords } from "@/lib/unitChoice";

/**
 * Kilometres or miles.
 *
 * The phone's region by default. The change is immediate and touches nothing
 * stored: every run ever recorded is shown again in the new units.
 */
export default function UnitSettings() {
  const s = useStrings(unitChoiceWords);
  const settings = useSettings();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup footer={s.footer}>
        {UNIT_CHOICES.map((choice) => (
          <SettingRow
            key={choice}
            label={s.names[choice]}
            detail={s.details[choice]}
            selected={settings.units === choice}
            onPress={() => void setUnitChoice(choice)}
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
