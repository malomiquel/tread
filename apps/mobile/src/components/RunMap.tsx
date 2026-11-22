import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, useColorScheme, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import MapView, { Marker, Polyline, type UserLocationChangeEvent } from "react-native-maps";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { formatDistance, formatDuration } from "@tread/core/format";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { bounds, regionAround, segments, type TrackPoint } from "@tread/core/geo";
import { IgnCredit, IgnTiles, useIgnChosen, useIgnCoverage } from "@/components/IgnLayer";
import { CONTROL_SIZE, CONTROLS_TOP } from "@/lib/layout";
import { getCurrentCoords, locationAccess, watchCompass, type Coords } from "@/lib/location";
import { readColour } from "@tread/core/raster";
import { buildReplay, drawnSoFar, headAt, REPLAY_MS } from "@tread/core/replay";
import type { RoutePoint } from "@tread/core/route";
import { colors, floatingShadow, font, literalColors } from "@/lib/theme";
import { distanceUnit } from "@tread/core/units";

const mapStrings = defineStrings({
  fr: {
    stopReplay: "Arrêter le tracé animé",
    locationOffTitle: "Localisation désactivée",
    locationOffMessage: "Pour centrer la carte sur toi, autorise la localisation dans les réglages du téléphone.",
    cancel: "Annuler",
    openSettings: "Ouvrir les réglages",
    replay: "Rejouer le parcours",
    shrink: "Réduire la carte",
    expand: "Agrandir la carte",
    recenter: "Recentrer la carte sur ma position",
    headingUp: "Tourner la carte dans ma direction",
  },
  en: {
    locationOffTitle: "Location turned off",
    locationOffMessage: "To centre the map on you, allow location in your phone's settings.",
    cancel: "Cancel",
    openSettings: "Open settings",
    stopReplay: "Stop the animated track",
    replay: "Replay the route",
    shrink: "Shrink the map",
    expand: "Expand the map",
    recenter: "Recenter the map on my location",
    headingUp: "Turn the map the way I face",
  },
});

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
  /**
   * Whether the map starts turned the way the runner faces, as a satnav
   * does, rather than north up. Only with `follow`; the runner can switch
   * either way with the button, and a change of this prop wins again.
   */
  headingUp?: boolean;
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
  /**
   * A drawn route to follow, under the track.
   *
   * It changes appearance depending on whether there is anything over it. On
   * its own — before a run starts — it is the subject of the map and is drawn
   * as such: solid, full ink. Once a track is being laid over it, it steps
   * back into dashes and half the ink, because from that moment the question
   * is no longer "where am I going" but "am I still on it", and that question
   * is only readable if the two lines cannot be confused.
   *
   * Drawn faint from the start, as it was first, it read as a line that had
   * failed to load rather than as a plan.
   */
  route?: RoutePoint[] | null;
  /**
   * Where the ghost is — the record on this route, replayed — or nothing.
   * A hollow dot in the track's colour: the same runner, not there.
   */
  ghost?: { lat: number; lng: number } | null;
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
/** Room left under the IGN credit for the platform map's own logo. */
const CREDIT_LIFT = 28;
const RUNNER_ZOOM = 0.006;
/** The tilt of the map while it turns with the runner, as a satnav leans the road away. */
const HEADING_PITCH = 35;
/** Below this, the GPS course is noise: the compass says which way the runner faces. */
const COURSE_MIN_SPEED = 1.2;
/** A turn smaller than this is not worth moving the map for. */
const HEADING_STEP = 4;

/** The smallest angle between two headings, in degrees. */
function headingGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/**
 * The run's track on Apple Maps or Google Maps depending on the platform.
 * One polyline per segment, so a pause never draws a line between where you
 * stopped and where you picked up again.
 */
