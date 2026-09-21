import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Button } from "@/components/Button";
import { CardMapSource, type CardMapHandle } from "@/components/CardMapSource";
import { CARD_HEIGHT, CARD_WIDTH, ShareCard } from "@/components/ShareCard";
import type { Run } from "@/lib/db";
import type { TrackPoint } from "@/lib/geo";
import { colors, floatingShadow } from "@/lib/theme";

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
    setSharing(true);
    try {
      const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
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
  waitingText: { color: colors.background, fontSize: 12, fontWeight: "500" },
});
