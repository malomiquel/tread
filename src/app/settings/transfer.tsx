import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { SettingsGroup } from "@/components/SettingsGroup";
import { everythingForTransfer, restoreTransfer } from "@/lib/db";
import { handoverAvailable } from "@/lib/handover";
import { defineStrings, useStrings } from "@/lib/i18n";
import { refreshReminders } from "@/lib/planReminders";
import { loadCustomSessions } from "@/lib/sessionLibrary";
import { loadSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";
import { describeTransfer, restoredSummary, packTransfer, transferFileName, unpackTransfer } from "@/lib/transfer";

const transferStrings = defineStrings({
  fr: {
    nothingTitle: "Rien à transférer",
    nothingMessage: "Cette app n'a encore ni course ni programme à envoyer.",
    shareUnavailableTitle: "Partage indisponible",
    shareUnavailableMessage: "Impossible d'ouvrir la feuille de partage sur cet appareil.",
    sendFailed: "Transfert impossible",
    unexpected: "Erreur inattendue.",
    unknownFileTitle: "Fichier non reconnu",
    unknownFileMessage:
      "Ce fichier n'est pas un transfert Tread, ou il vient d'une version plus récente de l'app.",
    confirmTitle: "Tout reprendre ?",
    confirmMessage: (contents: string) =>
      `${contents}.\n\nRien ne sera supprimé : les courses déjà ici sont reconnues et ignorées.`,
    cancel: "Annuler",
    restore: "Reprendre",
    readFailed: "Lecture impossible",
    doneTitle: "Transfert terminé",
    incompleteTitle: "Transfert incomplet",
    lede:
      "Tes courses et tes parcours ne sont que sur ce téléphone : aucun compte, aucun serveur. Deux façons de les emmener sur le nouveau.",
    wifiTitle: "Par WiFi, en direct",
    wifiSend: "Envoyer vers l'autre téléphone",
    wifiSendDetail: "Affiche un code à viser avec le nouveau",
    wifiReceive: "Recevoir depuis l'ancien",
    wifiReceiveDetail: "Vise le code affiché par l'ancien téléphone",
    wifiNote:
      "Les deux téléphones doivent être sur le même WiFi, et certains réseaux publics interdisent aux appareils de se parler. Dans ce cas, le fichier ci-dessous marche partout.",
    wifiUnavailable:
      "Le transfert direct par WiFi n'est pas disponible sur cet appareil. Le fichier, lui, marche partout.",
    fileTitle: "Par fichier",
    sendAll: "Envoyer tout",
    sendAllDetail: "Courses, parcours, programme, ressentis, réglages, dans un seul fichier",
    restoreFromFile: "Reprendre depuis un fichier",
    restoreFromFileDetail: "Sur le nouveau téléphone, ouvre le fichier reçu",
    neverErases:
      "Reprendre n'efface jamais rien. Une course déjà présente est reconnue à sa date de départ et ignorée, donc le même fichier lu deux fois ne crée pas de doublon. Un programme n'est repris que si ce téléphone n'en suit aucun.",
    healthNote:
      "La copie des courses dans Santé ne voyage pas : elle appartient au téléphone qui l'a écrite. Le nouveau renverra les siennes.",
    longHistory: "Un long historique prend quelques secondes.",
  },
  en: {
    nothingTitle: "Nothing to transfer",
    nothingMessage: "This app has no runs or training plan to send yet.",
    shareUnavailableTitle: "Sharing unavailable",
    shareUnavailableMessage: "The share sheet can't be opened on this device.",
    sendFailed: "Transfer failed",
    unexpected: "Unexpected error.",
    unknownFileTitle: "File not recognised",
    unknownFileMessage:
      "This file isn't a Tread transfer, or it comes from a newer version of the app.",
    confirmTitle: "Bring everything over?",
    confirmMessage: (contents: string) =>
      `${contents}.\n\nNothing will be deleted: runs already on this phone are recognised and skipped.`,
    cancel: "Cancel",
    restore: "Bring over",
    readFailed: "Couldn't read the file",
    doneTitle: "Transfer complete",
    incompleteTitle: "Transfer incomplete",
    lede:
      "Your runs and routes only live on this phone: no account, no server. There are two ways to take them to the new one.",
    wifiTitle: "Over WiFi, directly",
    wifiSend: "Send to the other phone",
    wifiSendDetail: "Shows a code to scan with the new one",
    wifiReceive: "Receive from the old one",
    wifiReceiveDetail: "Scan the code shown on the old phone",
    wifiNote:
      "Both phones need to be on the same WiFi, and some public networks stop devices from talking to each other. If so, the file below works everywhere.",
    wifiUnavailable:
      "Direct WiFi transfer isn't available on this device. The file works everywhere, though.",
    fileTitle: "With a file",
    sendAll: "Send everything",
    sendAllDetail: "Runs, routes, training plan, effort ratings and settings, in a single file",
    restoreFromFile: "Restore from a file",
    restoreFromFileDetail: "On the new phone, open the file you received",
    neverErases:
      "Restoring never erases anything. A run that's already here is recognised by its start time and skipped, so reading the same file twice creates no duplicates. A training plan is only brought over if this phone isn't following one.",
    healthNote:
      "The copy of your runs in Health doesn't travel: it belongs to the phone that wrote it. The new one will save its own.",
    longHistory: "A long history takes a few seconds.",
  },
});

/**
 * Moving everything to another phone.
 *
 * The app talks to no server, which is what makes it worth trusting and also
 * what makes a new phone frightening: this database is the only copy there
 * is. So the whole of it — runs, tracks, programme, exertions, weather,
 * heart, settings — becomes one file, handed to the share sheet, and picked
 * up on the other side.
 *
 * No route is named on screen. The file goes by whatever the phone offers:
 * AirDrop between two iPhones, Quick Share or Bluetooth between two Androids,
 * a message or a cable between one of each. Naming one would be wrong on half
 * the devices this runs on.
 */
export default function TransferSettings() {
  const router = useRouter();
  // Asked once, on arrival: a build without the server will not grow one
  // between two renders. Absent rather than broken, the way the share button
  // is absent where the screenshot module is missing — a row that always ends
  // in an apology is worse than one that was never offered.
  const [direct] = useState(handoverAvailable);
  const [sending, setSending] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const s = useStrings(transferStrings);

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const everything = await everythingForTransfer();
      if (everything.runs.length === 0 && everything.plan === null) {
        Alert.alert(s.nothingTitle, s.nothingMessage);
        return;
      }

      const file = new File(Paths.cache, transferFileName());
      file.create({ overwrite: true });
      file.write(await packTransfer(everything), { encoding: "base64" });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(s.shareUnavailableTitle, s.shareUnavailableMessage);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive" });
    } catch (cause) {
      Alert.alert(s.sendFailed, cause instanceof Error ? cause.message : s.unexpected);
    } finally {
      setSending(false);
    }
  }

  async function receive() {
    if (receiving) return;
    setReceiving(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Loose on purpose: a file that has been through a message or a cloud
        // drive arrives declared as anything at all, or as nothing.
        type: ["application/zip", "*/*"],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const transfer = await unpackTransfer(await new File(picked.assets[0].uri).base64());
      if (!transfer) {
        Alert.alert(
          s.unknownFileTitle,
          s.unknownFileMessage,
        );
        return;
      }

      // Said out loud before anything is written. An import is the one thing
      // in this app that arrives from outside it, and the only way to know it
      // is the right file is to be told what is inside.
      Alert.alert(
        s.confirmTitle,
        s.confirmMessage(describeTransfer(transfer)),
        [
          { text: s.cancel, style: "cancel" },
          { text: s.restore, onPress: () => void apply(transfer) },
        ],
      );
    } catch (cause) {
      Alert.alert(s.readFailed, cause instanceof Error ? cause.message : s.unexpected);
    } finally {
      setReceiving(false);
    }
  }

  async function apply(transfer: Awaited<ReturnType<typeof unpackTransfer>>) {
    if (!transfer) return;
    setReceiving(true);
    try {
      const done = await restoreTransfer(transfer);
      // The settings cache and the pending notifications both came from the
      // old state of this phone, and neither would notice on its own.
      await loadSettings();
      await loadCustomSessions();
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
      setReceiving(false);
    }
  }

  const busy = sending || receiving;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>{s.lede}</Text>

      {/* First, because it is the one where nobody leaves the app. */}
      {direct ? (
        <>
          <SettingsGroup title={s.wifiTitle}>
            <SettingRow
              icon="arrow-up-circle-outline"
              label={s.wifiSend}
              detail={s.wifiSendDetail}
              onPress={() => router.push("/settings/send")}
            />
            <SettingRow
              icon="arrow-down-circle-outline"
              label={s.wifiReceive}
              detail={s.wifiReceiveDetail}
              onPress={() => router.push("/settings/receive")}
            />
          </SettingsGroup>
          <Text style={styles.note}>{s.wifiNote}</Text>
        </>
      ) : (
        <Text style={styles.note}>{s.wifiUnavailable}</Text>
      )}

      <SettingsGroup title={s.fileTitle}>
        <SettingRow
          icon="document-outline"
          label={s.sendAll}
          detail={s.sendAllDetail}
          onPress={() => void send()}
          right={sending ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
        />
        <SettingRow
          icon="folder-open-outline"
          label={s.restoreFromFile}
          detail={s.restoreFromFileDetail}
          onPress={() => void receive()}
          right={receiving ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
        />
      </SettingsGroup>

      <Text style={styles.note}>{s.neverErases}</Text>
      <Text style={styles.note}>{s.healthNote}</Text>
      {busy ? <Text style={styles.note}>{s.longHistory}</Text> : null}
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15.5, lineHeight: 22,
    paddingHorizontal: GUTTER, paddingTop: 16,
  },
  note: {
    color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: GUTTER, paddingTop: 16,
  },
});
