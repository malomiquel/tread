import { useMemo } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import {
  formatBytes, ignCoversBox, MAX_TILES_PER_AREA, OFFLINE_MIN_ZOOM, planDownload, rangesCover, tileCount,
} from "@tread/core/tiles";
import {
  cancelDownload, deleteArea, dismissDownload, downloadArea, useDownload, useOfflineAreas, useOnline,
} from "@/lib/offlineMap";
import { setMapBackground, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

const sheetStrings = defineStrings({
  fr: {
    title: "Carte hors ligne",
    lede: (maxZoom: number) =>
      `La carte IGN autour du parcours, avec un kilomètre de marge, du zoom ${OFFLINE_MIN_ZOOM} au ${maxZoom} : de quoi courir sans réseau.`,
    size: (tiles: string, size: string) => `${tiles} tuiles · environ ${size}`,
    switchToIgn: "Toutes les cartes passeront sur le fond IGN.",
    needNetwork: "Il faut du réseau pour télécharger la carte.",
    otherRunning: "Une autre carte se télécharge déjà.",
    changed: "Le parcours a changé depuis le dernier téléchargement.",
    missing: (n: string) => `${n} tuiles n'ont pas pu être récupérées. Relance pour les chercher.`,
    stopped: "Téléchargement arrêté. Relance pour le terminer.",
    download: "Télécharger",
    resume: "Reprendre",
    downloading: "Téléchargement de la carte. Tu peux fermer, il continue.",
    progress: (done: string, total: string) => `${done} / ${total} tuiles`,
    stop: "Arrêter",
    kept: (size: string, day: string) => `Gardée sur ce téléphone : ${size}, depuis le ${day}.`,
    keptHint: "Sans réseau, les cartes du parcours la montrent d'elles-mêmes.",
    close: "Fermer",
    delete: "Supprimer la carte",
    deleteTitle: "Supprimer la carte hors ligne ?",
    deleteBody: "Le parcours reste. Tu pourras la télécharger à nouveau.",
    cancel: "Annuler",
    confirmDelete: "Supprimer",
    empty: "Trace d'abord un parcours : la carte se télécharge autour de lui.",
    outside: "La carte IGN couvre la France seulement, et ce parcours est ailleurs.",
    tooLarge: (tiles: string, cap: string) =>
      `Ce parcours est trop étendu pour une seule carte : ${tiles} tuiles, la limite est de ${cap}.`,
  },
  en: {
    title: "Offline map",
    lede: (maxZoom: number) =>
      `The IGN map around the route, with a kilometre to spare, from zoom ${OFFLINE_MIN_ZOOM} to ${maxZoom}: enough to run without signal.`,
    size: (tiles: string, size: string) => `${tiles} tiles · about ${size}`,
    switchToIgn: "Every map will switch to the IGN background.",
    needNetwork: "You need a connection to download the map.",
    otherRunning: "Another map is already downloading.",
    changed: "The route has changed since the last download.",
    missing: (n: string) => `${n} tiles couldn't be fetched. Try again to get them.`,
    stopped: "Download stopped. Start it again to finish it.",
    download: "Download",
    resume: "Resume",
    downloading: "Downloading the map. You can close this, it carries on.",
    progress: (done: string, total: string) => `${done} / ${total} tiles`,
    stop: "Stop",
    kept: (size: string, day: string) => `Kept on this phone: ${size}, since ${day}.`,
    keptHint: "Without signal, the route's maps show it by themselves.",
    close: "Close",
    delete: "Delete the map",
    deleteTitle: "Delete the offline map?",
    deleteBody: "The route stays. You can download it again.",
    cancel: "Cancel",
    confirmDelete: "Delete",
    empty: "Draw a route first: the map is downloaded around it.",
    outside: "The IGN map only covers France, and this route is elsewhere.",
    tooLarge: (tiles: string, cap: string) =>
      `This route spreads too far for one map: ${tiles} tiles, the limit is ${cap}.`,
  },
});

interface Props {
  visible: boolean;
  onClose: () => void;
  routeId: number;
  /** The route's line as drawn, which the map is fetched around. */
  points: readonly { lat: number; lng: number }[];
}

const count = (n: number) => new Intl.NumberFormat(intlLocale()).format(n);

/**
 * Keeping the IGN map of one route on the phone, for running where there is
 * no signal.
 *
 * Says what it will cost before it costs anything — tiles and megabytes —
 * shows the download as it goes, lets it be stopped, and once kept, lets it
 * be thrown away. The download itself belongs to the app, not to this
 * sheet: closing it, or leaving the route, does not stop it.
 */
export function OfflineMapSheet({ visible, onClose, routeId, points }: Props) {
  const s = useStrings(sheetStrings);
  const online = useOnline();
  const settings = useSettings();
  const download = useDownload();
  const area = useOfflineAreas().find((kept) => kept.routeId === routeId) ?? null;
  const plan = useMemo(() => planDownload(points), [points]);

  const mine = download.routeId === routeId;
  const running = mine && download.status === "running";
  const busyElsewhere = download.status === "running" && !mine;

  const close = () => {
    if (!running) dismissDownload();
    onClose();
  };

  const askDelete = () => {
    Alert.alert(s.deleteTitle, s.deleteBody, [
      { text: s.cancel, style: "cancel" },
      { text: s.confirmDelete, style: "destructive", onPress: () => void deleteArea(routeId) },
    ]);
  };

  const start = () => {
    if (plan.kind !== "ok") return;
    if (settings.mapBackground !== "ign") void setMapBackground("ign");
    void downloadArea(routeId, plan.box, plan.ranges);
  };

  let body: React.ReactNode;
  if (running) {
    const share = download.total > 0 ? download.done / download.total : 0;
    body = (
      <>
        <Text style={styles.lede}>{s.downloading}</Text>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: download.total, now: download.done }}
        >
          <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
        </View>
        <Text style={styles.figure}>{s.progress(count(download.done), count(download.total))}</Text>
        <Button label={s.stop} variant="secondary" onPress={() => cancelDownload()} />
      </>
    );
  } else if (plan.kind === "empty") {
    body = <Text style={styles.lede}>{s.empty}</Text>;
  } else if (plan.kind === "tooLarge") {
    body = <Text style={styles.lede}>{s.tooLarge(count(plan.tiles), count(MAX_TILES_PER_AREA))}</Text>;
  } else if (!ignCoversBox(plan.box)) {
    body = <Text style={styles.lede}>{s.outside}</Text>;
  } else if (area && area.complete && rangesCover(area.ranges, plan.ranges)) {
    const day = new Date(area.savedAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long" });
    body = (
      <>
        <Text style={styles.lede}>{s.kept(formatBytes(area.bytes), day)}</Text>
        <Text style={styles.note}>{s.keptHint}</Text>
        <Button label={s.close} variant="secondary" onPress={close} />
        <DeleteLink label={s.delete} onPress={askDelete} />
      </>
    );
  } else {
    const maxZoom = plan.ranges[plan.ranges.length - 1].z;
    const stopped = mine && download.status === "cancelled";
    const missing = area && !area.complete && !stopped
      ? Math.max(0, tileCount(area.ranges) - area.tiles)
      : 0;
    const notes = [
      area && !stopped && missing === 0 && !rangesCover(area.ranges, plan.ranges) ? s.changed : null,
      stopped ? s.stopped : null,
      missing > 0 ? s.missing(count(missing)) : null,
      settings.mapBackground !== "ign" ? s.switchToIgn : null,
      !online ? s.needNetwork : busyElsewhere ? s.otherRunning : null,
    ].filter((note): note is string => note !== null);
    body = (
      <>
        <Text style={styles.lede}>{s.lede(maxZoom)}</Text>
        <Text style={styles.figure}>{s.size(count(plan.tiles), formatBytes(plan.bytes))}</Text>
        {notes.map((note) => <Text key={note} style={styles.note}>{note}</Text>)}
        <Button
          label={area || stopped ? s.resume : s.download}
          onPress={start}
          disabled={!online || busyElsewhere}
        />
        {area ? <DeleteLink label={s.delete} onPress={askDelete} /> : null}
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        {/* A tap inside the card is not a tap outside it. */}
        <Pressable onPress={() => undefined} style={styles.sheet}>
          <Text style={styles.title}>{s.title}</Text>
          {body}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DeleteLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={10}
      style={({ pressed }) => [styles.drop, pressed && styles.dropPressed]}
    >
      <Text style={styles.dropLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheet: {
    width: "100%", maxWidth: 380, borderRadius: 18, padding: 22, gap: 14,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 24, fontFamily: font.bold, letterSpacing: -0.4 },
  lede: { color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  figure: {
    color: colors.text, fontSize: 18.5, fontFamily: font.semibold,
    letterSpacing: -0.2, fontVariant: ["tabular-nums"],
  },
  note: { color: colors.subtle, fontFamily: font.regular, fontSize: 14, lineHeight: 19 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sunken, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  drop: { alignItems: "center", paddingTop: 2 },
  dropPressed: { opacity: 0.6 },
  dropLabel: { color: colors.danger, fontSize: 14.5, fontFamily: font.semibold },
});
