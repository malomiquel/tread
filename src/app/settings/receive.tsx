import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { restoreTransfer } from "@/lib/db";
import { readHandoverUrl } from "@/lib/handover";
import { defineStrings, useStrings } from "@/lib/i18n";
import { refreshReminders } from "@/lib/planReminders";
import { loadSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";
import { describeTransfer, restoredSummary, unpackTransfer, type Transfer } from "@/lib/transfer";

const receiveStrings = defineStrings({
  fr: {
    unreadableTitle: "Fichier illisible",
    unreadableMessage: "Le transfert n'est pas arrivé entier. Réessaie.",
    ok: "OK",
    confirmTitle: "Tout reprendre ?",
    confirmMessage: (contents: string) =>
      `${contents}.\n\nRien ne sera supprimé : les courses déjà ici sont reconnues et ignorées.`,
    cancel: "Annuler",
    restore: "Reprendre",
    downloadFailedTitle: "Téléchargement impossible",
    downloadFailedMessage:
      "Vérifie que les deux téléphones sont sur le même WiFi. Certains réseaux publics isolent les appareils entre eux : dans ce cas, passe par le partage de connexion de l'un des deux, ou par le transfert en fichier.",
    doneTitle: "Transfert terminé",
    incompleteTitle: "Transfert incomplet",
    unexpected: "Erreur inattendue.",
    cameraReason:
      "Pour lire le code affiché sur l'autre téléphone, l'app a besoin de la caméra. Elle ne s'en sert que sur cet écran, et ne garde aucune image.",
    allowCamera: "Autoriser la caméra",
    receiving: "Réception…",
    aim: "Vise le code affiché sur l'ancien téléphone.",
  },
  en: {
    unreadableTitle: "File unreadable",
    unreadableMessage: "The transfer didn't arrive in one piece. Try again.",
    ok: "OK",
    confirmTitle: "Bring everything over?",
    confirmMessage: (contents: string) =>
      `${contents}.\n\nNothing will be deleted: runs already on this phone are recognised and skipped.`,
    cancel: "Cancel",
    restore: "Bring over",
    downloadFailedTitle: "Download failed",
    downloadFailedMessage:
      "Check that both phones are on the same WiFi. Some public networks keep devices apart: if so, use one phone's personal hotspot, or transfer with a file instead.",
    doneTitle: "Transfer complete",
    incompleteTitle: "Transfer incomplete",
    unexpected: "Unexpected error.",
    cameraReason:
      "To read the code shown on the other phone, the app needs the camera. It only uses it on this screen, and keeps no pictures.",
    allowCamera: "Allow camera",
    receiving: "Receiving…",
    aim: "Scan the code shown on the old phone.",
  },
});

/**
 * The receiving half: a camera, and one download.
 *
 * The scanner keeps looking until it sees one of ours. A QR code is a url
 * somebody else wrote — a poster, a menu, a parcel — so what is scanned is
 * checked for shape and for a private address before anything is fetched,
 * and a code that is not ours is simply not acted on.
 */
export default function ReceiveOverWifi() {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  /** Set once a code has been taken, so the camera stops firing at it. */
  const [taken, setTaken] = useState(false);
  const s = useStrings(receiveStrings);

  async function fetchAndApply(url: string) {
    setBusy(true);
    try {
      const into = new File(Paths.cache, "recu.zip");
      if (into.exists) into.delete();
      await File.downloadFileAsync(url, into, { idempotent: true });

      const transfer = await unpackTransfer(await into.base64());
      into.delete();
      if (!transfer) {
        Alert.alert(s.unreadableTitle, s.unreadableMessage, [
          { text: s.ok, onPress: () => setTaken(false) },
        ]);
        return;
      }

      Alert.alert(
        s.confirmTitle,
        s.confirmMessage(describeTransfer(transfer)),
        [
          { text: s.cancel, style: "cancel", onPress: () => setTaken(false) },
          { text: s.restore, onPress: () => void apply(transfer) },
        ],
      );
    } catch {
      // Almost always the same cause: a network that will not let two of its
      // own devices talk. Saying so is more use than saying "échec".
      Alert.alert(
        s.downloadFailedTitle,
        s.downloadFailedMessage,
        [{ text: s.ok, onPress: () => setTaken(false) }],
      );
    } finally {
      setBusy(false);
    }
  }

  async function apply(transfer: Transfer) {
    setBusy(true);
    try {
      const done = await restoreTransfer(transfer);
      // Both came from the old state of this phone, and neither would notice
      // on its own.
      await loadSettings();
      // Forced: the file may have brought a different answer with it, and if
      // that answer is "off" there are notifications here to take down.
      await refreshReminders({ force: true });

      Alert.alert(
        s.doneTitle,
        restoredSummary(done, transfer.plan !== null),
      );
    } catch (cause) {
      Alert.alert(s.incompleteTitle, cause instanceof Error ? cause.message : s.unexpected);
    } finally {
      setBusy(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <Text style={styles.lede}>{s.cameraReason}</Text>
        <Pressable
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
        >
          <Text style={styles.askLabel}>{s.allowCamera}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (taken || busy) return;
          const url = readHandoverUrl(data);
          // Not one of ours: keep looking rather than say anything. Pointing
          // at a menu should not raise an alert.
          if (!url) return;
          setTaken(true);
          void fetchAndApply(url);
        }}
      />
      <Text style={styles.lede}>
        {busy ? s.receiving : s.aim}
      </Text>
      {busy ? <ActivityIndicator color={colors.accent} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", gap: 20, padding: 28,
  },
  camera: { width: 272, height: 272, borderRadius: 18, overflow: "hidden" },
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 16,
    textAlign: "center", lineHeight: 23,
  },
  ask: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
    backgroundColor: colors.accent,
  },
  askLabel: { color: colors.accentText, fontFamily: font.semibold, fontSize: 16 },
  pressed: { opacity: 0.6 },
});
