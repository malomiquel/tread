import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn, FadeOut, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming,
} from "react-native-reanimated";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassPanel } from "@/components/GlassPanel";
import { Metric } from "@/components/Metric";
import { RunMap } from "@/components/RunMap";
import { SessionDetail } from "@/components/SessionDetail";
import { SessionPicker } from "@/components/SessionPicker";
import { listRuns, type Run } from "@/lib/db";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { currentPace, elevationGainM, MAX_ACCURACY_M, paceSecPerKm, totalDistanceM } from "@/lib/geo";
import { CONTROL_SIZE, CONTROLS_TOP, useTabBarBottom } from "@/lib/layout";
import { useInitialLocation } from "@/lib/location";
import { toggleVoice, useSettings } from "@/lib/settings";
import { weekTotals } from "@/lib/stats";
import { colors, font } from "@/lib/theme";
import {
  activeDurationS, chooseSession, discard, finish, pause, resume, start, useTracker,
} from "@/lib/tracker";
import { sessionById, stepLabel, stepRemaining } from "@/lib/workout";

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
const PANEL_HEIGHT = { idle: 96, live: 146 } as const;

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
  const settings = useSettings();
  // The tab bar is hidden here, so the panel takes the room it used to leave
  // for it and sits where the bar would have been.
  const bottomInset = useTabBarBottom() + 8;
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  /** The block list, opened from the session line. */
  const [showingSteps, setShowingSteps] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
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

  /**
   * The same swipe that goes back everywhere else in iOS, on a narrow strip
   * down the left edge.
   *
   * Only a strip, because the rest of the screen is a map and a map wants
   * every drag it can get: a gesture spanning the whole width would make it
   * impossible to pan the map westward. The width is roughly the one iOS uses
   * for its own back gesture, so the habit is already there.
   *
   * It insists on a horizontal intent — a clear push right without much
   * vertical wander — so a thumb brushing past on its way somewhere else does
   * not throw you off the screen.
   */
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-24, 24])
    .onEnd((event) => {
      if (event.translationX > 60 && event.velocityX > 0) runOnJS(leave)();
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
  const target = PANEL_HEIGHT[recording ? "live" : "idle"];

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

  const signal =
    tracker.accuracyM === null ? "recherche du GPS"
    : tracker.accuracyM <= 10 ? `GPS précis, ±${Math.round(tracker.accuracyM)} m`
    : tracker.accuracyM <= 30 ? `GPS moyen, ±${Math.round(tracker.accuracyM)} m`
    : `GPS faible, points ignorés`;

  const idleSignal =
    granted === false ? "localisation refusée"
    : coords === null ? "acquisition du GPS"
    : "GPS prêt";

  const state = recording
    ? tracker.status === "paused" ? "En pause" : "Course en cours"
    : "Prêt à courir";

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
    if (!recording) return `${session.name} · ${session.steps.length} blocs`;
    if (!step) return `${session.name} · terminée`;
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

  // The same threshold the tracker throws fixes away at, so the warning and
  // the filter can never disagree about what counts as a poor signal.
  const weakSignal =
    (recording && tracker.accuracyM !== null && tracker.accuracyM > MAX_ACCURACY_M) || granted === false;

  async function close() {
    setConfirming(false);
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
    <View style={styles.screen}>
      {/* The map is the screen now, not something hidden behind a button. */}
      <RunMap
        points={tracker.points}
        follow
        initialCenter={coords}
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
            accessibilityLabel="Quitter l'écran de course"
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
              name="SÉANCE"
              label="Choisir une séance d'entraînement"
            />
          </GlassPanel>
          <GlassPanel style={styles.togglePill}>
            <Toggle
              on={settings.voice}
              onPress={() => void toggleVoice()}
              icon={settings.voice ? "volume-high" : "volume-mute"}
              name="VOIX"
              label="Annonce vocale des kilomètres"
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
                  accessibilityLabel={session ? `${session.name}, voir les blocs` : undefined}
                  hitSlop={6}
                >
                  <Text
                    style={[styles.state, weakSignal && styles.stateWeak, sessionLine && styles.stateSession]}
                    numberOfLines={1}
                  >
                    {sessionLine ?? `${state} · ${recording ? signal : idleSignal}`}
                  </Text>
                </Pressable>

                {recording ? (
                  // Two rows of two rather than four abreast: on a narrow phone
                  // the single row fell to 46 points a column, which clipped the
                  // unit off the pace.
                  <View style={styles.metricStack}>
                    <View style={styles.metricRow}>
                      <Metric compact label="Distance" value={formatDistance(distance)} unit="km" />
                      <Metric compact label="Durée" value={formatDuration(duration)} />
                    </View>
                    <View style={styles.metricRow}>
                      <Metric compact label="Allure" value={formatPace(pace ?? avgPace)} unit="/km" />
                      <Metric compact label="Dénivelé" value={formatElevation(elevation)} unit="m" />
                    </View>
                  </View>
                ) : (
                  // No entering animation on these: nested inside a panel that
                  // is itself arriving, a child's own entering can be dropped
                  // and leave the view stuck at the opacity it started from —
                  // which is how the week's distance went missing entirely.
                  <Metric
                    compact
                    label="Cette semaine"
                    value={`${formatDistance(week.distanceM)} km`}
                    unit={week.runs > 0 ? `· ${week.runs} sortie${week.runs > 1 ? "s" : ""}` : undefined}
                  />
                )}
                {tracker.error && <Text style={styles.error}>{tracker.error}</Text>}
              </View>

              {/* A box of fixed size holding two layers that cross-fade in
                  place. Laid out in flow instead, the arriving buttons pushed
                  the leaving one aside on their way in — which is what made
                  the play button look like it came back from below. */}
              <View style={styles.panelControls}>
                {!recording ? (
                  <Animated.View
                    key="rest"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(140)}
                    style={styles.controlLayer}
                  >
                    <RoundButton icon="play" label="Démarrer" onPress={() => void start()} primary size={52} />
                  </Animated.View>
                ) : (
                  <Animated.View
                    key="running"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(140)}
                    style={styles.controlLayer}
                  >
                    {tracker.status === "running" ? (
                      <RoundButton icon="pause" label="Pause" onPress={pause} />
                    ) : (
                      <RoundButton icon="play" label="Reprendre" onPress={resume} primary />
                    )}
                    <RoundButton
                      icon="stop"
                      label="Terminer"
                      onPress={() => setConfirming(true)}
                      danger
                      disabled={finishing}
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

      <SessionPicker
        visible={choosing}
        chosen={tracker.session?.id ?? null}
        // The picker offers the catalogue, so it deals in names; a session
        // coming from a programme is handed over whole by the plan screen.
        onChoose={(id) => chooseSession(sessionById(id))}
        onClose={() => setChoosing(false)}
      />

      <ConfirmDialog
        visible={confirming}
        title={tooShort ? "Course très courte" : "Terminer la course ?"}
        message={
          tooShort
            ? "Moins de 100 m enregistrés. La garder quand même ?"
            : `${formatDistance(distance)} km en ${formatDuration(duration)}.`
        }
        confirmLabel={tooShort ? "Garder" : "Terminer"}
        cancelLabel={tooShort ? "Abandonner" : "Continuer"}
        onConfirm={() => void close()}
        onCancel={() => {
          setConfirming(false);
          if (tooShort) void discard();
        }}
      />
    </View>
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

  // Right-aligned so the pills, the locate button and the panel's edge all
  // land on one line down the side of the screen.
  toggles: { position: "absolute", right: 12, alignItems: "flex-end" },
  toggleStack: { alignItems: "flex-end", gap: 10 },
  backEdge: { position: "absolute", left: 0, top: 0, bottom: 0, width: 26 },
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

  error: { color: colors.danger, fontSize: 15 },
});
