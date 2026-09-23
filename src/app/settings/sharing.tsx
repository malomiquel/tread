import { ScrollView, StyleSheet } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { defineStrings, useStrings } from "@/lib/i18n";
import { PRIVACY_RADII, radiusLabel } from "@/lib/privacy";
import { setPrivacyRadius, useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";
import { useUnitSystem } from "@/lib/units";

const sharingStrings = defineStrings({
  fr: {
    title: "Masquer le départ et l'arrivée",
    off: "Ne rien masquer",
    around: (radius: string) => `Dans un rayon de ${radius}`,
    footer: "Sur les images et les GIF que tu partages, le tracé est coupé près de l'endroit où tu pars et où tu t'arrêtes — souvent ta porte. La distance et le temps affichés restent ceux de toute la course. Si toute la course tient dans ce rayon, le partage d'image est désactivé.",
  },
  en: {
    title: "Hide the start and finish",
    off: "Hide nothing",
    around: (radius: string) => `Within ${radius}`,
    footer: "On the pictures and GIFs you share, the track is cut near where you set off and where you stop — often your front door. The distance and time shown are still the whole run's. If the whole run fits inside the radius, image sharing is turned off.",
  },
});

/**
 * How much of a shared track is kept off the picture.
 *
 * On by default, at a small radius: somebody who shares a run rarely means
 * to share where they live, and would only find out afterwards.
 */
export default function SharingSettings() {
  const s = useStrings(sharingStrings);
  const { privacyRadiusM } = useSettings();
  // The radii are said in the chosen units, so a change of units redraws them.
  useUnitSystem();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup title={s.title} footer={s.footer}>
        {PRIVACY_RADII.map((radius) => (
          <SettingRow
            key={radius}
            label={radius === 0 ? s.off : s.around(radiusLabel(radius))}
            selected={privacyRadiusM === radius}
            onPress={() => void setPrivacyRadius(radius)}
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
