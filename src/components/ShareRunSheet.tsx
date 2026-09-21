import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, useColorScheme, View,
} from "react-native";
import MapView, { Polyline } from "react-native-maps";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { Button } from "@/components/Button";
import { CARD_HEIGHT, CARD_WIDTH, MAP_HEIGHT, ShareCard } from "@/components/ShareCard";
import type { Run } from "@/lib/db";
import { bounds, regionAround, segments, type TrackPoint } from "@/lib/geo";
import { colors, floatingShadow, literalColors } from "@/lib/theme";

interface Props {
  visible: boolean;
  run: Run;
  points: TrackPoint[];
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
export function ShareRunSheet({ visible, run, points, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? <Sheet run={run} points={points} onClose={onClose} /> : null}
    </Modal>
  );
}

/**
 * How long the map is given to draw itself before being captured.
 *
 * There is no signal to wait for instead: the library's onMapLoaded only ever
 * fires for Google Maps, and this app uses Apple's. So this is a wait, and it
 * is generous on purpose — a snapshot taken early comes back as bare water,
 * and a second of delay on a screen the user opened deliberately costs far
 * less than a picture they cannot share.
 */
const SETTLE_MS = 1400;

/**
 * The preview and the share sheet for a run's picture.
 *
 * The map is shown live at first and only then replaced by the file it was
 * rendered to. That order matters: a map view captured along with everything
 * around it can come back blank, while a map asked to draw itself to a file
 * always draws. And because the swap happens before the button becomes
 * available, what is shared is exactly what was on screen.
 */
function Sheet({ run, points, onClose }: Omit<Props, "visible">) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const map = useRef<MapView>(null);
  const card = useRef<View>(null);
  const [mapUri, setMapUri] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const tracks = segments(points);
  // The camera is worked out here rather than left to a later fit, so that the
  // map opens on the run instead of on the middle of the ocean.
  const region = regionAround(points);

  async function captureMap() {
    try {
      const uri = await map.current?.takeSnapshot({
        width: CARD_WIDTH,
        height: MAP_HEIGHT,
        format: "png",
        result: "file",
      });
      if (uri) setMapUri(uri);
    } catch {
      /* the map stays live, and the share button stays out of reach */
    }
  }

  function frameThenCapture() {
    const box = bounds(points);
    if (box) {
      map.current?.fitToCoordinates(
        [
          { latitude: box.minLat, longitude: box.minLng },
          { latitude: box.maxLat, longitude: box.maxLng },
        ],
        { edgePadding: { top: 28, right: 28, bottom: 28, left: 28 }, animated: false },
      );
    }
    setTimeout(() => void captureMap(), SETTLE_MS);
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
          <ShareCard
            ref={card}
            run={run}
            mapUri={mapUri}
            mapFallback={
              <MapView
                ref={map}
                style={StyleSheet.absoluteFill}
                initialRegion={region ?? undefined}
                userInterfaceStyle={scheme}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsCompass={false}
                onMapReady={frameThenCapture}
              >
                {tracks.map((track) => (
                  <Polyline
                    key={track[0].ts}
                    coordinates={track.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                    strokeColor={literalColors.track[scheme]}
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}
              </MapView>
            }
          />
        </View>

        <View style={styles.actions}>
          <Button label="Fermer" variant="secondary" onPress={onClose} />
          <Button
            label={sharing ? "Préparation…" : mapUri ? "Partager" : "Rendu…"}
            onPress={() => void share()}
            disabled={sharing || !mapUri}
          />
        </View>

        {!mapUri && (
          <View style={styles.pending} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.pendingText}>Rendu de la carte…</Text>
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  stack: { alignItems: "center", gap: 16 },
  // The shadow sits on a wrapper rather than on the card: the card is what
  // gets captured, and a shadow would be baked into the shared image.
  cardShadow: { width: CARD_WIDTH, height: CARD_HEIGHT, ...floatingShadow },
  actions: { flexDirection: "row", gap: 10 },
  pending: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingText: { color: colors.background, fontSize: 11.5, fontWeight: "500" },
});
