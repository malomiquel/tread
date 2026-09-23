import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { HeaderButton } from "@/components/HeaderButton";
import { RunShape } from "@/components/RunShape";
import { SectionHeader } from "@/components/SectionHeader";
import { BannerTag, bannerText, SummaryBanner } from "@/components/SummaryBanner";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { deleteRun, listRuns, planSessionOfRun, type Run } from "@/lib/db";
import { importRunFiles } from "@/lib/files";
import { formatDate, formatDistance, formatDuration, formatPace } from "@/lib/format";
import { forgetRunInHealth } from "@/lib/health";
import { defineStrings, intlLocale, plural, useStrings } from "@/lib/i18n";
import { useTabBarSpace } from "@/lib/layout";
import { kindName, sessionKind } from "@/lib/plan";
import { byMonth, monthSummary, type MonthGroup } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import { distanceUnit, paceUnit } from "@/lib/units";
import { chooseSession } from "@/lib/tracker";
import { formatTemperature, weatherIcon } from "@/lib/weather";

const historyStrings = defineStrings({
  fr: {
    title: "Historique",
    summary: (count: number, km: string) => `${plural(count, "course", "courses")} · ${km} ${distanceUnit()} au total`,
    importDone: "Import terminé",
    importFailed: "Import impossible",
    unexpectedError: "Erreur inattendue.",
    deleteTitle: "Supprimer cette course ?",
    defaultRunName: "Course",
    deleteBody: "Ses points GPS seront effacés et l'action est définitive.",
    deleteLinked: " La séance correspondante redeviendra à faire dans ton programme.",
    cancel: "Annuler",
    delete: "Supprimer",
    runNow: "Courir maintenant",
    runNowDetail: "Une sortie libre, avec une séance ou un parcours si tu veux.",
    importing: "Import…",
    importFromApp: "Importer depuis une autre app",
    importShort: "Importer",
    importHint: "Depuis Strava, Garmin ou une montre, en fichiers GPX.",
    thisRun: "cette course",
    thisMonth: "Ce mois-ci",
    monthRuns: (count: number, time: string) => `${plural(count, "course", "courses")} · ${time}`,
    nothingYet: "Pas encore de course ce mois-ci",
    lastMonth: (month: string, km: string) => `${month} : ${km} ${distanceUnit()}`,
    monthTotal: (km: string, count: number) => `${km} ${distanceUnit()} · ${count}`,
  },
  en: {
    title: "History",
    summary: (count: number, km: string) => `${plural(count, "run", "runs")} · ${km} ${distanceUnit()} in total`,
    importDone: "Import complete",
    importFailed: "Import failed",
    unexpectedError: "Unexpected error.",
    deleteTitle: "Delete this run?",
    defaultRunName: "Run",
    deleteBody: "Its GPS points will be erased, and this cannot be undone.",
    deleteLinked: " The matching session will be back on your training plan.",
    cancel: "Cancel",
    delete: "Delete",
    runNow: "Run now",
    runNowDetail: "A free run, with a session or a route if you like.",
    importing: "Importing…",
    importFromApp: "Import from another app",
    importShort: "Import",
    importHint: "From Strava, Garmin or a watch, as GPX files.",
    thisRun: "this run",
    thisMonth: "This month",
    monthRuns: (count: number, time: string) => `${plural(count, "run", "runs")} · ${time}`,
    nothingYet: "No runs this month yet",
    lastMonth: (month: string, km: string) => `${month}: ${km} ${distanceUnit()}`,
    monthTotal: (km: string, count: number) => `${km} ${distanceUnit()} · ${count}`,
  },
});

