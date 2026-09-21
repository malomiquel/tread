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
import { regionAround, segments, type TrackPoint } from "@/lib/geo";
import { colors, floatingShadow, literalColors } from "@/lib/theme";

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
 * How long the map is given before being asked for its picture.
 *
 * Short, because the wait is not for tiles. Asking the map for a snapshot does
 * not photograph what is on screen: it hands the region to MKMapSnapshotter,
 * which fetches and draws its own copy from scratch. All that has to have
 * happened by now is for the track's lines to have been attached to the map,
 * since those the library draws over the result by hand.
 */
const SETTLE_MS = 400;

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
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const map = useRef<MapView>(null);
  const card = useRef<View>(null);
  // Seeded rather than derived: the body is mounted afresh each time the sheet
  // opens, so whatever was ready at that moment is simply where it starts.
  const [mapUri, setMapUri] = useState<string | null>(preparedMapUri ?? null);
  const [sharing, setSharing] = useState(false);

  const tracks = segments(points);
  // The camera is worked out here rather than left to a later fit, so that the
  // map opens on the run instead of on the middle of the ocean.
  const region = regionAround(points);

  /**
   * The region is handed over rather than left implicit, and that is the whole
   * difference between a picture of the run and a rectangle of sea.
   *
   * Left out, the snapshotter falls back on whatever region the map view
   * believes it is showing, which need not be what is on screen — and an
   * unset region is latitude zero, longitude zero, a point in the middle of
   * the Atlantic. Passing the same region the preview was opened with also
   * makes the two agree by construction: what is shared is framed exactly
   * like what was looked at.
   */
  function captureMap() {
    setTimeout(() => {
      map.current
        ?.takeSnapshot({
          width: CARD_WIDTH,
          height: MAP_HEIGHT,
          region: region ?? undefined,
          format: "png",
          result: "file",
        })
        .then((uri) => {
          if (uri) setMapUri(uri);
        })
        .catch(() => {
          /* the map stays live, and the share button stays out of reach */
        });
    }, SETTLE_MS);
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
                onMapReady={captureMap}
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
