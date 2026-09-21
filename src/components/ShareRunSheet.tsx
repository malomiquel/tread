import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, TurboModuleRegistry,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import { Button } from "@/components/Button";
import { CardMapSource, type CardMapHandle } from "@/components/CardMapSource";
import { CARD_HEIGHT, CARD_WIDTH, ShareCard } from "@/components/ShareCard";
import type { Run } from "@/lib/db";
import type { TrackPoint } from "@/lib/geo";
import { colors, floatingShadow, font } from "@/lib/theme";

type ViewShot = typeof import("react-native-view-shot");

let loaded: ViewShot | null | undefined;

/**
 * The screenshot library, or null where its native half is missing.
 *
 * Probed rather than imported, and the distinction matters more here than
 * anywhere else in the app: this library resolves its native module with
 * `getEnforcing`, which throws at import time. A plain import therefore takes
 * down the whole run screen wherever the native side is absent — Expo Go, for
 * one — rather than merely disabling the button it belongs to.
 *
 * The same shape as the HealthKit guard, for the same reason: ask the
 * registry first, because asking the registry cannot throw.
 */
function viewShot(): ViewShot | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === "web") return (loaded = null);
  try {
    loaded = TurboModuleRegistry.get("RNViewShot")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? (require("react-native-view-shot") as ViewShot)
      : null;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Whether a run can be turned into a picture on this device at all. */
export const canShareImage = (): boolean => viewShot() !== null;

interface Props {
  visible: boolean;
  run: Run;
  points: TrackPoint[];
  /**
   * The map, already rendered by the screen underneath while the user was
   * reading it. Supplied, the sheet opens finished; absent — the picture
   * failed, or arrived late — it falls back to drawing its own.
   */
  preparedMapUri?: string | null;
  onClose: () => void;
}

/**
 * The sheet's body is mounted only while it is open, and that is deliberate
 * rather than an optimisation. A modal keeps its children alive when it
 * closes, so a map that has already announced itself ready would never
 * announce it again — reopening would show a card whose map never redraws.
 * Unmounting starts the whole sequence over, and clears the rendered file
 * along the way, which is right anyway since the phone may have switched to
 * dark in the meantime.
 */
export function ShareRunSheet({ visible, run, points, preparedMapUri, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
        <Sheet run={run} points={points} preparedMapUri={preparedMapUri} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

/**
 * The preview and the share sheet for a run's picture.
 *
 * The map is shown live at first and only then replaced by the file it was
 * rendered to. That order matters: a map view captured along with everything
 * around it can come back blank, while a map asked to draw itself to a file
 * always draws. And because the swap happens before the button becomes
 * available, what is shared is exactly what was on screen.
 */
function Sheet({ run, points, preparedMapUri, onClose }: Omit<Props, "visible">) {
  const source = useRef<CardMapHandle>(null);
  const card = useRef<View>(null);
  // Seeded rather than derived: the body is mounted afresh each time the sheet
  // opens, so whatever was ready at that moment is simply where it starts.
  const [mapUri, setMapUri] = useState<string | null>(preparedMapUri ?? null);
  const [sharing, setSharing] = useState(false);

  /** Only ever runs when the screen underneath did not get there first. */
  function renderMap() {
    if (mapUri) return;
    void source.current
      ?.render()
      .then(setMapUri)
      .catch(() => {
        /* the share button stays out of reach rather than sending a blank */
      });
  }

  async function share() {
    if (sharing || !mapUri) return;
    const shot = viewShot();
    if (!shot) {
      Alert.alert(
        "Image indisponible",
        "Cette version de l'app ne peut pas produire l'image. Elle demande une version installée, pas Expo Go.",
      );
      return;
    }

    setSharing(true);
    try {
      const uri = await shot.captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
      } else {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
      }
    } catch (cause) {
      Alert.alert("Image impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      {/* Stops a tap on the card from closing the sheet. */}
      <Pressable onPress={() => undefined} style={styles.stack}>
        <View style={styles.cardShadow}>
          <ShareCard ref={card} run={run} mapUri={mapUri} />
        </View>

        <View style={styles.actions}>
          <Button label="Fermer" variant="secondary" onPress={onClose} />
          {mapUri ? (
            <Button
              label={sharing ? "Préparation…" : "Partager"}
              onPress={() => void share()}
              disabled={sharing}
            />
          ) : (
            <View style={styles.waiting}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.waitingText}>Rendu de la carte…</Text>
            </View>
          )}
        </View>
      </Pressable>

      {!mapUri && <CardMapSource ref={source} points={points} onReady={renderMap} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 16,
  },
  // A card this tall leaves little room beside it, so the margins stay narrow
  // and the waiting line stands in for the button rather than below it.
  stack: { alignItems: "center", gap: 14 },
  // The shadow sits on a wrapper rather than on the card: the card is what
  // gets captured, and a shadow would be baked into the shared image.
  cardShadow: { width: CARD_WIDTH, height: CARD_HEIGHT, ...floatingShadow },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  waitingText: { color: colors.background, fontSize: 15, fontFamily: font.medium },
});