export default function HistoryScreen() {
  /**
   * Tapping the section you are already in walks back to the top.
   *
   * The navigator emits a press even when the tab is already the one showing,
   * and this hook is what listens for it. Without it that tap does nothing at
   * all, which reads as the app having missed the finger rather than as
   * having nothing to do.
   */
  const s = useStrings(historyStrings);
  const list = useRef<SectionList<Run, MonthGroup>>(null);
  useScrollToTop(list);

  const [runs, setRuns] = useState<Run[] | null>(null);
  /** When the list was read: the month banner is about that moment. */
  const [readAt, setReadAt] = useState(() => Date.now());
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();
  const [importing, setImporting] = useState(false);

  const reload = useCallback(() => listRuns().then(setRuns).catch(() => setRuns([])), []);

  // Reload whenever the tab regains focus: a run may have just finished.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listRuns()
        .then((rows) => {
          if (!active) return;
          setRuns(rows);
          setReadAt(Date.now());
        })
        .catch(() => {
          if (active) setRuns([]);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  /**
   * The row leaves the list at once, then the database catches up. Waiting for
   * the write would leave the row sitting there after the tap, which reads as
   * a broken button.
   */
  async function remove(run: Run) {
    setRuns((current) => (current ?? []).filter((item) => item.id !== run.id));
    try {
      // Removes the copy in Apple Health too, so that throwing a run away here
      // does not leave a ghost of it there. Best effort, and silent.
      await forgetRunInHealth(run);
      await deleteRun(run.id);
    } catch {
      // The delete failed, so put the run back rather than pretend otherwise.
      await reload();
    }
  }

  /**
   * Runs from another app, offered where it matters most: on an empty
   * history, to somebody who did not start running the day they installed
   * this one. Also in Réglages › Données, for later.
   */
  async function importGpx() {
    if (importing) return;
    setImporting(true);
    try {
      const summary = await importRunFiles();
      if (summary === null) return;
      await reload();
      Alert.alert(historyStrings().importDone, summary);
    } catch (cause) {
      const text = historyStrings();
      Alert.alert(text.importFailed, cause instanceof Error ? cause.message : text.unexpectedError);
    } finally {
      setImporting(false);
    }
  }

  const totalM = (runs ?? []).reduce((total, run) => total + run.distanceM, 0);
  const sections = byMonth(runs ?? []).map((group) => ({ ...group, data: group.runs }));

  /**
   * Arm the deletion, and find out what else it would take with it.
   *
   * Asked here rather than in the dialog because the answer decides what the
   * dialog says, and a warning that appears a moment after the question is a
   * warning nobody reads.
   */
  async function askDelete(run: Run) {
    // Asked before the alert rather than after it, so the warning is complete
    // the first time anybody reads it.
    const linked = await planSessionOfRun(run.id).catch(() => null);
    const text = historyStrings();
    Alert.alert(
      text.deleteTitle,
      `${run.name ?? text.defaultRunName}, ${formatDistance(run.distanceM)} ${distanceUnit()}. `
      + text.deleteBody
      + (linked ? text.deleteLinked : ""),
      [
        { text: text.cancel, style: "cancel" },
        { text: text.delete, style: "destructive", onPress: () => void remove(run) },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* The page arrives rather than appearing: coming from a screen that
          just slid its own furniture away, a list that simply exists in the
          next frame reads as a cut. */}
      {/* A plain view. The tab itself cross-fades this screen in, and a
          second opacity animation on top of that one was not a second effect
          but a second chance to fail: when the inner fade did not run to
          completion the screen stayed at zero, which is the white page that
          appeared on some tab changes and not others. */}
      <View style={styles.fill}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{s.title}</Text>
          {runs && runs.length > 0 && (
            <Text style={styles.subtitle}>
              {s.summary(runs.length, formatDistance(totalM))}
            </Text>
          )}
        </View>
        {/* Runs from another app, once there already are some here. Said in
            words, like the routes' "New": an arrow on its own read as
            "download" to everybody but whoever drew it. On an empty history
            the import card below does this job instead. */}
        {runs && runs.length > 0 ? (
          <HeaderButton
            icon="download-outline"
            label={s.importShort}
            accessibilityLabel={s.importFromApp}
            busy={importing}
            onPress={() => void importGpx()}
          />
        ) : null}
      </View>

      <SectionList
        ref={list}
        sections={sections}
        keyExtractor={(run) => String(run.id)}
        stickySectionHeadersEnabled
        // Room for the bar and for the button floating above it, so the last
        // run in the list is never sitting underneath either of them.
        contentContainerStyle={{ paddingBottom: tabBarSpace + 60 }}
        ListHeaderComponent={
          runs && runs.length > 0 ? <MonthBanner runs={runs} now={readAt} /> : null
        }
        ListEmptyComponent={
          runs === null ? null : (
            <EmptyState
              actions={[
                {
                  icon: "play",
                  title: s.runNow,
                  detail: s.runNowDetail,
                  primary: true,
                  onPress: () => {
                    chooseSession(null);
                    router.push("/record");
                  },
                },
                {
                  icon: "download-outline",
                  title: importing ? s.importing : s.importFromApp,
                  detail: s.importHint,
                  busy: importing,
                  onPress: () => void importGpx(),
                },
              ]}
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={monthName(section.start, readAt)}
            aside={s.monthTotal(formatDistance(section.distanceM), section.runs.length)}
          />
        )}
        renderItem={({ item, index }) => (
          <SwipeToDelete label={item.name ?? s.thisRun} onDelete={() => void askDelete(item)}>
            <RunRow
              run={item}
              first={index === 0}
              onPress={() => router.push({ pathname: "/run/[id]", params: { id: String(item.id) } })}
            />
          </SwipeToDelete>
        )}
      />
      </View>
    </SafeAreaView>
  );
}

/** "Septembre", or "Septembre 2025" once it is not this year's. */
function monthName(start: number, now: number): string {
  const date = new Date(start);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const name = date.toLocaleDateString(intlLocale(), sameYear ? { month: "long" } : { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The month so far, in the app's colour, above everything else.
 *
 * The one place the history speaks before it lists: how far this month has
 * gone, and how that stands against the last one — which is the question a
 * runner opening their history is usually asking.
 */
function MonthBanner({ runs, now }: { runs: Run[]; now: number }) {
  const s = useStrings(historyStrings);
  const { current, previous } = monthSummary(runs, now);
  const ahead = current.distanceM >= previous.distanceM;
  return (
    <SummaryBanner
      label={s.thisMonth}
      value={current.runs > 0 ? formatDistance(current.distanceM) : "0"}
      unit={distanceUnit()}
      detail={current.runs > 0
        ? s.monthRuns(current.runs, formatDuration(current.durationS))
        : s.nothingYet}
    >
      {previous.distanceM > 0 ? (
        <BannerTag>
          <Ionicons
            name={ahead ? "trending-up" : "trending-down"}
            size={16}
            color={colors.accentText}
          />
          <Text style={bannerText.tag}>
            {s.lastMonth(monthName(previous.start, now), formatDistance(previous.distanceM))}
          </Text>
        </BannerTag>
      ) : null}
    </SummaryBanner>
  );
}

/**
 * One run: its shape, what it was, and how far.
 *
 * The shape on the left is what the eye finds first — people know their
 * loops by their outline. The weather and the session it followed sit under
 * the name as small marks of colour, there only when there is something to
 * say.
 */
function RunRow({ run, first, onPress }: { run: Run; first: boolean; onPress: () => void }) {
  const kind = sessionKind(run.sessionId);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <RunShape runId={run.id} />
      <View style={[styles.rowBody, !first && styles.rowRule]}>
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>{run.name ?? formatDate(run.startedAt)}</Text>
          <Text style={styles.when} numberOfLines={1}>{formatDate(run.startedAt)}</Text>
          {run.weather || kind ? (
            <View style={styles.marks}>
              {run.weather ? (
                <View style={styles.mark}>
                  <Ionicons
                    name={weatherIcon(run.weather.code, run.weather.day)}
                    size={13}
                    color={colors.muted}
                  />
                  <Text style={styles.markText}>{formatTemperature(run.weather.temperatureC)}</Text>
                </View>
              ) : null}
              {kind ? (
                <View style={[styles.chip, kind === "race" && styles.chipRace]}>
                  <Text style={[styles.chipText, kind === "race" && styles.chipRaceText]}>
                    {kindName(kind)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.figures}>
          <Text style={styles.distance}>
            {formatDistance(run.distanceM)}
            <Text style={styles.km}> {distanceUnit()}</Text>
          </Text>
          <Text style={styles.pace}>{formatPace(run.avgPaceSKm)} {paceUnit()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
    paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 14,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 32, fontFamily: font.bold, letterSpacing: -0.6 },
  subtitle: { color: colors.subtle, fontFamily: font.regular, fontSize: 15, marginTop: 3 },


  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingLeft: GUTTER,
    // Opaque on purpose: the delete action sits behind the row, and a
    // transparent background would let its red show through.
    backgroundColor: colors.background,
  },
  pressed: { backgroundColor: colors.sunken },
  // The rule starts after the shape, so the shapes read as one column.
  rowBody: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingRight: GUTTER,
  },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 18.5, fontFamily: font.semibold, letterSpacing: -0.2 },
  when: { color: colors.subtle, fontSize: 14 },
  marks: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  mark: { flexDirection: "row", alignItems: "center", gap: 3 },
  markText: { color: colors.muted, fontSize: 13.5, fontFamily: font.medium },
  chip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: colors.accentSoft,
  },
  chipText: { color: colors.accent, fontSize: 12.5, fontFamily: font.semibold },
  chipRace: { backgroundColor: colors.warning },
  chipRaceText: { color: colors.accentText },
  figures: { alignItems: "flex-end", gap: 1 },
  distance: {
    color: colors.text, fontSize: 27, fontFamily: font.semibold,
    letterSpacing: -0.8, fontVariant: ["tabular-nums"],
  },
  km: { color: colors.subtle, fontSize: 14, fontFamily: font.semibold, letterSpacing: 0 },
  pace: { color: colors.muted, fontSize: 14, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
});
