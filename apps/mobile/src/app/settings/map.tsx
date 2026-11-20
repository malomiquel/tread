import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { listRoutes } from "@/lib/db";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { formatBytes } from "@tread/core/tiles";
import {
  clearTileCache, deleteArea, MAP_BACKGROUNDS, mapBackgroundWords, tileCacheBytes, useOfflineAreas,
  type OfflineArea,
} from "@/lib/offlineMap";
import { setMapBackground, useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";

const mapStrings = defineStrings({
  fr: {
    background: "Fond de carte",
    backgroundFooter: "La carte IGN dessine les sentiers et le relief. Elle couvre la France, outre-mer compris ; ailleurs, la carte d'Apple reste dessous. Carte © IGN, licence ouverte Etalab.",
    offline: "Cartes hors ligne",
    none: "Aucune carte gardée",
    goneRoute: "Parcours supprimé",
    incomplete: "incomplète",
    stored: "Espace utilisé",
    clear: "Tout supprimer",
    offlineFooter: "Une carte se garde depuis la page d'un parcours, menu ⋯. Les morceaux de carte IGN vus en ligne sont gardés aussi, pour s'afficher sans réseau.",
    deleteTitle: (name: string) => `Supprimer la carte de « ${name} » ?`,
    deleteBody: "Le parcours reste. Tu pourras la télécharger à nouveau.",
    clearTitle: "Supprimer toutes les cartes IGN ?",
    clearBody: "Les cartes gardées et celles vues en ligne. Sans réseau, plus rien ne s'affichera avant un nouveau téléchargement.",
    cancel: "Annuler",
    delete: "Supprimer",
  },
  en: {
    background: "Map background",
    backgroundFooter: "The IGN map draws trails and relief. It covers France, overseas included; elsewhere, Apple's map stays underneath. Map © IGN, Etalab open licence.",
    offline: "Offline maps",
    none: "No maps kept",
    goneRoute: "Deleted route",
    incomplete: "incomplete",
    stored: "Space used",
    clear: "Delete everything",
    offlineFooter: "Keep a map from a route's page, in its ⋯ menu. Pieces of the IGN map seen online are kept too, so they show without signal.",
    deleteTitle: (name: string) => `Delete the map of "${name}"?`,
    deleteBody: "The route stays. You can download it again.",
    clearTitle: "Delete every IGN map?",
    clearBody: "The maps kept and the ones seen online. Without signal, nothing will show until you download again.",
    cancel: "Cancel",
    delete: "Delete",
  },
});

/**
 * Which map every map is drawn on, and the IGN maps kept on the phone.
 *
 * The kept maps are listed here as well as on their routes, because this is
 * where somebody short of space comes looking for what takes it.
 */
export default function MapSettings() {
  const s = useStrings(mapStrings);
  const names = useStrings(mapBackgroundWords);
  const settings = useSettings();
  const areas = useOfflineAreas();
  const [routeNames, setRouteNames] = useState<Map<number, string>>(new Map());
  const [bytes, setBytes] = useState<number | null>(null);

  const measure = useCallback(() => {
    // After the page has drawn: summing thousands of files takes a moment.
    setTimeout(() => setBytes(tileCacheBytes()), 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRoutes()
        .then((routes) => {
          if (active) setRouteNames(new Map(routes.map((route) => [route.id, route.name])));
        })
        .catch(() => undefined);
      measure();
      return () => { active = false; };
    }, [measure]),
  );

  const nameOf = (area: OfflineArea) => routeNames.get(area.routeId) ?? s.goneRoute;

  const askDelete = (area: OfflineArea) => {
    Alert.alert(s.deleteTitle(nameOf(area)), s.deleteBody, [
      { text: s.cancel, style: "cancel" },
      {
        text: s.delete,
        style: "destructive",
        onPress: () => void deleteArea(area.routeId).then(measure),
      },
    ]);
  };

  const askClear = () => {
    Alert.alert(s.clearTitle, s.clearBody, [
      { text: s.cancel, style: "cancel" },
      {
        text: s.delete,
        style: "destructive",
        onPress: () => {
          clearTileCache();
          measure();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SettingsGroup title={s.background} footer={s.backgroundFooter}>
        {MAP_BACKGROUNDS.map((background) => (
          <SettingRow
            key={background}
            label={names.names[background]}
            detail={names.details[background]}
            selected={settings.mapBackground === background}
            onPress={() => void setMapBackground(background)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title={s.offline} footer={s.offlineFooter}>
        {areas.length === 0 ? <SettingRow icon="cloud-offline-outline" label={s.none} /> : null}
        {areas.map((area) => (
          <SettingRow
            key={area.routeId}
            icon="map-outline"
            label={nameOf(area)}
            detail={area.complete ? undefined : s.incomplete}
            value={formatBytes(area.bytes)}
            onPress={() => askDelete(area)}
          />
        ))}
        <SettingRow
          icon="server-outline"
          label={s.stored}
          value={bytes === null ? "…" : formatBytes(bytes)}
        />
        <SettingRow label={s.clear} destructive onPress={askClear} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
});
