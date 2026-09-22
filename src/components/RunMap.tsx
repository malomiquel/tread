import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { formatDistance, formatDuration } from "@/lib/format";
import { bounds, regionAround, segments, type TrackPoint } from "@/lib/geo";
import { CONTROL_SIZE, CONTROLS_TOP } from "@/lib/layout";
import { getCurrentCoords, type Coords } from "@/lib/location";
import { buildReplay, drawnSoFar, headAt, REPLAY_MS } from "@/lib/replay";
import { colors, floatingShadow, font, literalColors } from "@/lib/theme";

interface Props {
  points: TrackPoint[];
  /** While recording: the camera follows the latest point. */
  follow?: boolean;
  /**
   * Find the runner again every time this screen is opened.
   *
   * Arriving at a map parked wherever it was left — three streets away, or
   * at the scale of a city — asks somebody to press a button before the
   * screen means anything. Off by default, because a finished run's map has
   * a subject of its own and has no business chasing the phone.
   */
  locateOnFocus?: boolean;
  /** On the detail screen: the whole track is framed once. */
  fitAll?: boolean;
  /** Where to centre until a first point has been recorded. */
  initialCenter?: Coords | null;
  /**
   * Offers to draw the track from the start, at the speed it was run.
   *
   * Only on a finished run: mid-run the line is already being drawn, one fix
   * at a time, by the run itself.
   */
  replayable?: boolean;
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
  /**
   * How the controls arrive, and what makes them arrive again. Screens that
   * animate their own furniture in pass these so the map's buttons join the
   * same arrival rather than being the one thing already in place.
   */
  /**
   * Zero on arrival, one once arrived. The controls slide in from the right
   * edge as it travels, joining the screen's own arrival instead of being
   * the one thing already in place.
   */
  controlsArrive?: SharedValue<number>;
  /**
   * A live height for the panel these controls sit above, when the screen has
   * one that changes. Given it, they ride it on the animation thread and stay
   * exactly as far above the panel as it grows and shrinks.
   */
  controlsAbove?: SharedValue<number>;


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
  points, follow = false, fitAll = false, initialCenter = null, locateOnFocus = false,
  replayable = false, onToggleFullscreen, fullscreen = false, controlsBottom = 12,
  controlsAtTop = false, controlsArrive, controlsAbove, style,
}: Props) {
  const map = useRef<MapView>(null);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  // Position and arrival stay on separate views: on one, the two animations
  // write to the same translation and fight over it, which shows up as the
  // buttons shivering as they land.
  const ride = useAnimatedStyle(() => ({
    bottom: controlsAbove ? controlsAbove.value : controlsBottom,
    transform: [{ translateX: controlsArrive ? (1 - controlsArrive.value) * 34 : 0 }],
  }), [controlsAbove, controlsArrive, controlsBottom]);
  const [locating, setLocating] = useState(false);

  const empty = points.length === 0;
  const last = points.length ? points[points.length - 1] : null;
  const tracks = segments(points);

  /**
   * The replay's timeline, laid out once per track rather than per frame.
   *
   * Thinning, cumulative times and cumulative distances are all fixed for a
   * finished run, and recomputing them twenty-five times a second is the
   * difference between a line that draws itself and one that stutters.
   */
  const replay = useMemo(
    () => (replayable ? buildReplay(points) : null),
    [replayable, points],
  );
  /** Milliseconds into the animation, or null when it is not running. */
  const [playedMs, setPlayedMs] = useState<number | null>(null);

  useEffect(() => {
    if (playedMs === null || !replay) return;
    const startedAt = Date.now();
    // Forty milliseconds: twenty-five frames a second, which is smooth enough
    // for a line and cheap enough for a map that redraws a whole polyline
    // each time.
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      // Held on the finished track for a moment rather than snapping back to
      // the start: the last thing anybody wants to see is the run they have
      // just watched being drawn disappear.
      if (elapsed >= REPLAY_MS) {
        clearInterval(timer);
        setPlayedMs(null);
        return;
      }
      setPlayedMs(elapsed);
    }, 40);
    return () => clearInterval(timer);
    // Started once, by the tap that set the clock to zero. Every tick after
    // that reads the clock rather than the state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playedMs !== null, replay]);

  const head = replay && playedMs !== null ? headAt(replay, playedMs / REPLAY_MS) : null;
  const drawn = replay && head ? drawnSoFar(replay, head) : null;

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

  /**
   * Guarded by a ref, not by the state beside it.
   *
   * The state drives the spinner and so belongs in a render; the guard has to
   * survive one. Reading `locating` here also put it in this callback's
   * dependencies, so every locate changed the callback's identity, which
   * restarted the effect that called it — the map located, and located, and
   * located again.
   */
  const busy = useRef(false);
  const recentre = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
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
      busy.current = false;
      setLocating(false);
    }
  }, []);

  // The same thing the locate button does, on arrival rather than on demand.
  // Only while there is no track to look at: mid-run the camera is already
  // following the last fix, and re-framing under it would fight it for the
  // zoom.
  useFocusEffect(
    useCallback(() => {
      if (locateOnFocus && empty) void recentre();
    }, [locateOnFocus, empty, recentre]),
  );

  // A screen showing a finished run opens on the whole of it rather than
  // zoomed on its last step and jumping to the framing a moment later. While
  // recording it is the opposite: the camera stays close to where you are.
  const anchor = last ? { lat: last.lat, lng: last.lng } : initialCenter;
  const initialRegion =
    (fitAll ? regionAround(points) : null) ??
    (anchor
      ? { latitude: anchor.lat, longitude: anchor.lng, latitudeDelta: RUNNER_ZOOM, longitudeDelta: RUNNER_ZOOM }
      : PARIS);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle={scheme}
        showsUserLocation={!fitAll}
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        onMapReady={frameTrack}
      >
        {(drawn ?? tracks).map((track) => (
          <Polyline
            // Keyed on the first timestamp rather than the array index, so a
            // segment keeps its identity as the track grows.
            key={track[0].ts}
            coordinates={track.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={literalColors.track[scheme]}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* The runner. A plain dot, because anything with a picture in it
            would be redrawn from scratch on every one of its twenty-five
            moves a second. */}
        {head && (
          <Marker
            coordinate={{ latitude: head.lat, longitude: head.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.head, { borderColor: literalColors.track[scheme] }]} />
          </Marker>
        )}
      </MapView>

      <Animated.View style={[styles.controls, controlsAtTop ? styles.controlsTop : ride]}>
        <View style={styles.controlStack}>
        {replay && (
          <Pressable
            onPress={() => setPlayedMs((running) => (running === null ? 0 : null))}
            accessibilityRole="button"
            accessibilityLabel={head ? "Arrêter le tracé animé" : "Rejouer le parcours"}
            hitSlop={8}
            style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
          >
            <Ionicons
              name={head ? "stop" : "play"}
              size={19}
              color={colors.text}
              // A play triangle centred geometrically reads as off-centre:
              // its mass sits left of its box.
              style={head ? undefined : styles.play}
            />
          </Pressable>
        )}
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
      </Animated.View>

      {/* What the line is worth, while it draws. Without the clock beside it
          the animation is a pretty shape; with it, the pause halfway up the
          hill is visible as the moment the numbers stop moving. */}
      {head && replay && (
        <View style={[styles.readout, fullscreen && styles.readoutBelowStatusBar]}>
          <Text style={styles.readoutText}>
            {`${formatDuration(head.elapsedMs / 1000)} · ${formatDistance(head.metresRun)} km`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: 4, overflow: "hidden", backgroundColor: colors.hairline },
  // The controls stack in one column so they never collide, whatever the
  // combination of buttons a screen asks for.
  controls: { position: "absolute", right: 12 },
  controlStack: { gap: 10 },
  controlsTop: { top: CONTROLS_TOP },
  control: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    ...floatingShadow,
  },
  controlPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  play: { marginLeft: 2 },

  // White ring, so the dot stays visible over the line it is drawing as well
  // as over the map underneath it.
  head: {
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: "#ffffff", borderWidth: 3.5,
  },
  // In its own corner, twelve points in from both edges, which is where the
  // map's own controls sit on the other side.
  readout: {
    position: "absolute", left: 12, top: 12,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14,
    backgroundColor: colors.background, ...floatingShadow,
  },
  // Except full screen, where the corner of the map is also the corner of the
  // phone and the status bar is sitting in it.
  readoutBelowStatusBar: { top: CONTROLS_TOP },
  readoutText: {
    color: colors.text, fontSize: 14.5, fontFamily: font.semibold,
    fontVariant: ["tabular-nums"],
  },
});
