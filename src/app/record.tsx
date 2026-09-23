import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn, FadeOut, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming,
} from "react-native-reanimated";
import { GlassPanel } from "@/components/GlassPanel";
import { Metric } from "@/components/Metric";
import { RoutePicker } from "@/components/RoutePicker";
import { RunMap } from "@/components/RunMap";
import { SessionDetail } from "@/components/SessionDetail";
import { SessionPicker } from "@/components/SessionPicker";
import { listRuns, readRoute, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { currentPace, elevationGainM, MAX_ACCURACY_M, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { CONTROL_SIZE, CONTROLS_TOP, useTabBarBottom } from "@/lib/layout";
import { locationAccess, useInitialLocation } from "@/lib/location";
import { drawnLine, type RoutePoint } from "@/lib/route";
import { toggleVoice, useSettings } from "@/lib/settings";
import { goalProgress, weekTotals } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import { distanceUnit, elevationUnit, paceUnit } from "@/lib/units";
import {
  activeDurationS, chooseSession, discard, finish, lap, pause, resume, start, useTracker,
} from "@/lib/tracker";
import { useCurrentWeather, weatherIcon, weatherLine } from "@/lib/weather";
import { sessionById, sessionName, stepLabel, stepRemaining } from "@/lib/workout";

const recordStrings = defineStrings({
  fr: {
    searchingGps: "recherche du GPS",
    gpsPrecise: (metres: number) => `GPS précis, ±${metres} m`,
    gpsFair: (metres: number) => `GPS moyen, ±${metres} m`,
    gpsWeak: "GPS faible, points ignorés",
    locationDenied: "localisation refusée",
    acquiringGps: "acquisition du GPS",
    gpsReady: "GPS prêt",
    paused: "En pause",
    autoPaused: "Pause automatique",
    running: "Course en cours",
    ready: "Prêt à courir",
    sessionBlocks: (name: string, blocks: number) => `${name} · ${blocks} blocs`,
    sessionDone: (name: string) => `${name} · terminée`,
    locationOffTitle: "Localisation désactivée",
    locationOffMessage: "Tread a besoin de ta position pour mesurer ta course. Autorise-la dans les réglages du téléphone, puis reviens ici.",
    cancel: "Annuler",
    openSettings: "Ouvrir les réglages",
    ok: "OK",
    shortTitle: "Course très courte",
    shortMessage: "Moins de 100 m enregistrés. La garder quand même ?",
    discard: "Abandonner",
    keep: "Garder",
    finishTitle: "Terminer la course ?",
    finishMessage: (distance: string, duration: string) => `${distance} ${distanceUnit()} en ${duration}.`,
    continue: "Continuer",
    finish: "Terminer",
    leave: "Quitter l'écran de course",
    sessionToggle: "SÉANCE",
    sessionToggleLabel: "Choisir une séance d'entraînement",
    routeToggle: "PARCOURS",
    routeToggleLabel: "Choisir le parcours affiché sur la carte",
    voiceToggle: "VOIX",
    voiceToggleLabel: "Annonces vocales",
    seeBlocks: (name: string) => `${name}, voir les blocs`,
    distance: "Distance",
    duration: "Durée",
    pace: "Allure",
    elevation: "Dénivelé",
    thisWeek: "Cette semaine",
    goalPercent: (percent: number) => `· objectif ${percent} %`,
    weekRuns: (count: number) => `· ${plural(count, "sortie", "sorties")}`,
    start: "Démarrer",
    pause: "Pause",
    resume: "Reprendre",
    lap: "Tour",
    lapLabel: (number: number) => `Terminer le tour ${number}`,
    lapLine: (number: number, distance: string, duration: string) =>
      `Tour ${number} · ${distance} ${distanceUnit()} · ${duration}`,
  },
  en: {
    searchingGps: "searching for GPS",
    gpsPrecise: (metres: number) => `GPS precise, ±${metres} m`,
    gpsFair: (metres: number) => `GPS fair, ±${metres} m`,
    gpsWeak: "GPS weak, points ignored",
    locationDenied: "location denied",
    acquiringGps: "acquiring GPS",
    gpsReady: "GPS ready",
    paused: "Paused",
    autoPaused: "Auto-paused",
    running: "Run in progress",
    ready: "Ready to run",
    sessionBlocks: (name: string, blocks: number) => `${name} · ${plural(blocks, "block", "blocks")}`,
    sessionDone: (name: string) => `${name} · done`,
    locationOffTitle: "Location turned off",
    locationOffMessage: "Tread needs your location to measure your run. Allow it in your phone's settings, then come back here.",
    cancel: "Cancel",
    openSettings: "Open settings",
    ok: "OK",
    shortTitle: "Very short run",
    shortMessage: "Less than 100 m recorded. Keep it anyway?",
    discard: "Discard",
    keep: "Keep",
    finishTitle: "Finish the run?",
    finishMessage: (distance: string, duration: string) => `${distance} ${distanceUnit()} in ${duration}.`,
    continue: "Keep going",
    finish: "Finish",
    leave: "Leave the run screen",
    sessionToggle: "SESSION",
    sessionToggleLabel: "Choose a training session",
    routeToggle: "ROUTE",
    routeToggleLabel: "Choose the route shown on the map",
    voiceToggle: "VOICE",
    voiceToggleLabel: "Voice announcements",
    seeBlocks: (name: string) => `${name}, see the blocks`,
    distance: "Distance",
    duration: "Time",
    pace: "Pace",
    elevation: "Elevation",
    thisWeek: "This week",
    goalPercent: (percent: number) => `· goal ${percent} %`,
    weekRuns: (count: number) => `· ${plural(count, "run", "runs")}`,
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    lap: "Lap",
    lapLabel: (number: number) => `End lap ${number}`,
    lapLine: (number: number, distance: string, duration: string) =>
      `Lap ${number} · ${distance} ${distanceUnit()} · ${duration}`,
  },
});

/** Height of the lap button under the run's controls. */
const LAP_HEIGHT = 36;

/** How long the panel takes to change shape, and everything above it with it. */
const GROW = { duration: 280 } as const;

/** How long the screen's furniture takes to slide in from its edges. */
const ARRIVE = { duration: 300 } as const;

/**
 * The two heights the panel takes, stated rather than measured.
 *
 * Measuring it was tried at length and failed in a different way each time:
 * too early and the figure comes back short, from inside the clip and the
 * measurement feeds the constraint that produced it, off the glass and a
 * native surface reports its layout unreliably. Worse, every one of those
 * attempts made the panel draw itself once, be measured, and resize — which
 * is the empty box that flashed on arrival.
 *
 * Stated outright, the panel has its height in its first frame. Both figures
 * are deliberately a little generous: air at the bottom of a panel costs
 * nothing, a clipped distance costs the number you went out to get. They are
 * the two values to revisit if the type ever changes size again.
 */
const PANEL_HEIGHT = { idle: 96, idleWeather: 122, live: 146 } as const;

/**
 * Holds the screen awake for as long as it is mounted. Inside Expo Go the GPS
 * stops with the screen, so this is only mounted while a run is recording.
 */
function KeepAwake() {
  useKeepAwake();
  return null;
}

/** A round control sized for a panel laid over the map. */
function RoundButton({
  icon, label, onPress, primary = false, danger = false, size = 46, disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  size?: number;
  disabled?: boolean;
}) {
  /*
   * The tap answered under the finger.
   *
   * This is the Taptic Engine, and it is the only place in the app that uses
   * it: everything a run has to say goes through the vibration motor instead,
   * because that has to be felt through a sleeve or a pocket. Here the finger
   * is already on the glass, so the lightest thing the phone can do is
   * enough — and anything heavier would be mistaken for the run talking.
   *
   * The weight follows what the press commits to. Starting or resuming sets
   * you moving and ending opens the way out, so both land; a pause is
   * momentary and undone by the next tap, so it barely does.
   */
  const weight =
    primary || danger ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(weight).catch(() => undefined);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        primary && styles.roundPrimary,
        danger && styles.roundDanger,
        pressed && styles.pressed,
        disabled && styles.roundDisabled,
      ]}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.45)}
        color={primary ? colors.accentText : danger ? colors.danger : colors.text}
        // A play triangle centred geometrically reads as off-centre: its mass
        // sits left of its box.
        style={icon === "play" ? styles.play : undefined}
      />
    </Pressable>
  );
}

