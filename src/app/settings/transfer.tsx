import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { everythingForTransfer, restoreTransfer } from "@/lib/db";
import { handoverAvailable } from "@/lib/handover";
import { refreshReminders } from "@/lib/planReminders";
import { loadSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";
import { describeTransfer, packTransfer, transferFileName, unpackTransfer } from "@/lib/transfer";

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

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      const everything = await everythingForTransfer();
      if (everything.runs.length === 0 && everything.plan === null) {
        Alert.alert("Rien à transférer", "Cette app n'a encore ni course ni programme à envoyer.");
        return;
      }

      const file = new File(Paths.cache, transferFileName());
      file.create({ overwrite: true });
      file.write(await packTransfer(everything), { encoding: "base64" });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive" });
    } catch (cause) {
      Alert.alert("Transfert impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
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
          "Fichier non reconnu",
          "Ce fichier n'est pas un transfert Tread, ou il vient d'une version plus récente de l'app.",
        );
        return;
      }

      // Said out loud before anything is written. An import is the one thing
      // in this app that arrives from outside it, and the only way to know it
      // is the right file is to be told what is inside.
      Alert.alert(
        "Tout reprendre ?",
        `${describeTransfer(transfer)}.\n\nRien ne sera supprimé : les courses déjà ici sont reconnues et ignorées.`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Reprendre", onPress: () => void apply(transfer) },
        ],
      );
    } catch (cause) {
      Alert.alert("Lecture impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
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
      // Forced: the file may have brought a different answer with it, and if
      // that answer is "off" there are notifications here to take down.
      await refreshReminders({ force: true });

      Alert.alert(
        "Transfert terminé",
        [
          done.added > 0 ? `${done.added} course${done.added > 1 ? "s" : ""} ajoutée${done.added > 1 ? "s" : ""}` : null,
          done.known > 0 ? `${done.known} déjà connue${done.known > 1 ? "s" : ""}` : null,
          done.plan ? "programme repris" : null,
          transfer.plan && !done.plan ? "programme ignoré : celui d'ici a été gardé" : null,
          done.settings ? "réglages repris" : null,
        ].filter(Boolean).join(" · ") || "Rien de nouveau.",
      );
    } catch (cause) {
      Alert.alert("Transfert incomplet", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setReceiving(false);
    }
  }

  const busy = sending || receiving;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>
        Tes courses ne sont que sur ce téléphone : aucun compte, aucun serveur. Deux façons de les
        emmener ailleurs.
      </Text>

      {/* First, because it is the one where nobody leaves the app. */}
      {direct ? (
        <>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Par WiFi, en direct</Text>
            <SettingRow
              label="Envoyer vers l'autre téléphone"
              detail="Affiche un code à viser avec le nouveau"
              onPress={() => router.push("/settings/send")}
            />
            <SettingRow
              label="Recevoir depuis l'ancien"
              detail="Vise le code affiché par l'ancien téléphone"
              onPress={() => router.push("/settings/receive")}
            />
          </View>
          <Text style={styles.note}>
            Les deux téléphones doivent être sur le même WiFi, et certains réseaux publics
            interdisent aux appareils de se parler. Dans ce cas, le fichier ci-dessous marche
            partout.
          </Text>
        </>
      ) : (
        <Text style={styles.note}>
          Le transfert direct par WiFi demande une version installée de l&apos;app, pas Expo Go.
          Le fichier, lui, marche partout.
        </Text>
      )}

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Par fichier</Text>
        <SettingRow
          label="Envoyer tout"
          detail="Courses, tracés, programme, ressentis, réglages, dans un seul fichier"
          onPress={() => void send()}
          right={sending ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
        />
        <SettingRow
          label="Reprendre depuis un fichier"
          detail="Sur le nouveau téléphone, ouvre le fichier reçu"
          onPress={() => void receive()}
          right={receiving ? <ActivityIndicator size="small" color={colors.accent} /> : undefined}
        />
      </View>

      <Text style={styles.note}>
        Reprendre n&apos;efface jamais rien. Une course déjà présente est reconnue à sa date de
        départ et ignorée, donc le même fichier lu deux fois ne crée pas de doublon. Un programme
        n&apos;est repris que si ce téléphone n&apos;en suit aucun.
      </Text>
      <Text style={styles.note}>
        La copie des courses dans Santé ne voyage pas : elle appartient au téléphone qui l&apos;a
        écrite. Le nouveau renverra les siennes.
      </Text>
      {busy ? <Text style={styles.note}>Un long historique prend quelques secondes.</Text> : null}
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
  groupTitle: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.semibold,
    letterSpacing: 1.3, textTransform: "uppercase", paddingTop: 8,
  },
  group: {
    paddingHorizontal: GUTTER, paddingVertical: 6, marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
  note: {
    color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: GUTTER, paddingTop: 16,
  },
});
