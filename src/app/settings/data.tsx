import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { exportRunArchive, importRouteFiles, importRunFiles } from "@/lib/files";
import { healthAvailable } from "@/lib/health";
import { enableHealthImport } from "@/lib/healthSync";
import { useSettings } from "@/lib/settings";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";

type Job = "runs" | "routes" | "export";

const dataStrings = defineStrings({
  fr: {
    nothingToExport: "Rien à exporter",
    noRunsYet: "Aucune course enregistrée pour l'instant.",
    failed: "Opération impossible",
    unexpected: "Erreur inattendue.",
    lede:
      "Tes courses et tes parcours sont enregistrés sur ce téléphone, sans compte ni serveur Tread.",
    backupIos:
      "Ils font partie de la sauvegarde iCloud de ton iPhone, si elle est activée : sur un nouvel iPhone, restaure-la et tout revient. Supprimer l'app, elle, les efface.",
    backupAndroid:
      "Ils font partie de la sauvegarde Google de ton téléphone, si elle est activée, sauf les photos des courses, qui ne passent que d'un téléphone à l'autre. Supprimer l'app les efface.",
    import: "Importer",
    watch: "Courses de ta montre",
    watchDetail: "Ramène les courses qu'une Apple Watch ou une autre app a enregistrées dans Santé",
    watchFooter: "Lu sur ce téléphone, dans Santé : rien ne passe par internet. Les nouvelles courses arrivent à chaque ouverture de l'app.",
    watchDone: (count: number) => (count === 0
      ? "Aucune nouvelle course dans Santé pour l'instant."
      : `${plural(count, "course importée", "courses importées")} depuis Santé.`),
    watchTitle: "Courses de ta montre",
    runs: "Des courses",
    runsDetail: "Fichiers GPX exportés de Strava, Garmin, d'une montre ou de Tread",
    routes: "Des parcours",
    routesDetail: "Fichiers GPX d'un planificateur d'itinéraire ou d'un ami",
    importDone: "Import terminé",
    export: "Exporter",
    allRuns: "Toutes mes courses",
    allRunsDetail: "Une archive de fichiers GPX, lisible par n'importe quelle app de course",
    exportReady: "Export prêt",
    transfer: "Changer de téléphone",
    transferDetail: "Tout emporter d'un coup : courses, parcours, programme et réglages",
  },
  en: {
    nothingToExport: "Nothing to export",
    noRunsYet: "No runs recorded yet.",
    failed: "Something went wrong",
    unexpected: "Unexpected error.",
    lede:
      "Your runs and routes are stored on this phone, with no account and no Tread server.",
    backupIos:
      "They are part of your iPhone's iCloud backup, if it is on: restore it on a new iPhone and everything comes back. Deleting the app erases them.",
    backupAndroid:
      "They are part of your phone's Google backup, if it is on, except run photos, which only travel phone to phone. Deleting the app erases them.",
    import: "Import",
    watch: "Runs from your watch",
    watchDetail: "Brings in the runs an Apple Watch or another app wrote to Health",
    watchFooter: "Read on this phone, from Health: nothing goes over the internet. New runs arrive each time the app opens.",
    watchDone: (count: number) => (count === 0
      ? "No new runs in Health yet."
      : `${plural(count, "run", "runs")} imported from Health.`),
    watchTitle: "Runs from your watch",
    runs: "Runs",
    runsDetail: "GPX files exported from Strava, Garmin, a watch or Tread",
    routes: "Routes",
    routesDetail: "GPX files from a route planner or a friend",
    importDone: "Import complete",
    export: "Export",
    allRuns: "All my runs",
    allRunsDetail: "An archive of GPX files that any running app can read",
    exportReady: "Export ready",
    transfer: "Switch phones",
    transferDetail: "Bring everything over at once: runs, routes, plan and settings",
  },
});

/**
 * Everything that goes in or out as a file.
 *
 * These were icons in the headers of the history and the routes, without a
 * word beside them: an arrow pointing down that meant "import" to whoever
 * drew it and "download" to everybody else. Here each one says what it does,
 * and where the data lives is said once, plainly, above them.
 */
export default function DataSettings() {
  const settings = useSettings();
  const router = useRouter();
  const [busy, setBusy] = useState<Job | null>(null);
  const s = useStrings(dataStrings);

  async function run(job: Job, title: string, task: () => Promise<string | null>) {
    if (busy) return;
    setBusy(job);
    try {
      const summary = await task();
      if (summary !== null) Alert.alert(title, summary);
      else if (job === "export") Alert.alert(s.nothingToExport, s.noRunsYet);
    } catch (cause) {
      Alert.alert(s.failed, cause instanceof Error ? cause.message : s.unexpected);
    } finally {
      setBusy(null);
    }
  }

  const spinner = (job: Job) =>
    busy === job ? <ActivityIndicator size="small" color={colors.accent} /> : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>{`${s.lede} ${Platform.OS === "ios" ? s.backupIos : s.backupAndroid}`}</Text>

      {/* The one import that keeps itself going: Health is on the same phone. */}
      {healthAvailable() ? (
        <SettingsGroup footer={s.watchFooter}>
          <SettingRow
            icon="watch-outline"
            label={s.watch}
            detail={s.watchDetail}
            right={
              <Switch
                value={settings.healthImport}
                onValueChange={(on) => {
                  void enableHealthImport(on).then((count) => {
                    if (on) Alert.alert(s.watchTitle, s.watchDone(count));
                  });
                }}
                trackColor={{ true: colors.accent, false: colors.hairline }}
                accessibilityLabel={s.watch}
              />
            }
          />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title={s.import}>
        <SettingRow
          icon="walk-outline"
          label={s.runs}
          detail={s.runsDetail}
          right={spinner("runs")}
          onPress={() => void run("runs", s.importDone, importRunFiles)}
        />
        <SettingRow
          icon="map-outline"
          label={s.routes}
          detail={s.routesDetail}
          right={spinner("routes")}
          onPress={() => void run("routes", s.importDone, importRouteFiles)}
        />
      </SettingsGroup>

      <SettingsGroup title={s.export}>
        <SettingRow
          icon="share-outline"
          label={s.allRuns}
          detail={s.allRunsDetail}
          right={spinner("export")}
          onPress={() => void run("export", s.exportReady, exportRunArchive)}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          icon="phone-portrait-outline"
          label={s.transfer}
          detail={s.transferDetail}
          onPress={() => router.push("/settings/transfer")}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 21,
    paddingHorizontal: GUTTER, paddingTop: 16,
  },
});
