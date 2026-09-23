import { useFocusEffect } from "expo-router";
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { everythingForTransfer } from "@/lib/db";
import {
  handoverAvailable, HANDOVER_TIMEOUT_MS, secondsLeft, startHandover, type Handover,
} from "@/lib/handover";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font, literalColors } from "@/lib/theme";
import { packTransfer } from "@/lib/transfer";

const sendStrings = defineStrings({
  fr: {
    noServer:
      "Cette version de l'app ne peut pas ouvrir de serveur. Elle demande une version installée, pas Expo Go. Le transfert par fichier, lui, marche partout.",
    nothingToSend: "Cette app n'a encore ni course ni programme à envoyer.",
    serverFailed: "Le serveur n'a pas démarré.",
    timedOut: "Le temps est écoulé. Reviens sur cet écran pour recommencer.",
    packing: "Préparation de tes courses…",
    lede: "Sur le nouveau téléphone : Réglages, Transfert, Recevoir. Puis vise ce code.",
    countdown: (clock: string) => `Actif encore ${clock}`,
    note: (minutes: number) =>
      `Les deux téléphones doivent être sur le même WiFi. Le partage s'arrête tout seul en quittant cet écran, et dans tous les cas au bout de ${minutes} minutes.`,
  },
  en: {
    noServer:
      "This version of the app can't open a server. It needs an installed build, not Expo Go. The file transfer works everywhere, though.",
    nothingToSend: "This app has no runs or training plan to send yet.",
    serverFailed: "The server didn't start.",
    timedOut: "Time's up. Come back to this screen to start again.",
    packing: "Getting your runs ready…",
    lede: "On the new phone: Settings, Switch phones, Receive. Then scan this code.",
    countdown: (clock: string) => `Active for another ${clock}`,
    note: (minutes: number) =>
      `Both phones need to be on the same WiFi. Sharing stops by itself when you leave this screen, and after ${minutes} minutes in any case.`,
  },
});

/** The folder the server is pointed at. It holds this transfer and nothing else. */
const FOLDER = "handover";

function handoverDir(): string {
  const dir = new Directory(Paths.cache, FOLDER);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
  // Lighttpd wants a path, not a file:// url.
  return dir.uri.replace(/^file:\/\//, "");
}

type Stage =
  | { step: "packing" }
  | { step: "serving"; url: string; startedAt: number }
  | { step: "over"; why: string };

/**
 * The sending half: a QR code, and a server that exists for two minutes.
 *
 * Everything about this screen is arranged around one fact — the server is
 * reachable by anything on the network while it is up. So it starts when the
 * screen appears and stops when it leaves, by any route: the back gesture, a
 * tab change, the timeout, or the transfer being done. There is no way to
 * leave it running by accident, because there is no way to leave the screen
 * without stopping it.
 */
export default function SendOverWifi() {
  const [stage, setStage] = useState<Stage>({ step: "packing" });
  const [now, setNow] = useState(() => Date.now());
  const live = useRef<Handover | null>(null);
  const s = useStrings(sendStrings);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const begin = async () => {
        if (!handoverAvailable()) {
          setStage({
            step: "over",
            why: sendStrings().noServer,
          });
          return;
        }

        const everything = await everythingForTransfer();
        if (everything.runs.length === 0 && everything.plan === null) {
          setStage({ step: "over", why: sendStrings().nothingToSend });
          return;
        }
        const packed = await packTransfer(everything);
        if (!active) return;

        const handover = await startHandover(
          async (name) => {
            const file = new File(new Directory(Paths.cache, FOLDER), name);
            file.create({ overwrite: true });
            file.write(packed, { encoding: "base64" });
          },
          async () => handoverDir(),
        );
        if (!handover) return;

        // Left while it was starting: stop it at once rather than leave a
        // server running behind a screen nobody is on.
        if (!active) {
          await handover.stop();
          return;
        }
        live.current = handover;
        setStage({ step: "serving", url: handover.url, startedAt: Date.now() });
      };

      begin().catch((cause: unknown) => {
        if (active) {
          setStage({
            step: "over",
            why: cause instanceof Error ? cause.message : sendStrings().serverFailed,
          });
        }
      });

      return () => {
        active = false;
        void live.current?.stop();
        live.current = null;
      };
    }, []),
  );

  /**
   * The clock, and the end of it, in one place.
   *
   * The expiry lives inside the tick rather than in an effect watching the
   * countdown: it is the same event — the moment the second hand reaches
   * zero — and splitting it in two would mean a render in which the server is
   * up and the screen already says it is not.
   */
  const startedAt = stage.step === "serving" ? stage.startedAt : 0;
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => {
      const tick = Date.now();
      if (secondsLeft(startedAt, tick) > 0) {
        setNow(tick);
        return;
      }
      clearInterval(timer);
      void live.current?.stop();
      live.current = null;
      setStage({ step: "over", why: sendStrings().timedOut });
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const left = stage.step === "serving" ? secondsLeft(stage.startedAt, now) : 0;

  if (stage.step === "over") {
    return (
      <View style={styles.screen}>
        <Text style={styles.over}>{stage.why}</Text>
      </View>
    );
  }

  if (stage.step === "packing") {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.waiting}>{s.packing}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.lede}>{s.lede}</Text>

      {/* White ground whatever the appearance: a scanner reads dark on light,
          and a QR drawn in the dark theme is a QR that does not scan. */}
      <View style={styles.frame}>
        <QRCode
          value={stage.url}
          size={232}
          backgroundColor="#ffffff"
          color={literalColors.text.light}
        />
      </View>

      <Text style={styles.countdown}>
        {s.countdown(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`)}
      </Text>
      <Text style={styles.note}>{s.note(Math.round(HANDOVER_TIMEOUT_MS / 60000))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center", gap: 18, padding: 28,
  },
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 16,
    textAlign: "center", lineHeight: 23,
  },
  frame: { backgroundColor: "#ffffff", padding: 18, borderRadius: 16 },
  countdown: {
    color: colors.text, fontFamily: font.semibold, fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  note: {
    color: colors.subtle, fontFamily: font.regular, fontSize: 13.5,
    textAlign: "center", lineHeight: 20,
  },
  waiting: { color: colors.muted, fontFamily: font.regular, fontSize: 15.5 },
  over: {
    color: colors.muted, fontFamily: font.regular, fontSize: 16,
    textAlign: "center", lineHeight: 24,
  },
});
