import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { CARD_HEIGHT, CARD_WIDTH, TRACK_LIFT, TRACK_MARGIN } from "@/components/ShareCard";
import { regionAround, segments, type TrackPoint } from "@/lib/geo";
import { literalColors } from "@/lib/theme";

/**
 * How thick the track is drawn in the share picture.
 *
 * Thinner than on screen, and it has to be. The card pulls well back from the
 * run, so the same four points that read as a confident line on a map you are
 * looking at read as a fat ribbon once the route has shrunk to a third of the
 * frame.
 */
const CARD_STROKE = 2.5;

/** Where the map is parked: laid out and drawn, simply not on screen. */
const OFFSCREEN = -(CARD_WIDTH + 40);

export interface CardMapHandle {
  /** Renders the run to an image file and resolves its location. */
  render: () => Promise<string>;
}

interface Props {
  points: TrackPoint[];
  /** Fired once the map can be asked for its picture. */
  onReady?: () => void;
}

/**
 * The map that exists only to be photographed.
 *
 * It is deliberately not the map anyone looks at. Asking a map for its picture
 * does not photograph it: the region and size are handed to the system, which
 * draws its own copy, and only the track is painted over the result from this
 * view's own overlay. So this one is never shown — it is parked off screen,
 * where it costs nothing but still holds the track at the weight the card
 * wants, while the map on the page keeps the weight the page wants.
 *
 * It also means the preview and the shared file are the same image rather than
 * two renderings that happen to agree.
 */
export const CardMapSource = forwardRef<CardMapHandle, Props>(function CardMapSource(
  { points, onReady },
  ref,
) {
  const map = useRef<MapView>(null);
  const region = regionAround(points, TRACK_MARGIN, TRACK_LIFT);

  useImperativeHandle(ref, () => ({
    render: () =>
      map.current?.takeSnapshot({
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        region: region ?? undefined,
        format: "png",
        result: "file",
      }) ?? Promise.reject(new Error("La carte n'est pas prête.")),
  }), [region]);

  return (
    <View style={styles.parked} pointerEvents="none" collapsable={false}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={region ?? undefined}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        onMapReady={onReady}
      >
        {segments(points).map((track) => (
          <Polyline
            key={track[0].ts}
            coordinates={track.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={literalColors.track.light}
            strokeWidth={CARD_STROKE}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  parked: {
    position: "absolute",
    left: OFFSCREEN,
    top: 0,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
});