export function RunMap({
  points, follow = false, headingUp: headingUpByDefault = false, fitAll = false, initialCenter = null, locateOnFocus = false,
  replayable = false, route = null, ghost = null, onToggleFullscreen, fullscreen = false, controlsBottom = 12,
  controlsAtTop = false, controlsArrive, controlsAbove, style,
}: Props) {
  const s = useStrings(mapStrings);
  const map = useRef<MapView>(null);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  // Position and arrival stay on separate views: on one, the two animations
  // write to the same translation and fight over it, which shows up as the
  // buttons shivering as they land.
  const ride = useAnimatedStyle(() => ({
    bottom: controlsAbove ? controlsAbove.value : controlsBottom,
    transform: [{ translateX: controlsArrive ? (1 - controlsArrive.value) * 34 : 0 }],
  }), [controlsAbove, controlsArrive, controlsBottom]);
  // The credit rides with the controls, on the other side and a little
  // higher, clear of the platform map's own logo in the corner.
  const creditRide = useAnimatedStyle(() => ({
    bottom: (controlsAbove && !controlsAtTop ? controlsAbove.value : controlsBottom) + CREDIT_LIFT,
    transform: [{ translateX: controlsArrive ? (controlsArrive.value - 1) * 34 : 0 }],
  }), [controlsAbove, controlsArrive, controlsBottom, controlsAtTop]);
  const [locating, setLocating] = useState(false);

  /**
   * The map turned the way the runner faces. The runner is then an arrow
   * that always points up the screen, and the street ahead is the street
   * above it, as on a satnav.
   */
  const [headingUp, setHeadingUp] = useState(follow && headingUpByDefault);
  useEffect(() => setHeadingUp(follow && headingUpByDefault), [follow, headingUpByDefault]);
  /** The phone's own fix, fresher than the track and there before the start. */
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const course = useRef<{ degrees: number; speed: number } | null>(null);
  const compass = useRef<number | null>(null);
  /** What the camera was last aimed at, so small turns and steps leave it alone. */
  const aimed = useRef<{ lat: number; lng: number; heading: number; at: number } | null>(null);
  const hereRef = useRef(here);
  hereRef.current = here;

  /**
   * Point the camera where the runner is going. Moving, that is the GPS
   * course: the compass of a phone in a pocket or swinging in a hand says
   * nothing about the way the legs go. Standing, the course is noise, and
   * the compass is what says which way the runner faces.
   */
  const aim = useCallback((force = false) => {
    const spot = hereRef.current;
    if (!spot) return;
    const moving = course.current && course.current.speed >= COURSE_MIN_SPEED ? course.current.degrees : null;
    const heading = moving ?? compass.current ?? aimed.current?.heading ?? 0;
    const previous = aimed.current;
    const now = Date.now();
    if (!force && previous) {
      const turned = headingGap(previous.heading, heading) >= HEADING_STEP;
      const moved = previous.lat !== spot.lat || previous.lng !== spot.lng;
      if (!turned && !moved) return;
      // The compass speaks many times a second; a camera asked as often never settles.
      if (!moved && now - previous.at < 250) return;
    }
    aimed.current = { lat: spot.lat, lng: spot.lng, heading, at: now };
    map.current?.animateCamera(
      { center: { latitude: spot.lat, longitude: spot.lng }, heading, pitch: HEADING_PITCH },
      { duration: 450 },
    );
  }, []);

  useEffect(() => {
    if (!headingUp) return;
    const stop = watchCompass((degrees) => {
      compass.current = degrees;
      aim();
    });
    aim(true);
    return stop;
  }, [headingUp, aim]);

  const onUserLocation = useCallback((event: UserLocationChangeEvent) => {
    const fix = event.nativeEvent.coordinate;
    if (!fix) return;
    course.current = fix.heading >= 0 ? { degrees: fix.heading, speed: fix.speed } : null;
    setHere({ lat: fix.latitude, lng: fix.longitude });
  }, []);

  useEffect(() => {
    if (headingUp) aim();
  }, [headingUp, here, aim]);

  const toggleHeadingUp = () => {
    if (headingUp) {
      aimed.current = null;
      map.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 450 });
    }
    setHeadingUp(!headingUp);
  };

  const empty = points.length === 0;
  const last = points.length ? points[points.length - 1] : null;
  const tracks = segments(points);

  /** Whether anything is being drawn over the route, which changes how it is drawn. */
  const underway = points.length > 1;
  const plan = readColour(literalColors.track[scheme]);
  const planInk = `rgba(${plan[0]}, ${plan[1]}, ${plan[2]}, 0.28)`;

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
    // Turned with the runner, the camera is aimed by its own fixes instead.
    if (!follow || !last || headingUp) return;
    map.current?.animateCamera({ center: { latitude: last.lat, longitude: last.lng } }, { duration: 600 });
  }, [follow, last, headingUp]);

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

  /**
   * The button's own way in. A tap on a map that cannot find the phone used
   * to do nothing at all; once the phone has stopped asking, the way forward
   * is its settings, and the button says so. The automatic locate on arrival
   * stays silent.
   */
  const recentreByHand = async () => {
    const access = await locationAccess().catch(() => "denied" as const);
    if (access === "blocked") {
      const words = mapStrings();
      Alert.alert(words.locationOffTitle, words.locationOffMessage, [
        { text: words.cancel, style: "cancel" },
        { text: words.openSettings, onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    if (access === "granted") void recentre();
  };

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
  const ign = useIgnCoverage({ lat: initialRegion.latitude, lng: initialRegion.longitude });
  // Apple's shops and buildings drawn over a topo map turn it into a jumble.
  const ignShown = useIgnChosen() && ign.covered;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle={scheme}
        showsUserLocation={!fitAll}
        onUserLocationChange={follow ? onUserLocation : undefined}
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        onMapReady={frameTrack}
        onRegionChangeComplete={ign.onRegionChangeComplete}
        showsPointsOfInterests={!ignShown}
        showsBuildings={!ignShown}
      >
        <IgnTiles covered={ign.covered} />

        {/* Drawn first, so the track is drawn over it rather than under. */}
        {route && route.length > 1 && (
          <Polyline
            coordinates={route.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
            strokeColor={underway ? planInk : literalColors.track[scheme]}
            // Once a track is being laid over it, the route becomes what a
            // satnav draws: a wide, pale band, with the run drawn narrow and
            // dark down its middle. On it, the dark line sits inside the band;
            // off it, the two part visibly. Dashes and dots were tried first
            // and read as noise over a street map.
            strokeWidth={underway ? 7 : 4}
            lineCap="round"
            lineJoin="round"
          />
        )}

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

        {ghost && (
          <Marker
            coordinate={{ latitude: ghost.lat, longitude: ghost.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.ghost, { borderColor: literalColors.track[scheme] }]} />
          </Marker>
        )}

        {/* The runner, turned with the map: an arrow pointing up the screen,
            which is the way they are going. Laid over the platform's own
            dot, which says nothing about direction. */}
        {headingUp && here && (
          <Marker
            coordinate={{ latitude: here.lat, longitude: here.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={10}
          >
            <View style={[styles.arrow, { backgroundColor: literalColors.track[scheme] }]}>
              <Ionicons name="navigate" size={15} color={literalColors.background[scheme]} style={styles.arrowIcon} />
            </View>
          </Marker>
        )}

        {/* The replay's head. A plain dot, because anything with a picture in it
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

      <IgnCredit covered={ign.covered} style={creditRide} />

      <Animated.View style={[styles.controls, controlsAtTop ? styles.controlsTop : ride]}>
        <View style={styles.controlStack}>
        {replay && (
          <Pressable
            onPress={() => setPlayedMs((running) => (running === null ? 0 : null))}
            accessibilityRole="button"
            accessibilityLabel={head ? s.stopReplay : s.replay}
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
            accessibilityLabel={fullscreen ? s.shrink : s.expand}
            hitSlop={8}
            style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
          >
            <Ionicons name={fullscreen ? "contract" : "expand"} size={19} color={colors.text} />
          </Pressable>
        )}
        {follow && (
          <Pressable
            onPress={toggleHeadingUp}
            accessibilityRole="switch"
            accessibilityState={{ checked: headingUp }}
            accessibilityLabel={s.headingUp}
            hitSlop={8}
            style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
          >
            <Ionicons
              name={headingUp ? "navigate" : "navigate-outline"}
              size={19}
              color={headingUp ? colors.accent : colors.text}
            />
          </Pressable>
        )}
        {!fitAll && (
        <Pressable
          onPress={() => (headingUp ? aim(true) : void recentreByHand())}
          accessibilityRole="button"
          accessibilityLabel={s.recenter}
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
            {`${formatDuration(head.elapsedMs / 1000)} · ${formatDistance(head.metresRun)} ${distanceUnit()}`}
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
  // The size of the platform's dot and its halo, so it covers it whole.
  arrow: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#ffffff",
  },
  // Ionicons' arrow points to the top right; turned back, it points ahead.
  arrowIcon: { transform: [{ rotate: "-45deg" }], marginTop: 1 },
  ghost: { width: 13, height: 13, borderRadius: 6.5, borderWidth: 2.5, opacity: 0.6 },
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
