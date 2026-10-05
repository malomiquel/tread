import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming,
} from "react-native-reanimated";
import { GlassPanel } from "@/components/GlassPanel";
import { Metric } from "@/components/Metric";
import { RoutePicker } from "@/components/RoutePicker";
import { RideDashboard } from "@/components/RideDashboard";
import { RunDashboard, type DashboardBlock } from "@/components/RunDashboard";
import { RunMap } from "@/components/RunMap";
import { SessionDetail } from "@/components/SessionDetail";
import { Segmented } from "@/components/Segmented";
import { SessionPicker } from "@/components/SessionPicker";
import { ofSport, sportName, type Sport } from "@/lib/activity";
import { listRuns, readRoute, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace, formatSpeed } from "@/lib/format";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { currentPace, elevationGainM, MAX_ACCURACY_M, paceSecPerKm, topSpeedMs, totalDistanceM } from "@/lib/geo";
import { CONTROL_SIZE, CONTROLS_TOP, useTabBarBottom } from "@/lib/layout";
import { locationAccess, useInitialLocation } from "@/lib/location";
import { ghostAt, ghostGapS } from "@/lib/ghost";
import { turnName } from "@/lib/guidance";
import { drawnLine, type RoutePoint } from "@/lib/route";
import { measure } from "@/lib/goals";
import { setSport, toggleVoice, useSettings, weeklyGoal } from "@/lib/settings";
import { goalProgress, weekTotals } from "@/lib/stats";
import { colors, floatingShadow, font } from "@/lib/theme";
import { distanceUnit, elevationUnit, paceUnit, speedUnit } from "@/lib/units";
import {
  activeDurationS, chooseSession, clearAutoFinished, discard, finish, heldPace, lap, paceForStep, pause, resume,
  start, useTracker,
} from "@/lib/tracker";
import { formatTemperature, useCurrentWeather, weatherIcon, weatherLine } from "@/lib/weather";
import { findSession } from "@/lib/sessionLibrary";
import { isPaced, sessionName, stepLabel, stepRemaining } from "@/lib/workout";

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
    running: { running: "Course en cours", cycling: "Sortie vélo en cours" } as Record<Sport, string>,
    ready: { running: "Prêt à courir", cycling: "Prêt à rouler" } as Record<Sport, string>,
    sessionBlocks: (name: string, blocks: number) => `${name} · ${blocks} blocs`,
    sessionDone: (name: string) => `${name} · terminée`,
    locationOffTitle: "Localisation désactivée",
    locationOffMessage: "Tread a besoin de ta position pour mesurer ta sortie. Autorise-la dans les réglages du téléphone, puis reviens ici.",
    cancel: "Annuler",
    openSettings: "Ouvrir les réglages",
    ok: "OK",
    shortTitle: { running: "Course très courte", cycling: "Sortie très courte" } as Record<Sport, string>,
    shortMessage: "Moins de 100 m enregistrés. La garder quand même ?",
    discard: "Abandonner",
    keep: "Garder",
    finishTitle: { running: "Terminer la course ?", cycling: "Terminer la sortie ?" } as Record<Sport, string>,
    finishMessage: (distance: string, duration: string) => `${distance} ${distanceUnit()} en ${duration}.`,
    continue: "Continuer",
    finish: "Terminer",
    saveFailedTitle: "Sortie non enregistrée",
    saveFailedMessage: "Rien n'est perdu : elle reste en pause. Appuie de nouveau sur Terminer pour réessayer.",
    leave: "Quitter l'écran de course",
    sportLabel: "Ce que tu vas enregistrer",
    sessionToggle: "SÉANCE",
    sessionToggleLabel: "Choisir une séance d'entraînement",
    routeToggle: "PARCOURS",
    routeToggleLabel: "Choisir le parcours affiché sur la carte",
    voiceToggle: "VOIX",
    voiceToggleLabel: "Annonces vocales",
    viewPace: "Allure",
    viewSpeed: "Vitesse",
    viewMap: "Carte",
    average: "Moyenne",
    seeBlocks: (name: string) => `${name}, voir les blocs`,
    distance: "Distance",
    duration: "Durée",
    pace: "Allure",
    speed: "Vitesse",
    elevation: "Dénivelé",
    thisWeek: "Cette semaine",
    goalPercent: (percent: number) => `· objectif ${percent} %`,
    weekRuns: (count: number) => `· ${plural(count, "sortie", "sorties")}`,
    start: "Démarrer",
    pause: "Pause",
    resume: "Reprendre",
    routeLeft: (distance: string) => `Parcours · ${distance} ${distanceUnit()} restants`,
    ghostAhead: (gap: string) => `${gap} d'avance`,
    ghostBehind: (gap: string) => `${gap} de retard`,
    ghostLevel: "à égalité",
    ghostOnly: (gap: string) => `Record · ${gap}`,
    routeTurn: (direction: string, metres: string) => `${direction.charAt(0).toUpperCase()}${direction.slice(1)} dans ${metres}`,
    routeOff: (metres: string) => `Hors parcours · à ${metres}`,
    routeDone: "Parcours terminé",
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
    running: { running: "Run in progress", cycling: "Ride in progress" },
    ready: { running: "Ready to run", cycling: "Ready to ride" },
    sessionBlocks: (name: string, blocks: number) => `${name} · ${plural(blocks, "block", "blocks")}`,
    sessionDone: (name: string) => `${name} · done`,
    locationOffTitle: "Location turned off",
    locationOffMessage: "Tread needs your location to measure your outing. Allow it in your phone's settings, then come back here.",
    cancel: "Cancel",
    openSettings: "Open settings",
    ok: "OK",
    shortTitle: { running: "Very short run", cycling: "Very short ride" },
    shortMessage: "Less than 100 m recorded. Keep it anyway?",
    discard: "Discard",
    keep: "Keep",
    finishTitle: { running: "Finish the run?", cycling: "Finish the ride?" },
    finishMessage: (distance: string, duration: string) => `${distance} ${distanceUnit()} in ${duration}.`,
    continue: "Keep going",
    finish: "Finish",
    saveFailedTitle: "Outing not saved",
    saveFailedMessage: "Nothing is lost: it stays paused. Press Finish again to try once more.",
    leave: "Leave the run screen",
    sportLabel: "What you are about to record",
    sessionToggle: "SESSION",
    sessionToggleLabel: "Choose a training session",
    routeToggle: "ROUTE",
    routeToggleLabel: "Choose the route shown on the map",
    voiceToggle: "VOICE",
    voiceToggleLabel: "Voice announcements",
    viewPace: "Pace",
    viewSpeed: "Speed",
    viewMap: "Map",
    average: "Average",
    seeBlocks: (name: string) => `${name}, see the blocks`,
    distance: "Distance",
    duration: "Time",
    pace: "Pace",
    speed: "Speed",
    elevation: "Elevation",
    thisWeek: "This week",
    goalPercent: (percent: number) => `· goal ${percent} %`,
    weekRuns: (count: number) => `· ${plural(count, "run", "runs")}`,
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    routeLeft: (distance: string) => `Route · ${distance} ${distanceUnit()} left`,
    ghostAhead: (gap: string) => `${gap} ahead`,
    ghostBehind: (gap: string) => `${gap} behind`,
    ghostLevel: "level",
    ghostOnly: (gap: string) => `Best · ${gap}`,
    routeTurn: (direction: string, metres: string) => `${direction.charAt(0).toUpperCase()}${direction.slice(1)} in ${metres}`,
    routeOff: (metres: string) => `Off route · ${metres} away`,
    routeDone: "Route complete",
    lap: "Lap",
    lapLabel: (number: number) => `End lap ${number}`,
    lapLine: (number: number, distance: string, duration: string) =>
      `Lap ${number} · ${distance} ${distanceUnit()} · ${duration}`,
  },
});

