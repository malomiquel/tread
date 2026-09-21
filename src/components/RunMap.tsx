import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { bounds, segments, type TrackPoint } from "@/lib/geo";
import { getCurrentCoords, type Coords } from "@/lib/location";
import { colors, floatingShadow } from "@/lib/theme";

interface Props {
  points: TrackPoint[];
  /** While recording: the camera follows the latest point. */
  follow?: boolean;
  /** On the detail screen: the whole track is framed once. */
  fitAll?: boolean;
  /** Where to centre until a first point has been recorded. */
  initialCenter?: Coords | null;
  /** Supplying this shows the expand button and reports every tap on it. */
  onToggleFullscreen?: () => void;
  /** Flips the expand button into a collapse button. */
  fullscreen?: boolean;
  /**
   * How far above the bottom edge the controls sit. Screens that lay their own
   * buttons over the map raise this, otherwise those buttons cover the
   * controls and the map can no longer be closed.
   */
  controlsBottom?: number;
  /** Moves the controls to the top, for screens whose panel sits at the bottom. */
  controlsAtTop?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PARIS = { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const RUNNER_ZOOM = 0.006;

/**
 * The run's track on Apple Maps or Google Maps depending on the platform.
 * One polyline per segment, so a pause never draws a line between where you
 * stopped and where you picked up again.
 */
export function RunMap({
  points, follow = false, fitAll = false, initialCenter = null,
  onToggleFullscreen, fullscreen = false, controlsBottom = 12, controlsAtTop = false, style,
}: Props) {
  const map = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);

  const empty = points.length === 0;
  const last = points.length ? points[points.length - 1] : null;
  const tracks = segments(points);

  useEffect(() => {
    if (!follow || !last) return;
    map.current?.animateCamera({ center: { latitude: last.lat, longitude: last.lng } }, { duration: 600 });
  }, [follow, last]);

  // The fix lands after the map has mounted, so after initialRegion was read:
  // the camera has to be moved by hand. animateToRegion rather than
  // animateCamera, because the latter recentres without touching the zoom,
  // leaving you correctly placed but at city scale.
  useEffect(() => {
    if (!initialCenter || !empty) return;
    map.current?.animateToRegion(
      { latitude: initialCenter.lat, longitude: initialCenter.lng, latitudeDelta: RUNNER_ZOOM, longitudeDelta: RUNNER_ZOOM },
      500,
    );
  }, [initialCenter, empty]);

  const frameTrack = () => {
    const box = bounds(points);
    if (!fitAll || !box) return;
    map.current?.fitToCoordinates(
      [{ latitude: box.minLat, longitude: box.minLng }, { latitude: box.maxLat, longitude: box.maxLng }],
      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false },
    );
  };

  const recentre = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const coords = await getCurrentCoords();
      if (coords) {
        map.current?.animateToRegion(
          { latitude: coords.lat, longitude: coords.lng, latitudeDelta: RUNNER_ZOOM, longitudeDelta: RUNNER_ZOOM },
          400,
        );
      }
    } catch {
      /* no fix available: the map stays where it is */
    } finally {
      setLocating(false);
    }
  };

  const anchor = last ? { lat: last.lat, lng: last.lng } : initialCenter;
  const initialRegion = anchor
    ? { latitude: anchor.lat, longitude: anchor.lng, latitudeDelta: RUNNER_ZOOM, longitudeDelta: RUNNER_ZOOM }
    : PARIS;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle="light"
        showsUserLocation={!fitAll}
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        onMapReady={frameTrack}
      >
        {tracks.map((track) => (
          <Polyline
            // Keyed on the first timestamp rather than the array index, so a
            // segment keeps its identity as the track grows.
            key={track[0].ts}
            coordinates={track.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={colors.track}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ))}
        {fitAll && points.length > 0 && (
          <>
            <Marker coordinate={{ latitude: points[0].lat, longitude: points[0].lng }} pinColor="green" title="Départ" />
            {last && <Marker coordinate={{ latitude: last.lat, longitude: last.lng }} pinColor="red" title="Arrivée" />}
          </>
        )}
      </MapView>

      <View style={[styles.controls, controlsAtTop ? styles.controlsTop : { bottom: controlsBottom }]}>
        {onToggleFullscreen && (
          <Pressable
            onPress={onToggleFullscreen}
            accessibilityRole="button"
            accessibilityLabel={fullscreen ? "Réduire la carte" : "Agrandir la carte"}
            hitSlop={8}
            style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
          >
            <Ionicons name={fullscreen ? "contract" : "expand"} size={19} color={colors.text} />
          </Pressable>
        )}
        {!fitAll && (
        <Pressable
          onPress={() => void recentre()}
          accessibilityRole="button"
          accessibilityLabel="Recentrer la carte sur ma position"
          // 44 points across, plus slop: below that the target gets hard to
          // hit with a thumb, especially mid-run.
          hitSlop={8}
          style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="locate" size={20} color={colors.text} />
          )}
        </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 4, overflow: "hidden", backgroundColor: colors.hairline },
  // The controls stack in one column so they never collide, whatever the
  // combination of buttons a screen asks for.
  controls: { position: "absolute", right: 12, gap: 10 },
  controlsTop: { top: 60 },
  control: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    ...floatingShadow,
  },
  controlPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    ...floatingShadow,
  },
  locatePressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