export default function RecordScreen() {
  const tracker = useTracker();
  const router = useRouter();
  const { coords, granted } = useInitialLocation();
  // Asked of the sky as soon as the screen knows where it is. Null until it
  // answers, and null for good when it cannot: the line is then simply absent
  // and the panel keeps the height it has always had.
  const weather = useCurrentWeather(coords);
  const s = useStrings(recordStrings);
  const settings = useSettings();
  // The tab bar is hidden here, so the panel takes the room it used to leave
  // for it and sits where the bar would have been.
  const bottomInset = useTabBarBottom() + 8;
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  /** The block list, opened from the session line. */
  const [showingSteps, setShowingSteps] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [choosingRoute, setChoosingRoute] = useState(false);
  /**
   * The chosen route, drawn out, kept with the id it was read from.
   *
   * Kept together so that what is on screen can be worked out rather than
   * switched off and on: a route the setting no longer names is simply not
   * the one loaded, and nothing has to be cleared for the map to stop
   * showing it.
   */
  const [loaded, setLoaded] = useState<{ id: number; line: RoutePoint[] } | null>(null);
  /**
   * Its id rather than the route itself, because the settings are consulted
   * on every GPS fix and a route is a few hundred points. Routes are drawn
   * and edited in the Parcours tab; here one is only picked, or put down.
   */
  const chosenRoute = settings.routeId;
  const routeLine = chosenRoute !== null && loaded?.id === chosenRoute ? loaded.line : null;

  useEffect(() => {
    if (chosenRoute === null) return;
    let active = true;
    void readRoute(chosenRoute).then((found) => {
      // A route deleted while it was the chosen one never loads, so the map
      // goes on showing nothing rather than a line that no longer exists.
      if (active && found) setLoaded({ id: chosenRoute, line: drawnLine(found) });
    });
    return () => { active = false; };
  }, [chosenRoute]);
  const [history, setHistory] = useState<Run[]>([]);
  // Measured rather than assumed: the panel grows when a run starts, and the
  // controls stacked above it have to move with it instead of being buried.


  /**
   * Zero as the screen arrives, one once it has.
   *
   * A tab screen is mounted once and kept, so an entering animation would run
   * on the first visit and never again. Remounting the pieces on focus made
   * it play every time, but at the cost of a frame in which the panel existed
   * and its contents did not — the empty box that flashed on arrival. Driving
   * one value instead animates the same movement without taking anything
   * apart.
   */
  const focused = useIsFocused();
  const arrive = useSharedValue(1);
  useEffect(() => {
    if (!focused) return;
    arrive.value = 0;
    arrive.value = withTiming(1, ARRIVE);
  }, [focused, arrive]);

  const chevronArrive = useAnimatedStyle(
    () => ({ transform: [{ translateY: (1 - arrive.value) * -30 }] }),
    [],
  );
  const togglesArrive = useAnimatedStyle(
    () => ({ transform: [{ translateX: (1 - arrive.value) * 34 }] }),
    [],
  );
  const panelArrive = useAnimatedStyle(
    () => ({ transform: [{ translateY: (1 - arrive.value) * 40 }] }),
    [],
  );

  /**
   * Back the way you came, whether that was a tab or a session from the plan.
   *
   * This used to walk to the history unconditionally, which was right only by
   * accident: the history was the screen most people arrived from. Starting a
   * session from the programme made it wrong, because leaving the run sent
   * you somewhere you had never been. The fallback stays for the one case
   * with nothing behind it — a cold start straight onto this screen.
   */
  const leave = () => (router.canGoBack() ? router.back() : router.navigate("/"));

  const { width } = useWindowDimensions();
  /** How far the screen has been dragged towards the right, in points. */
  const dragX = useSharedValue(0);
  const dragged = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }), []);

  // Never arrive already pushed aside — a gesture abandoned by a call coming
  // in would otherwise leave the screen sitting off the edge, which looks
  // exactly like a blank one.
  useFocusEffect(useCallback(() => { dragX.set(0); }, [dragX]));


  /**
   * Our own back swipe, on a narrow strip down the left edge.
   *
   * The navigator's gesture does not fire here, and finding out why took a
   * bisect rather than an argument. It worked for five commits after this
   * screen became a pushed one, then stopped at the commit that fixed the
   * map locating itself in a loop — eight lines that touch nothing else.
   *
   * Which says what is really going on: MKMapView claims a touch starting at
   * the edge for its own panning, except while it is animating a region
   * change. The loop kept it permanently animating, so the edge stayed free
   * and the native gesture went on working by accident. Calming the map
   * handed the edge back to it.
   *
   * Hence a strip of our own, above the map, with its own recogniser — the
   * only arrangement that does not depend on what the map happens to be
   * doing. The cost is that it is a threshold and not a drag: the screen does
   * not follow the finger. Three attempts at persuading the native gesture
   * bought nothing, and a swipe that works beats one that looks better.
   */
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      dragX.set(Math.min(width, Math.max(0, event.translationX)));
    })
    .onEnd((event) => {
      if (event.translationX > 80 || event.velocityX > 700) {
        // Carried the rest of the way, then popped. Leaving first and
        // snapping back would play the stack's own pop animation over a
        // screen that had already jumped home.
        dragX.set(withTiming(width, { duration: 170 }, () => runOnJS(leave)()));
        return;
      }
      dragX.set(withTiming(0, { duration: 180 }));
    });


  const recording = tracker.status !== "idle";

  // The right-hand column, read from the bottom up: the panel, then the map's
  // locate button, then the two settings.
  /**
   * Everything above the panel is placed from its measured height, and placed
   * outright rather than eased into position.
   *
   * Easing was the mistake: the panel took its new height in a single frame
   * while the buttons glided for a quarter of a second, so the two overlapped
   * all the way. Moving them at once puts them a single frame apart — the one
   * it takes to measure — which nobody can see, and nothing ever overlaps.
   */
  const target = PANEL_HEIGHT[recording ? "live" : weather ? "idleWeather" : "idle"];

  /**
   * The panel's live height, and the single figure every piece above it
   * reads. One shared value is what makes them travel together instead of
   * each setting off from its own idea of where the panel currently is.
   */
  const panelH = useSharedValue(target);
  useEffect(() => {
    panelH.value = withTiming(target, GROW);
  }, [target, panelH]);

  const grow = useAnimatedStyle(() => ({ height: panelH.value }), []);
  const locateAbove = useDerivedValue(() => bottomInset + panelH.value + 12, [bottomInset]);
  const togglesRise = useAnimatedStyle(() => ({ bottom: locateAbove.value + CONTROL_SIZE + 10 }), []);

  useEffect(() => {
    if (!recording) return;
    // Refreshed once immediately, then every second. Without the first, the
    // clock a run starts against is the one captured when the screen mounted,
    // which may be minutes old: the elapsed time comes out negative and a
    // thirty minute block opens at 30:02 before falling back to 29:59.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [recording]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listRuns()
        .then((runs) => {
          if (active) setHistory(runs);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const distance = totalDistanceM(tracker.points);
  const duration = activeDurationS(tracker, now);
  const avgPace = paceSecPerKm(distance, duration);
  const pace = tracker.status === "running" ? currentPace(tracker.points, now) : null;
  const elevation = elevationGainM(tracker.points);
  const week = weekTotals(history);
  // Where the week stands, on the screen where it can still be changed. The
  // count of outings says what has happened; against a goal the same line
  // says what is left, which is the only version of it worth reading with a
  // hand on the play button.
  const goal = goalProgress(week.distanceM, settings.weeklyGoalM);

  const signal =
    tracker.accuracyM === null ? s.searchingGps
    : tracker.accuracyM <= 10 ? s.gpsPrecise(Math.round(tracker.accuracyM))
    : tracker.accuracyM <= 30 ? s.gpsFair(Math.round(tracker.accuracyM))
    : s.gpsWeak;

  const idleSignal =
    granted === false ? s.locationDenied
    : coords === null ? s.acquiringGps
    : s.gpsReady;

  const state = recording
    ? tracker.status === "paused" ? (tracker.autoPaused ? s.autoPaused : s.paused) : s.running
    : s.ready;

  /**
   * While a session is under way the status line is given over to it: which
   * block, how many there are, and what is left of this one. Nothing else on
   * this screen can say that, and mid-interval it is the only thing anyone
   * looks for.
   */
  const session = tracker.session;
  const step = session?.steps[tracker.stepIndex] ?? null;
  const sessionLine = (() => {
    if (!session) return null;
    if (!recording) return s.sessionBlocks(sessionName(session), session.steps.length);
    if (!step) return s.sessionDone(sessionName(session));
    const left = stepRemaining(
      step,
      distance - tracker.stepStartM,
      activeDurationS(tracker, now) - tracker.stepStartS,
    );
    const remaining = left.metres !== null
      ? `${Math.round(left.metres)} m`
      : formatDuration(Math.ceil(left.seconds ?? 0));
    return `${tracker.stepIndex + 1}/${session.steps.length} · ${stepLabel(step)} · ${remaining}`;
  })();

  /**
   * Once a lap has been pressed, the status line follows the lap under way:
   * on a track that is the figure being run against, not the whole run's.
   * A session's line still wins, since it already divides the run.
   */
  const lastLap = tracker.laps[tracker.laps.length - 1] ?? { distanceM: 0, durationS: 0 };
  const lapLine = recording && tracker.laps.length > 0
    ? s.lapLine(
      tracker.laps.length + 1,
      formatDistance(distance - lastLap.distanceM),
      formatDuration(duration - lastLap.durationS),
    )
    : null;
  const guideLine = sessionLine ?? lapLine;

  // The same threshold the tracker throws fixes away at, so the warning and
  // the filter can never disagree about what counts as a poor signal.
  const weakSignal =
    (recording && tracker.accuracyM !== null && tracker.accuracyM > MAX_ACCURACY_M) || granted === false;

  /**
   * The question before stopping, in the system's own alert.
   *
   * Very short runs ask the opposite question to ordinary ones — keep this,
   * or throw it away — so the buttons swap rather than the wording softening.
   * A hundred metres is almost always a pocket, and offering to save it as
   * the obvious choice is how a history fills with noise.
   */
  /**
   * Start, once the phone has agreed to say where it is.
   *
   * Asked here rather than left to the tracker, because the tracker can only
   * fail: it has no way to send anybody to the settings, and a refusal
   * reported as a line of red text in the panel left people pressing play on
   * a map that would never move.
   */
  async function begin() {
    const access = await locationAccess();
    if (access === "granted") {
      void start();
      return;
    }
    Alert.alert(
      s.locationOffTitle,
      s.locationOffMessage,
      access === "blocked"
        ? [
          { text: s.cancel, style: "cancel" },
          { text: s.openSettings, onPress: () => void Linking.openSettings() },
        ]
        : [{ text: s.ok }],
    );
  }

  function askFinish() {
    if (tooShort) {
      Alert.alert(s.shortTitle, s.shortMessage, [
        { text: s.discard, style: "destructive", onPress: () => void discard() },
        { text: s.keep, onPress: () => void close() },
      ]);
      return;
    }
    Alert.alert(
      s.finishTitle,
      s.finishMessage(formatDistance(distance), formatDuration(duration)),
      [
        { text: s.continue, style: "cancel" },
        { text: s.finish, onPress: () => void close() },
      ],
    );
  }

  async function close() {
    setFinishing(true);
    // Read before finishing, which clears it: the sheet needs to know where
    // this run came from so that closing it lands somewhere sensible.
    const from = tracker.planOrder !== null ? "plan" : "history";
    const id = await finish();
    setFinishing(false);
    if (id !== null) {
      router.push({ pathname: "/run/[id]", params: { id: String(id), from } });
    }
  }

  const tooShort = distance < 100;

  return (
    // Translated, never faded: an animated opacity is what the map and the
    // glass refuse to composite under. What the translation uncovers is the
    // tab this screen was pushed from, which is why the route below asks for
    // a transparent background — without it, dragging would reveal this
    // screen's own backdrop and look like a blank sheet.
    <Animated.View style={[styles.screen, dragged]}>
      {/* The map is the screen now, not something hidden behind a button. */}
      <RunMap
        points={tracker.points}
        follow
        route={routeLine}
        initialCenter={coords}
        locateOnFocus
        controlsAbove={locateAbove}
        controlsArrive={arrive}
        style={styles.map}
      />
      {recording && <KeepAwake />}

      <GestureDetector gesture={swipeBack}>
        <View style={styles.backEdge} />
      </GestureDetector>

      {/* The way out, since the tab bar no longer offers one. Top left, in the
          corner a back button lives in everywhere else, and in the same glass
          as the map's own controls so it reads as part of the map rather than
          as something dropped on top of it. */}
      <Animated.View pointerEvents="box-none" style={[styles.leave, chevronArrive]}>
        <GlassPanel style={styles.leavePill}>
          <Pressable
            onPress={leave}
            accessibilityRole="button"
            accessibilityLabel={s.leave}
            hitSlop={8}
            style={({ pressed }) => [styles.leaveButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </GlassPanel>
      </Animated.View>

      {/* Cut to the same size as the map's own button just below, so the two
          read as one column rather than as two unrelated things that happen
          to be near each other. */}
      {/* Position outside, arrival inside: on one view the two animations
          write to the same translation and fight over it, which shows up as
          the buttons shivering as they land. */}
      <Animated.View pointerEvents="box-none" style={[styles.toggles, togglesRise]}>
        {/* The spacing belongs on this view, not the one outside it: the
            pills are its children, and a gap set on their grandparent
            separates nothing. */}
        <Animated.View style={[styles.toggleStack, togglesArrive]}>
          <GlassPanel style={styles.togglePill}>
            <Toggle
              on={session !== null || settings.targetPaceSKm !== null}
              onPress={() => setChoosing(true)}
              icon="list"
              name={s.sessionToggle}
              label={s.sessionToggleLabel}
            />
          </GlassPanel>
          {/* The route is shown for what it is — a choice that holds from one
              run to the next — so it has to be visible and undoable here,
              where the run starts, and not only in the tab it was picked in. */}
          <GlassPanel style={styles.togglePill}>
            <Toggle
              on={chosenRoute !== null}
              onPress={() => setChoosingRoute(true)}
              icon="map"
              name={s.routeToggle}
              label={s.routeToggleLabel}
            />
          </GlassPanel>
          <GlassPanel style={styles.togglePill}>
            <Toggle
              on={settings.voice}
              onPress={() => void toggleVoice()}
              icon={settings.voice ? "volume-high" : "volume-mute"}
              name={s.voiceToggle}
              label={s.voiceToggleLabel}
            />
          </GlassPanel>
        </Animated.View>
      </Animated.View>

      {/* Sits above the tab bar rather than replacing it: the tab bar is how
          you leave this screen, so it has to stay reachable. */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.bottom, { bottom: bottomInset }, panelArrive]}
      >
        <Animated.View style={[styles.panelClip, grow]}>
        <GlassPanel style={styles.panel} interactive>
            {/* One row for the whole panel, so the button centres against
                everything written beside it. */}
            <View style={styles.panelRow}>
              <View style={styles.panelMetrics}>
                {/* The session line opens the whole session. Mid-interval it
                    says which block and what is left of it, which is the only
                    thing anyone looks for — but "3/23" says nothing about what
                    the other twenty are, and that question has nowhere else to
                    go on this screen. */}
                <Pressable
                  onPress={() => session && setShowingSteps(true)}
                  disabled={session === null}
                  accessibilityRole={session ? "button" : "text"}
                  accessibilityLabel={session ? s.seeBlocks(sessionName(session)) : undefined}
                  hitSlop={6}
                >
                  <Text
                    style={[styles.state, weakSignal && styles.stateWeak, guideLine && styles.stateSession]}
                    numberOfLines={1}
                  >
                    {guideLine ?? `${state} · ${recording ? signal : idleSignal}`}
                  </Text>
                </Pressable>

                {recording ? (
                  // Two rows of two rather than four abreast: on a narrow phone
                  // the single row fell to 46 points a column, which clipped the
                  // unit off the pace.
                  <View style={styles.metricStack}>
                    <View style={styles.metricRow}>
                      <Metric compact label={s.distance} value={formatDistance(distance)} unit={distanceUnit()} />
                      <Metric compact label={s.duration} value={formatDuration(duration)} />
                    </View>
                    <View style={styles.metricRow}>
                      <Metric compact label={s.pace} value={formatPace(pace ?? avgPace)} unit={paceUnit()} />
                      <Metric compact label={s.elevation} value={formatElevation(elevation)} unit={elevationUnit()} />
                    </View>
                  </View>
                ) : (
                  // No entering animation on these: nested inside a panel that
                  // is itself arriving, a child's own entering can be dropped
                  // and leave the view stuck at the opacity it started from —
                  // which is how the week's distance went missing entirely.
                  <>
                    <Metric
                      compact
                      label={s.thisWeek}
                      value={`${formatDistance(week.distanceM)} ${distanceUnit()}`}
                      unit={
                        goal
                          ? s.goalPercent(goal.percent)
                          : week.runs > 0
                            ? s.weekRuns(week.runs)
                            : undefined
                      }
                    />
                    {/* What it is like outside, on the one screen where the
                        question is still open. Everything else the app knows
                        is about a run already run; this is the only line that
                        changes what you put on before going out — and it is
                        written the way you would say it out loud rather than
                        as another measurement with a label over it. */}
                    {weather ? (
                      <View style={styles.weather}>
                        <Ionicons
                          name={weatherIcon(weather.code, weather.day)}
                          size={15}
                          color={colors.muted}
                        />
                        <Text style={styles.weatherText} numberOfLines={1}>
                          {weatherLine(weather)}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}
                {tracker.error && <Text style={styles.error}>{tracker.error}</Text>}
              </View>

              {/* A box of fixed size holding two layers that cross-fade in
                  place. Laid out in flow instead, the arriving buttons pushed
                  the leaving one aside on their way in — which is what made
                  the play button look like it came back from below. */}
              <View style={[styles.panelControls, recording && styles.panelControlsRunning]}>
                {!recording ? (
                  <Animated.View
                    key="rest"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(140)}
                    style={styles.controlLayer}
                  >
                    <RoundButton icon="play" label={s.start} onPress={() => void begin()} primary size={52} />
                  </Animated.View>
                ) : (
                  <Animated.View
                    key="running"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(140)}
                    style={[styles.controlLayer, styles.controlColumn]}
                  >
                    <View style={styles.controlRow}>
                      {tracker.status === "running" ? (
                        <RoundButton icon="pause" label={s.pause} onPress={pause} />
                      ) : (
                        <RoundButton icon="play" label={s.resume} onPress={resume} primary />
                      )}
                      <RoundButton
                        icon="stop"
                        label={s.finish}
                        onPress={askFinish}
                        danger
                        disabled={finishing}
                      />
                    </View>
                    {/* Under the two that change the run, not beside them: a
                        lap is pressed mid-effort, without looking, and has to
                        be the one button that cannot be mistaken for a stop. */}
                    <LapButton
                      label={s.lap}
                      accessibilityLabel={s.lapLabel(tracker.laps.length + 1)}
                      onPress={lap}
                      disabled={tracker.status !== "running"}
                    />
                  </Animated.View>
                )}
              </View>
            </View>
        </GlassPanel>
        </Animated.View>
      </Animated.View>

      <SessionDetail
        visible={showingSteps}
        session={session}
        // Only while running: standing still, the question is what the session
        // is, not how far into it you are.
        currentIndex={recording ? tracker.stepIndex : null}
        onClose={() => setShowingSteps(false)}
      />

      <RoutePicker
        visible={choosingRoute}
        chosen={chosenRoute}
        onClose={() => setChoosingRoute(false)}
      />

      <SessionPicker
        visible={choosing}
        chosen={tracker.session?.id ?? null}
        // The picker offers the catalogue, so it deals in names; a session
        // coming from a programme is handed over whole by the plan screen.
        onChoose={(id) => chooseSession(sessionById(id))}
        onClose={() => setChoosing(false)}
      />

    </Animated.View>
  );
}

/**
 * The lap button: a word as well as a flag, since a flag alone reads as a
 * finish line. Wide and flat, so it is found by feel under the two round
 * buttons. The lightest tap under the finger; the voice says the lap.
 */
function LapButton({
  label, accessibilityLabel, onPress, disabled,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [styles.lap, pressed && styles.pressed, disabled && styles.roundDisabled]}
    >
      <Ionicons name="flag-outline" size={16} color={colors.text} />
      <Text style={styles.lapText}>{label}</Text>
    </Pressable>
  );
}

/**
 * A switch in the settings pill: an icon over what it does.
 *
 * The icons carried the whole meaning before, and three of them side by side
 * told you nothing — a speaker, a pause sign and a heart are each ambiguous
 * enough on their own, and a setting nobody can name is a setting nobody
 * touches. The word says what it is, the colour says whether it is on.
 */
function Toggle({
  on, onPress, icon, name, label,
}: {
  on: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** The word shown under the icon. Short enough to sit over a map. */
  name: string;
  /** The whole sentence, for anyone listening rather than looking. */
  label: string;
}) {
  // An inactive setting still has to be readable. State is told by which
  // colour it is, not by how nearly invisible it has become — at forty-two
  // percent black on glass over a map, the off state simply vanished.
  const tint = on ? colors.accent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.toggleName, { color: tint }]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  map: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },
  // Above the map, which is the whole point: below it, the map eats the drag.
  backEdge: { position: "absolute", left: 0, top: 0, bottom: 0, width: 26 },

  // Right-aligned so the pills, the locate button and the panel's edge all
  // land on one line down the side of the screen.
  toggles: { position: "absolute", right: 12, alignItems: "flex-end" },
  toggleStack: { alignItems: "flex-end", gap: 10 },
  leave: { position: "absolute", top: CONTROLS_TOP, left: 12 },
  leavePill: { borderRadius: CONTROL_SIZE / 2, padding: 0 },
  leaveButton: {
    width: CONTROL_SIZE, height: CONTROL_SIZE,
    alignItems: "center", justifyContent: "center",
  },
  // The same outline the panel's buttons were given, and for the same
  // reason: glass laid over a map has no edge of its own.
  togglePill: {
    borderRadius: CONTROL_SIZE / 2, padding: 0,
    borderWidth: 1.5, borderColor: colors.hairline,
  },
  // Square, exactly the map button's size: the three sit in one column and
  // any difference between them would read as a mistake.
  toggle: {
    width: CONTROL_SIZE, height: CONTROL_SIZE,
    alignItems: "center", justifyContent: "center", gap: 1,
  },
  toggleName: { fontSize: 9, fontFamily: font.semibold, letterSpacing: 0.6 },

  bottom: { position: "absolute", left: 12, right: 12 },
  panelClip: { borderRadius: 22, overflow: "hidden" },
  // The glass crops its own content too: a parent's clip does not always hold
  // a native surface's children in, and what escapes it lands outside the
  // panel altogether.
  // The glass fills the clip rather than sizing to its content, so its
  // surface is always exactly the panel and never a shape inside it.
  panel: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12,
    overflow: "hidden",
  },
  state: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  stateWeak: { color: colors.warning },
  // A session line is instruction rather than commentary, so it is given
  // the accent and the app's heavier face.
  stateSession: { color: colors.accent, fontFamily: font.semibold },
  panelRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  panelMetrics: { flex: 1, gap: 8, minWidth: 0 },
  metricStack: { gap: 10 },
  metricRow: { flexDirection: "row", gap: 12 },
  // Wide enough for the two buttons of a run in progress, tall enough for the
  // larger single one at rest: the box never changes, so nothing around it
  // shifts when its contents do.
  panelControls: { width: CONTROL_SIZE * 2 + 8, height: 52, flexShrink: 0 },
  // Room for the lap button under the two round ones. The panel is taller
  // than this while running anyway, so the box growing moves nothing.
  panelControlsRunning: { height: 46 + 8 + LAP_HEIGHT },
  controlColumn: { flexDirection: "column", gap: 8 },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  lap: {
    alignSelf: "stretch", height: LAP_HEIGHT, borderRadius: LAP_HEIGHT / 2,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1.5, borderColor: colors.subtle,
  },
  lapText: { color: colors.text, fontSize: 15, fontFamily: font.semibold },
  controlLayer: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },

  // A real outline rather than a hairline. These buttons sit on glass over a
  // map, where a third of a point at the palest grey in the palette simply
  // disappeared — the pause read as an icon floating on the panel rather than
  // as something to press.
  round: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.subtle,
  },
  roundPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  // The ring carries the warning as much as the icon does, so it takes the
  // full colour instead of a tenth of it.
  roundDanger: { borderColor: colors.danger },
  roundDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.55 },
  play: { marginLeft: 2 },

  weather: { flexDirection: "row", alignItems: "center", gap: 6 },
  weatherText: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium, flexShrink: 1 },

  error: { color: colors.danger, fontSize: 15 },
});