/** A gap to the record: "8 s" under a minute, "1:12" beyond. */
const gapText = (seconds: number): string => (seconds < 60 ? `${seconds} s` : formatDuration(seconds));

/** A short distance, in tens of metres or fifties of feet: "80 m", "250 ft". */
function shortDistance(metres: number): string {
  return elevationUnit() === "ft"
    ? `${Math.max(50, Math.round(metres / 0.3048 / 50) * 50)} ft`
    : `${Math.max(10, Math.round(metres / 10) * 10)} m`;
}

/** Height of the lap button under the run's controls. */
/** The pause, the largest thing on the panel while running. */
const RUN_CONTROL = 72;
/** Lap and finish either side of it. */
const PILL_HEIGHT = 56;

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
/**
 * How far the panel's text may grow with the phone's text size. The panel
 * has a stated height, so text past this would be clipped; up to it, the
 * figures still read larger for whoever asked for larger.
 */
const TEXT_CAP = 1.3;

const PANEL_HEIGHT = { idle: 96, idleWeather: 122, live: 188 } as const;

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
  icon, label, onPress, primary = false, danger = false, light = false, size = 46, disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  /** The lightest tap whatever the look: a pause, momentary, undone by the next tap. */
  light?: boolean;
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
    (primary || danger) && !light ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;

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
  /** Between the tap on start and the run being under way. */
  const [beginning, setBeginning] = useState(false);
  /** The block list, opened from the session line. */
  const [showingSteps, setShowingSteps] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [choosingRoute, setChoosingRoute] = useState(false);
  // While a run records, the screen leads with the pace rather than the map:
  // mid-run the question is "am I on pace", far more often than "where am I".
  // The choice holds for the run it was made in, not for the next one: this
  // screen stays mounted between runs, and a run begun on the map because
  // the last one ended there would hide the pace nobody asked to hide.
  const [mapForRun, setMapForRun] = useState<number | null>(null);
  const showingMap = mapForRun !== null && mapForRun === tracker.startedAt;
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
  // What the screen measures: the outing under way, or the one about to start.
  const sport: Sport = recording ? tracker.sport : settings.sport;
  const riding = sport === "cycling";

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
  // The weather's line is kept whether or not it has answered yet, so the
  // panel and the buttons above it do not jump when it does.
  const target = PANEL_HEIGHT[recording ? "live" : "idleWeather"];

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

  /**
   * 1 while the pace dashboard covers the map, 0 while the map shows. The
   * dashboard slides in from the right edge and the map's own column of
   * toggles leaves by the same edge, both moved rather than faded.
   */
  const dashboardShown = recording && !showingMap;
  const dash = useSharedValue(dashboardShown ? 1 : 0);
  useEffect(() => {
    dash.value = withTiming(dashboardShown ? 1 : 0, GROW);
  }, [dashboardShown, dash]);
  const dashSlide = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - dash.value) * width }] }), [width]);
  // Its own style rather than the chevron's: one animated style is written
  // to one view.
  const chevronArriveTwin = useAnimatedStyle(
    () => ({ transform: [{ translateY: (1 - arrive.value) * -30 }] }),
    [],
  );
  const togglesRise = useAnimatedStyle(() => ({ bottom: locateAbove.value + CONTROL_SIZE + 10 }), []);
  // Arriving with the screen and leaving for the dashboard are both a slide
  // to the right edge, added on the one view: see the note on the toggles.
  const togglesArrive = useAnimatedStyle(
    () => ({ transform: [{ translateX: (1 - arrive.value) * 34 + dash.value * (CONTROL_SIZE + 24) }] }),
    [],
  );

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
  // A bike's speed changes in seconds, not half-minutes: a shorter window.
  const ridePace = riding && tracker.status === "running" ? currentPace(tracker.points, now, 10) : null;
  const speed = ridePace === null ? null : 1000 / ridePace;
  const avgSpeed = duration > 0 ? distance / duration : 0;
  const topSpeed = riding ? topSpeedMs(tracker.points) : null;
  const elevation = elevationGainM(tracker.points);
  // The week of the sport about to be recorded: rides never count in a runner's.
  const week = weekTotals(ofSport(history, sport));
  // Where the week stands, on the screen where it can still be changed. The
  // count of outings says what has happened; against a goal the same line
  // says what is left, which is the only version of it worth reading with a
  // hand on the play button.
  const weekly = riding ? null : weeklyGoal(settings);
  const goal = weekly === null ? null : goalProgress(measure(weekly.kind, week), weekly.target);

  const signal =
    tracker.accuracyM === null ? s.searchingGps
    : tracker.accuracyM <= 10 ? s.gpsPrecise(Math.round(tracker.accuracyM))
    : tracker.accuracyM <= 30 ? s.gpsFair(Math.round(tracker.accuracyM))
    : s.gpsWeak;

  const idleSignal =
    granted === false ? s.locationDenied
    : coords === null ? s.acquiringGps
    : s.gpsReady;

  const paused = tracker.status === "paused";
  const state = recording
    ? tracker.status === "paused" ? (tracker.autoPaused ? s.autoPaused : s.paused) : s.running[sport]
    : s.ready[sport];

  /**
   * While a session is under way the status line is given over to it: which
   * block, how many there are, and what is left of this one. Nothing else on
   * this screen can say that, and mid-interval it is the only thing anyone
   * looks for.
   */
  const session = riding ? null : tracker.session;
  const step = session?.steps[tracker.stepIndex] ?? null;
  const sessionLine = (() => {
    if (!session) return null;
    if (!recording) {
      const paceWords = tracker.sessionPaceSKm === null ? "" : ` · ${formatPace(tracker.sessionPaceSKm)}${paceUnit()}`;
      return `${s.sessionBlocks(sessionName(session), session.steps.length)}${paceWords}`;
    }
    if (!step) return s.sessionDone(sessionName(session));
    const left = stepRemaining(
      step,
      distance - tracker.stepStartM,
      activeDurationS(tracker, now) - tracker.stepStartS,
    );
    const remaining = left.metres !== null
      ? `${Math.round(left.metres)} m`
      : formatDuration(Math.ceil(left.seconds ?? 0));
    const blockPace = paceForStep(step, tracker.sessionPaceSKm);
    const paceWords = blockPace === null ? "" : ` · ${formatPace(blockPace)}${paceUnit()}`;
    return `${tracker.stepIndex + 1}/${session.steps.length} · ${stepLabel(step)}${paceWords} · ${remaining}`;
  })();

  /** The pace to hold now, measured against on the dashboard as the voice does. */
  const targetPace = heldPace(session, tracker.stepIndex, tracker.sessionPaceSKm, settings.targetPaceSKm);
  const nextStep = session?.steps[tracker.stepIndex + 1] ?? null;
  const block: DashboardBlock | null = (() => {
    if (!session || !step) return null;
    const coveredM = distance - tracker.stepStartM;
    const elapsedS = duration - tracker.stepStartS;
    const left = stepRemaining(step, coveredM, elapsedS);
    return {
      index: tracker.stepIndex + 1,
      count: session.steps.length,
      label: stepLabel(step),
      remaining: left.metres !== null
        ? `${Math.round(left.metres)} m`
        : formatDuration(Math.ceil(left.seconds ?? 0)),
      done: step.metres !== undefined
        ? coveredM / step.metres
        : step.seconds !== undefined ? elapsedS / step.seconds : 0,
      next: nextStep ? stepLabel(nextStep) : null,
      easy: !isPaced(step),
      walk: step.effort === "walk",
    };
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
  /**
   * Following a route, the line says what the route asks next: the turn when
   * one is close, the way back when the runner has left it, otherwise how
   * much is left. A session or a lap already divides the run and keeps the
   * line; the voice still gives the turns.
   */
  const guidance = recording ? tracker.guidance : null;
  // Against the record on this route: the gap in seconds, measured where the
  // runner is now. Said beside the distance left, where there is room for it.
  const ghost = recording ? tracker.ghost : null;
  const ghostSpot = ghost ? ghostAt(ghost, duration) : null;
  const gapS = ghost ? ghostGapS(ghost, distance, duration) : null;
  const gapWords = gapS === null
    ? null
    : Math.abs(gapS) < 1
      ? s.ghostLevel
      : gapS > 0
        ? s.ghostAhead(gapText(Math.round(gapS)))
        : s.ghostBehind(gapText(Math.round(-gapS)));
  const followLine = guidance === null
    ? gapWords === null ? null : s.ghostOnly(gapWords)
    : guidance.off
      ? s.routeOff(shortDistance(guidance.offM))
      : guidance.done
        ? s.routeDone
        : guidance.next && guidance.next.inM <= 200
          ? s.routeTurn(turnName(guidance.next.direction), shortDistance(guidance.next.inM))
          : `${s.routeLeft(formatDistance(guidance.leftM))}${gapWords ? ` · ${gapWords}` : ""}`;
  const guideLine = sessionLine ?? lapLine ?? followLine;
  const routeWarning = sessionLine === null && lapLine === null && guidance?.off === true;

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
    // Asking for the location is an await away from the start itself, and a
    // second tap in between must not count.
    if (beginning) return;
    setBeginning(true);
    const access = await locationAccess().catch(() => "denied" as const);
    if (access === "granted") {
      await start();
      setBeginning(false);
      return;
    }
    setBeginning(false);
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
      Alert.alert(s.shortTitle[sport], s.shortMessage, [
        // A finish pressed by accident in the first metres has to be undoable.
        { text: s.continue, style: "cancel" },
        { text: s.discard, style: "destructive", onPress: () => void discard() },
        { text: s.keep, onPress: () => void close() },
      ]);
      return;
    }
    Alert.alert(
      s.finishTitle[sport],
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
    let id: number | null;
    try {
      id = await finish();
    } catch {
      // Nothing is lost: the tracker keeps the run, paused, and finishing
      // again tries the save again.
      setFinishing(false);
      Alert.alert(s.saveFailedTitle, s.saveFailedMessage);
      return;
    }
    setFinishing(false);
    if (id !== null) {
      router.push({ pathname: "/run/[id]", params: { id: String(id), from } });
    }
  }

  const tooShort = distance < 100;

  // The run closed itself at the end of its route: open it, as finishing by
  // hand would have.
  const autoFinished = tracker.autoFinished;
  useEffect(() => {
    if (autoFinished === null) return;
    clearAutoFinished();
    router.push({ pathname: "/run/[id]", params: { id: String(autoFinished.runId), from: autoFinished.from } });
  }, [autoFinished, router]);

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
        ghost={ghostSpot}
        initialCenter={coords}
        locateOnFocus
        controlsAbove={locateAbove}
        controlsArrive={arrive}
        style={styles.map}
      />
      {recording && <KeepAwake />}

      {/* Over the map rather than instead of it: the map keeps following the
          run underneath, so switching back shows it already in place. */}
      {recording ? (
        <Animated.View pointerEvents={dashboardShown ? "auto" : "none"} style={[styles.dashboard, dashSlide]}>
          {riding ? (
            <RideDashboard
              speedMs={speed}
              averageMs={avgSpeed}
              topMs={topSpeed}
              paused={paused ? (tracker.autoPaused ? s.autoPaused : s.paused) : null}
              topSpace={CONTROLS_TOP + CONTROL_SIZE + 16}
              bottomSpace={bottomInset + PANEL_HEIGHT.live + 16}
            />
          ) : (
            <RunDashboard
              currentPaceSKm={pace}
              targetPaceSKm={targetPace}
              paused={paused ? (tracker.autoPaused ? s.autoPaused : s.paused) : null}
              block={block}
              topSpace={CONTROLS_TOP + CONTROL_SIZE + 16}
              bottomSpace={bottomInset + PANEL_HEIGHT.live + 16}
            />
          )}
        </Animated.View>
      ) : null}

      {/* Pace or map, named both, at the top in the middle: a single button
          for it was read as the way back, and a tap on the panel was found
          by nobody. The same control as the history's list or calendar. */}
      {recording ? (
        <Animated.View style={[styles.viewSwitch, chevronArriveTwin]}>
          <Segmented
            options={[
              { value: "pace", label: riding ? s.viewSpeed : s.viewPace },
              { value: "map", label: s.viewMap },
            ]}
            value={showingMap ? "map" : "pace"}
            onChange={(view) => setMapForRun(view === "map" ? tracker.startedAt : null)}
          />
        </Animated.View>
      ) : (
        // At rest, the same place says what the next outing will be. Kept
        // from one to the next, so most days it is already right.
        <Animated.View
          style={[styles.viewSwitch, chevronArriveTwin]}
          accessibilityLabel={s.sportLabel}
        >
          <Segmented
            options={[
              { value: "running", label: sportName("running") },
              { value: "cycling", label: sportName("cycling") },
            ]}
            value={settings.sport}
            onChange={(next) => void setSport(next)}
          />
        </Animated.View>
      )}

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
          {/* Sessions and paces are a runner's: a ride has neither. And both
              this and the route are chosen before setting off: mid-run, a
              new choice would change the map but not what the run follows,
              so they leave once it starts. Voice stays. */}
          {riding || recording ? null : (
            <GlassPanel style={styles.togglePill}>
              <Toggle
                on={session !== null || settings.targetPaceSKm !== null}
                onPress={() => setChoosing(true)}
                icon="list"
                opens
                name={s.sessionToggle}
                label={s.sessionToggleLabel}
              />
            </GlassPanel>
          )}
          {/* The route is shown for what it is — a choice that holds from one
              run to the next — so it has to be visible and undoable here,
              where the run starts, and not only in the tab it was picked in. */}
          {recording ? null : (
            <GlassPanel style={styles.togglePill}>
              <Toggle
                on={chosenRoute !== null}
                onPress={() => setChoosingRoute(true)}
                icon="map"
                opens
                name={s.routeToggle}
                label={s.routeToggleLabel}
              />
            </GlassPanel>
          )}
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
            <View style={[styles.panelRow, recording && styles.panelRowRunning]}>
              <View style={styles.panelMetrics}>
                {/* The session line opens the whole session. Mid-interval it
                    says which block and what is left of it, which is the only
                    thing anyone looks for — but "3/23" says nothing about what
                    the other twenty are, and that question has nowhere else to
                    go on this screen. */}
                <View style={styles.stateRow}>
                  <Pressable
                    onPress={() => session && setShowingSteps(true)}
                    disabled={session === null}
                    accessibilityRole={session ? "button" : "text"}
                    accessibilityLabel={session ? s.seeBlocks(sessionName(session)) : undefined}
                    hitSlop={6}
                    style={styles.stateLine}
                  >
                    {/* A pause leads the line, whatever else it says: the clock
                        has stopped, and nothing else on the panel shows it. */}
                    <Text
                      style={[
                        styles.state, weakSignal && styles.stateWeak, guideLine && styles.stateSession,
                        routeWarning && styles.stateWeak, paused && styles.statePaused,
                      ]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={TEXT_CAP}
                    >
                      {paused
                        ? `${state} · ${guideLine ?? signal}`
                        : guideLine ?? `${state} · ${recording ? signal : idleSignal}`}
                    </Text>
                  </Pressable>
                  {/* Running, the weather keeps a corner of the status line:
                      the sky and the degrees, which is what changes how a run
                      feels. At rest it has a line of its own, below. */}
                  {recording && weather ? (
                    <View style={styles.liveWeather} accessibilityLabel={weatherLine(weather)}>
                      <Ionicons name={weatherIcon(weather.code, weather.day)} size={15} color={colors.muted} />
                      <Text style={styles.liveWeatherText} maxFontSizeMultiplier={TEXT_CAP}>
                        {formatTemperature(weather.temperatureC)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {recording ? (
                  // Four abreast across the whole panel: the controls moved to a
                  // row of their own under the figures, so each column has a
                  // quarter of the width rather than the 46 points that once
                  // clipped the unit off the pace.
                  <View style={styles.metricStack}>
                    <View style={styles.metricRow}>
                      <Metric compact label={s.distance} value={formatDistance(distance)} unit={distanceUnit()} />
                      <Metric compact label={s.duration} value={formatDuration(duration)} />
                      {/* The dashboard already shows the pace of the moment,
                          large; beside it the panel gives the run's average. */}
                      {riding ? (
                        dashboardShown ? (
                          <Metric compact label={s.average} value={formatSpeed(avgSpeed)} unit={speedUnit()} />
                        ) : (
                          <Metric compact label={s.speed} value={formatSpeed(speed ?? avgSpeed)} unit={speedUnit()} />
                        )
                      ) : dashboardShown ? (
                        <Metric compact label={s.average} value={formatPace(avgPace)} unit={paceUnit()} />
                      ) : (
                        <Metric compact label={s.pace} value={formatPace(pace ?? avgPace)} unit={paceUnit()} />
                      )}
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

              {/* At rest, the one button beside what the panel says. */}
              {!recording ? (
                <View style={styles.panelControls}>
                  <Animated.View style={styles.controlLayer}>
                    <RoundButton icon="play" label={s.start} onPress={() => void begin()} primary size={52} disabled={beginning} />
                  </Animated.View>
                </View>
              ) : null}
            </View>

            {/* Running, the controls take a row of their own, the panel's full
                width: they are pressed mid-stride, with a glance at most, and
                have to be found by a thumb rather than aimed at. Pause in the
                middle, largest, since it is the one pressed most; lap and
                finish either side, each with its word, so neither can be
                taken for the other. Finish still asks before it ends. */}
            {recording ? (
              <Animated.View style={styles.runControls}>
                <PillButton
                  icon="flag-outline"
                  label={s.lap}
                  accessibilityLabel={s.lapLabel(tracker.laps.length + 1)}
                  onPress={lap}
                  disabled={tracker.status !== "running"}
                />
                {tracker.status === "running" ? (
                  <RoundButton icon="pause" label={s.pause} onPress={pause} primary light size={RUN_CONTROL} />
                ) : (
                  <RoundButton icon="play" label={s.resume} onPress={resume} primary size={RUN_CONTROL} />
                )}
                <PillButton
                  icon="stop"
                  label={s.finish}
                  accessibilityLabel={s.finish}
                  onPress={askFinish}
                  disabled={finishing}
                  danger
                />
              </Animated.View>
            ) : null}
        </GlassPanel>
        </Animated.View>
      </Animated.View>

      <SessionDetail
        visible={showingSteps}
        session={session}
        // Only while running: standing still, the question is what the session
        // is, not how far into it you are.
        currentIndex={recording ? tracker.stepIndex : null}
        targetSKm={tracker.sessionPaceSKm}
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
        onChoose={(id) => chooseSession(findSession(id))}
        onClose={() => setChoosing(false)}
        onCreate={() => router.push("/session/new")}
        onEdit={(id) => router.push({ pathname: "/session/[id]", params: { id: String(id) } })}
      />

    </Animated.View>
  );
}

/**
 * The lap button: a word as well as a flag, since a flag alone reads as a
 * finish line. Wide and flat, so it is found by feel under the two round
 * buttons. The lightest tap under the finger; the voice says the lap.
 */
/**
 * A running control beside the pause: an icon and its word, as tall as a
 * thumb. Lap lands lightly, as a mark in passing; finish lands like the
 * other controls that change the run, and is red, ring and word.
 */
function PillButton({
  icon, label, accessibilityLabel, onPress, disabled, danger = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={() => {
        const weight = danger ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
        void Haptics.impactAsync(weight).catch(() => undefined);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill, danger && styles.pillDanger, pressed && styles.pressed, disabled && styles.roundDisabled,
      ]}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text
        style={[styles.pillText, { color: tint }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={TEXT_CAP}
      >
        {label}
      </Text>
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
  on, onPress, icon, name, label, opens = false,
}: {
  on: boolean;
  onPress: () => void;
  /** Opens a choice rather than flipping a setting: a button, not a switch. */
  opens?: boolean;
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
      accessibilityRole={opens ? "button" : "switch"}
      accessibilityState={opens ? { selected: on } : { checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      {/* A dot as well as the colour: on and off told apart by a shape too,
          for anybody who cannot tell the blue from the black. */}
      {on && opens ? <View style={[styles.toggleDot, { backgroundColor: tint }]} /> : null}
      <Ionicons name={icon} size={18} color={tint} />
      {/* Shrunk rather than cut: "PARCOURS" is the longest word here and the
          widest this square has to hold. */}
      <Text
        style={[styles.toggleName, { color: tint }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1}
      >
        {name}
      </Text>
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
  dashboard: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  // Centred between the way out and the right edge's column, level with the
  // way out.
  viewSwitch: {
    position: "absolute", top: CONTROLS_TOP + 1, alignSelf: "center", width: 200,
    borderRadius: 10, ...floatingShadow,
  },
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
  toggleDot: { position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 3 },
  toggleName: {
    fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.2,
    maxWidth: CONTROL_SIZE - 4, textAlign: "center",
  },

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
  stateRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stateLine: { flex: 1, minWidth: 0 },
  liveWeather: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  liveWeatherText: {
    color: colors.muted, fontSize: 14.5, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
  state: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
  stateWeak: { color: colors.warning },
  // A session line is instruction rather than commentary, so it is given
  // the accent and the app's heavier face.
  stateSession: { color: colors.accent, fontFamily: font.semibold },
  statePaused: { color: colors.warning, fontFamily: font.semibold },
  panelRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  panelRowRunning: { flex: 0 },
  panelMetrics: { flex: 1, gap: 8, minWidth: 0 },
  metricStack: { gap: 10 },
  metricRow: { flexDirection: "row", gap: 12 },
  // Wide enough for the two buttons of a run in progress, tall enough for the
  // larger single one at rest: the box never changes, so nothing around it
  // shifts when its contents do.
  panelControls: { width: CONTROL_SIZE * 2 + 8, height: 52, flexShrink: 0 },
  // Pinned to the foot of the panel, whatever the figures above take.
  runControls: { marginTop: "auto", flexDirection: "row", alignItems: "center", gap: 12 },
  pill: {
    flex: 1, height: PILL_HEIGHT, borderRadius: PILL_HEIGHT / 2,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: colors.subtle,
  },
  pillDanger: { borderColor: colors.danger },
  pillText: { fontSize: 18, fontFamily: font.semibold, letterSpacing: 0.3 },
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
  // Gives under the finger rather than fading: a control that turns pale on
  // glass over a map looks like it has gone away.
  pressed: { transform: [{ scale: 0.96 }] },
  play: { marginLeft: 2 },

  weather: { flexDirection: "row", alignItems: "center", gap: 6 },
  weatherText: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium, flexShrink: 1 },

  error: { color: colors.danger, fontSize: 15 },
});
