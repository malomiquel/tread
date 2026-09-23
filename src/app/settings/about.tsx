import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, Text } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { buildLine, currentBuild } from "@/lib/build";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";

const aboutStrings = defineStrings({
  fr: {
    version: "Version",
    privacy: "Confidentialité",
    privacyDetail: "Ce qui reste sur ton téléphone, et ce qui en sort",
    method: "Comment les programmes sont construits",
    methodDetail: "Le calcul des séances et des allures",
    sources: "Sources des données",
    routing: "Itinéraires",
    routingDetail: "OSRM, sur les données © contributeurs OpenStreetMap (ODbL)",
    weather: "Météo",
    maps: "Cartes et noms de lieux",
    mapsDetail: "Le service de cartes du téléphone : Plans sur iPhone, Google Maps sur Android",
  },
  en: {
    version: "Version",
    privacy: "Privacy",
    privacyDetail: "What stays on your phone, and what leaves it",
    method: "How training plans are built",
    methodDetail: "How sessions and paces are worked out",
    sources: "Data sources",
    routing: "Routing",
    routingDetail: "OSRM, on data © OpenStreetMap contributors (ODbL)",
    weather: "Weather",
    maps: "Maps and place names",
    mapsDetail: "Your phone's map service: Apple Maps on iPhone, Google Maps on Android",
  },
});

/**
 * What the app is, where its data comes from, and what it does with yours.
 *
 * The credits are not decoration. The street data under every route drawn
 * here is OpenStreetMap's, and the forecasts are Open-Meteo's; both licences
 * ask to be named wherever their data is shown.
 */
export default function AboutScreen() {
  const router = useRouter();
  const build = currentBuild();
  const s = useStrings(aboutStrings);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup>
        <SettingRow icon="information-circle-outline" label={s.version} value={`${build.version} (${build.buildNumber})`} />
        <SettingRow
          icon="lock-closed-outline"
          label={s.privacy}
          detail={s.privacyDetail}
          onPress={() => router.push("/settings/privacy")}
        />
        <SettingRow
          icon="book-outline"
          label={s.method}
          detail={s.methodDetail}
          onPress={() => router.push("/plan-method")}
        />
      </SettingsGroup>

      <SettingsGroup title={s.sources}>
        <SettingRow
          icon="navigate-outline"
          label={s.routing}
          detail={s.routingDetail}
          onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}
        />
        <SettingRow
          icon="partly-sunny-outline"
          label={s.weather}
          detail="Open-Meteo.com (CC BY 4.0)"
          onPress={() => void Linking.openURL("https://open-meteo.com/")}
        />
        <SettingRow
          icon="map-outline"
          label={s.maps}
          detail={s.mapsDetail}
        />
      </SettingsGroup>

      {/* The exact build, small, for whoever is asked "which version do you
          have?" and needs an answer that names the source it came from. */}
      <Text style={styles.build}>{buildLine(build)}</Text>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  build: {
    color: colors.subtle, fontSize: 12, fontFamily: font.regular,
    textAlign: "center", paddingTop: 22, fontVariant: ["tabular-nums"],
  },
});
