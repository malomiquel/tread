import Ionicons from "@expo/vector-icons/Ionicons";
import { File, Paths } from "expo-file-system";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, useColorScheme,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { distanceM, fitRegion } from "@/lib/geo";
import { routeGpxFileName, routeToGpx } from "@/lib/gpx";
import { keepPicture, PREVIEW } from "@/lib/picture";
import { readRoute, saveRoute, updateRoute } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { placeName, useInitialLocation } from "@/lib/location";
import {
  autoRouteName, drawnLine, emptyRoute, fetchLeg, isLoop, lastWaypoint, legsAround, movedWaypoint,
  regionAroundRoute, routeDistanceM, snapped, withoutWaypoint, withWaypoint,
  type Route, type RoutePoint,
} from "@/lib/route";
import { colors, floatingShadow, font, literalColors } from "@/lib/theme";

/** Where the map opens when the phone has no idea where it is. */
const PARIS = { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const WALKING_ZOOM = 0.008;

/**
 * Drawing a route with a finger.
 *
 * Tap by tap: each tap is joined to the one before it by the streets, asked
 * of a routing service one leg at a time. The service is a convenience and
 * not a dependency — when it cannot answer, the two taps are joined by a
 * straight line and the route stays drawable on a train with no signal.
 *
 * The map is this screen's own rather than the app's RunMap. That component
 * exists to show a track that already happened, with controls for following
 * a runner; this one takes taps and shows a plan. They would share a MapView
 * and disagree about everything else.
 */
export default function RouteBuilder() {
  const map = useRef<MapView>(null);
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const { id } = useLocalSearchParams<{ id: string }>();
  /** The route being changed, or null when one is being drawn from nothing. */
  const editing = id === "new" || id === undefined ? null : Number(id);
  const { coords } = useInitialLocation();
  const [route, setRoute] = useState<Route>(emptyRoute());
  /** Null until an existing route has been read, so the map can open on it. */
  const [opened, setOpened] = useState<Route | null>(editing === null ? emptyRoute() : null);
  /**
   * What it is called, or null while nobody has said.
   *
   * Null rather than a name made up in advance: a route drawn and never named
   * gets the day it was drawn, decided at the moment it is saved. Showing
   * that name before then would put a decision in front of somebody who has
   * not made one.
   */
  const [name, setName] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  /** Something has been drawn or renamed since this screen was opened. */
  const [dirty, setDirty] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [sharing, setSharing] = useState(false);
  /** Written to disk: the screen is now free to close. */
  const [written, setWritten] = useState(false);

  useEffect(() => {
    if (editing === null) return;
    let active = true;
    void readRoute(editing).then((found) => {
      if (!active || !found) return;
      const loaded = { waypoints: found.waypoints, legs: found.legs };
      setRoute(loaded);
      setOpened(loaded);
      setName(found.name);
    });
    return () => { active = false; };
  }, [editing]);
  /** True while the router is being asked about the leg just tapped. */
  const [asking, setAsking] = useState(false);
  /**
   * The legs the router could not answer about, which are straight lines.
   *
   * Kept and shown, because a straight line is a claim about where you will
   * run and this one was not made by anybody. Silently drawn, it is
   * indistinguishable from a path that genuinely runs straight — and that is
   * what makes a routing failure look like an app that ignores the streets.
   */
  const [guessed, setGuessed] = useState<number[]>([]);
  /**
   * Every shape the route has had, newest last.
   *
   * A stack rather than a "remove the last point" button, because the route
   * can now be changed in four ways — a point added, moved, removed, the
   * whole thing cleared — and an undo that only knew about one of them would
   * be an undo nobody trusts. Bounded, because nobody walks back thirty
   * edits and the shapes are not free.
   */
  const [past, setPast] = useState<Route[]>([]);
  const [saving, setSaving] = useState(false);
  const navigation = useNavigation();
  /**
   * Everything that belongs to the drawing, and not to the route, steps out
   * of the picture for exactly as long as it is being taken.
   *
   * The blue dot belongs on the map while you draw — placing a start without
   * knowing where you are standing is guesswork — and has no business in a
   * picture looked at next week from somewhere else, where "you are here"
   * would be saying something false. The pins are the same: they mark the
   * decisions being made, one tap at a time, and once the route exists they
   * are scaffolding. What the picture is of is the line.
   */
  const [posing, setPosing] = useState(false);

  const metres = routeDistanceM(route);

  /**
   * Leaving with something unsaved asks first.
   *
   * A route is drawn a tap at a time over a couple of minutes, and the back
   * gesture is the same flick that scrolls a list — there is no undo for
   * leaving, so the question is asked before the screen goes rather than
   * regretted after.
   *
   * The guard drops on `written` rather than on the save itself, and the
   * leaving happens in the effect below: state settles between renders, so
   * closing in the same breath as clearing the guard would ask somebody
   * whether they want to discard what they have just saved.
   */
  usePreventRemove(dirty && !written, ({ data }) => {
    Alert.alert(
      "Quitter sans enregistrer ?",
      "Le tracé restera comme il était avant.",
      [
        { text: "Rester", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  useEffect(() => {
    if (written) router.back();
  }, [written, router]);

  /**
   * A tap lands at once, and the streets catch up.
   *
   * The straight line is drawn first and replaced when the router answers,
   * rather than the finger waiting on a network round trip. A route drawn at
   * the speed of a server is a route nobody finishes drawing.
   */
  /**
   * Hand the route to whatever else can read one.
   *
   * GPX, because that is what a watch, a planner and another runner's app all
   * speak — and what this app reads back, so a route shared with somebody
   * else comes home if they send it back.
   *
   * What is on screen rather than what is on disk: somebody who has just
   * moved three corners means the route they are looking at, and asking them
   * to save first would be the app protecting its own bookkeeping.
   */
  async function share() {
    if (sharing || route.waypoints.length < 2) return;
    setSharing(true);
    try {
      const called = name?.trim() || autoRouteName(Date.now());
      const file = new File(Paths.cache, routeGpxFileName(called));
      file.create({ overwrite: true });
      file.write(routeToGpx(called, drawnLine(route)));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/gpx+xml",
          UTI: "com.topografix.gpx",
        });
      } else {
        Alert.alert("Partage indisponible", "Impossible d'ouvrir la feuille de partage sur cet appareil.");
      }
    } catch (cause) {
      Alert.alert("Partage impossible", cause instanceof Error ? cause.message : "Erreur inattendue.");
    } finally {
      setSharing(false);
    }
  }

  /** Records the shape about to be replaced, so it can be come back to. */
  function remember(current: Route) {
    setPast((shapes) => [...shapes, current].slice(-20));
    setDirty(true);
  }

  /**
   * Ask the router about legs that have stopped being true.
   *
   * Called after a point is moved or removed, about the one or two legs that
   * touched it. Each answer is matched to its own leg the same way a new tap
   * is: by index, and only while that leg is still the straight placeholder
   * this request was made about.
   */
  async function reroute(shape: Route, indices: number[]) {
    setAsking(true);
    try {
      await Promise.all(indices.map(async (index) => {
        const from = shape.waypoints[index];
        const to = shape.waypoints[index + 1];
        if (!from || !to) return;

        const leg = await fetchLeg(from, to);
        setGuessed((current) => (leg.length > 1
          ? current.filter((at) => at !== index)
          : [...new Set([...current, index])]));
        if (leg.length <= 1) return;

        setRoute((current) => {
          const placeholder = current.legs[index];
          if (!placeholder || placeholder.length !== 2) return current;
          if (distanceM(placeholder[1], to) > 1) return current;
          return snapped(current, index, leg);
        });
      }));
    } finally {
      setAsking(false);
    }
  }

  async function addPoint(point: RoutePoint) {
    const from = lastWaypoint(route);
    const straight = withWaypoint(route, point);
    remember(route);
    /** Which leg this answer will be about, whatever happens meanwhile. */
    const index = straight.legs.length - 1;
    setRoute(straight);
    if (!from) return;

    setAsking(true);
    try {
      const leg = await fetchLeg(from, point);
      if (leg.length <= 1) setGuessed((current) => [...current, index]);
      if (leg.length > 1) {
        setRoute((current) => {
          /*
           * Matched to its own leg rather than to the shape of the whole
           * route.
           *
           * This used to check that no waypoint had been added since, which
           * quietly threw away every answer overtaken by the next tap — draw
           * five points quickly and only the last leg followed the streets,
           * which is exactly what "it doesn't follow the paths" looks like.
           *
           * What has to be true is narrower: that leg still exists, and is
           * still the straight placeholder this answer was asked about. An
           * undo, or a redraw somewhere else, fails both.
           */
          const placeholder = current.legs[index];
          if (!placeholder || placeholder.length !== 2) return current;
          if (distanceM(placeholder[1], point) > 1) return current;
          return snapped(current, index, leg);
        });
      }
    } finally {
      setAsking(false);
    }
  }

  /**
   * What the route is shown with in the list: a picture and a place.
   *
   * Both are taken here, at the one moment when there is already a map on
   * screen with the route drawn on it and a finger that has just finished
   * drawing it. Both are decoration, so both answer null rather than failing:
   * a route whose picture could not be taken is still a route, and the list
   * falls back to drawing its shape.
   */
  async function look() {
    const region = regionAroundRoute(route);
    const start = route.waypoints[0];

    // Two frames rather than one: the first is the one React renders into,
    // the second is the one the map has actually redrawn without the dot.
    setPosing(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const [preview, place] = await Promise.all([
      region
        ? map.current
          ?.takeSnapshot({
            ...PREVIEW,
            // Fitted to the picture's shape first, or the map widens the
            // region itself and frames something else.
            region: fitRegion(region, PREVIEW.width, PREVIEW.height),
            format: "png",
            result: "file",
          })
          .then(keepPicture)
          .catch(() => null) ?? null
        : null,
      start ? placeName(start.lat, start.lng) : null,
    ]);

    setPosing(false);
    return { preview: preview ?? null, place };
  }

  function keep() {
    if (route.waypoints.length < 2 || saving) return;
    setSaving(true);
    // Named after the day it was drawn when nobody has said otherwise, and
    // decided here rather than earlier: this is the moment it becomes a thing
    // with a name.
    const called = name?.trim() || autoRouteName(Date.now());
    void look()
      .then(async (shown) => {
        if (editing === null) await saveRoute(called, route, shown);
        else await updateRoute(editing, called, route, shown);
      })
      .then(() => setWritten(true))
      .catch(() => {
        setSaving(false);
        Alert.alert("Parcours non enregistré", "La base de données n'a pas répondu.");
      });
  }

  const drawable = route.waypoints.length > 0;

  // The map is mounted only once it knows what to open on: an initial region
  // is read once and never again, so a route arriving a moment later would be
  // drawn off screen.
  if (opened === null) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: editing === null ? "Nouveau parcours" : "Modifier" }} />
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        // Framed on the route being changed, when there is one: opening on
        // where the phone is standing would put an edit of last week's loop
        // somewhere else entirely.
        initialRegion={
          (opened && regionAroundRoute(opened)) ??
          (coords
            ? {
                latitude: coords.lat, longitude: coords.lng,
                latitudeDelta: WALKING_ZOOM, longitudeDelta: WALKING_ZOOM,
              }
            : PARIS)
        }
        userInterfaceStyle={scheme}
        showsUserLocation={!posing}
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          const point = { lat: latitude, lng: longitude };
          /*
           * A tap landing on a point already placed is not a new point.
           *
           * Tapping a marker is how one is removed, and on some versions that
           * press reaches the map as well — which would take a point out and
           * put another back in the same gesture. It also stops two points
           * being stacked on the same spot by a shaky thumb, which is a route
           * with a leg of no length in it.
           */
          if (route.waypoints.some((placed) => distanceM(placed, point) < 20)) return;
          void addPoint(point);
        }}
      >
        {/* One polyline per leg rather than one for the whole route: a leg
            the router never answered about is drawn as what it is, a guess
            in a straight line, and that is only sayable leg by leg. */}
        {route.legs.map((leg, index) => (
          <Polyline
            key={index}
            coordinates={leg.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
            strokeColor={literalColors.track[scheme]}
            strokeWidth={4}
            lineDashPattern={guessed.includes(index) ? [4, 7] : undefined}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Only the taps are marked, and only while drawing. The points the
            router put in between are the street, not decisions anybody made. */}
        {!posing && route.waypoints.map((point, index) => (
          <Marker
            key={index}
            coordinate={{ latitude: point.lat, longitude: point.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            // Dragged to move it, tapped to take it out: the two things
            // anybody tries on a point they have already placed.
            draggable
            onDragStart={() => remember(route)}
            onDragEnd={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              const moved = movedWaypoint(route, index, { lat: latitude, lng: longitude });
              setRoute(moved);
              void reroute(moved, legsAround(moved, index));
            }}
            onPress={() => {
              remember(route);
              const without = withoutWaypoint(route, index);
              setRoute(without);
              // The leg that closed over the gap is the one that has to be
              // asked about again, and only when there is still one.
              const joined = index - 1;
              if (joined >= 0 && joined < without.legs.length) {
                setGuessed((current) => [...new Set([...current, joined])]);
                void reroute(without, [joined]);
              }
            }}
          >
            <View
              style={[
                styles.pin,
                { borderColor: literalColors.track[scheme] },
                index === 0 && styles.pinFirst,
                index === 0 && { backgroundColor: literalColors.track[scheme] },
              ]}
            />
          </Marker>
        ))}
      </MapView>

      <View style={styles.readout}>
        {/* Tappable whether or not it has a name: the way in has to exist
            before the name does. */}
        <Pressable
          onPress={() => {
            setDraft(name ?? "");
            setNaming(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={name ? `${name}, renommer` : "Nommer ce parcours"}
          hitSlop={6}
          style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}
        >
          <Text style={[styles.name, !name && styles.nameEmpty]} numberOfLines={1}>
            {name ?? "Sans nom"}
          </Text>
          <Ionicons name="pencil" size={13} color={colors.subtle} />
        </Pressable>

        <Text style={styles.distance}>
          {formatDistance(metres)}
          <Text style={styles.unit}> km</Text>
        </Text>
        <Text style={styles.hint}>
          {!drawable
            ? "Touche la carte pour poser le départ."
            : asking
              ? "Calcul du chemin…"
              : guessed.length > 0
                ? `${guessed.length} portion${guessed.length > 1 ? "s" : ""} en ligne droite`
                : isLoop(route)
                  ? "Boucle refermée."
                  : "Touche pour continuer le tracé."}
        </Text>
      </View>

      <View style={styles.tools}>
        <Pressable
          onPress={() => {
            const previous = past[past.length - 1];
            if (!previous) return;
            setPast((shapes) => shapes.slice(0, -1));
            setRoute(previous);
            // Which legs were guesses belongs to the shape being restored,
            // and the honest thing without recording it per shape is to let
            // the marks go: a leg wrongly shown as drawn would be a claim,
            // where a leg wrongly shown as solid is only a missing warning.
            setGuessed((current) => current.filter((at) => at < previous.legs.length));
            setDirty(true);
          }}
          disabled={past.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Annuler la dernière modification"
          style={({ pressed }) => [
            styles.tool, pressed && styles.pressed, past.length === 0 && styles.toolOff,
          ]}
        >
          <Ionicons name="arrow-undo" size={19} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => void share()}
          disabled={route.waypoints.length < 2 || sharing}
          accessibilityRole="button"
          accessibilityLabel="Partager le parcours"
          style={({ pressed }) => [
            styles.tool,
            pressed && styles.pressed,
            (route.waypoints.length < 2 || sharing) && styles.toolOff,
          ]}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="share-outline" size={19} color={colors.text} />
          )}
        </Pressable>
        {/* The drawing does two things nobody asked it to — it moves the
            point you put down, and it goes round by streets you did not
            choose — and both look like mistakes until somebody says
            otherwise. This is where it says otherwise. */}
        <Pressable
          onPress={() => setExplaining(true)}
          accessibilityRole="button"
          accessibilityLabel="Comment le tracé est calculé"
          style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
        >
          <Ionicons name="information" size={19} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            remember(route);
            setRoute(emptyRoute());
            setGuessed([]);
          }}
          disabled={!drawable}
          accessibilityRole="button"
          accessibilityLabel="Effacer le tracé"
          style={({ pressed }) => [styles.tool, pressed && styles.pressed, !drawable && styles.toolOff]}
        >
          <Ionicons name="trash" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <Modal
        visible={explaining}
        transparent
        animationType="fade"
        onRequestClose={() => setExplaining(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setExplaining(false)}>
          <Pressable onPress={() => undefined} style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>Comment le tracé est calculé</Text>
            <Text style={styles.help}>
              Chaque point rejoint le précédent par les chemins praticables à pied : trottoirs,
              sentiers, zones piétonnes. Les sens interdits sont ignorés — ils ne concernent pas
              un coureur.
            </Text>
            <Text style={styles.help}>
              Ton point se pose sur le chemin le plus proche, pas exactement là où ton doigt a
              touché. C&apos;est pour ça qu&apos;il glisse parfois de quelques mètres : au milieu
              d&apos;un bâtiment ou d&apos;un champ, il rejoint la voie la plus proche.
            </Text>
            <Text style={styles.help}>
              Une portion en pointillés est une ligne droite : le calcul n&apos;a pas répondu pour
              elle. Tu peux l&apos;annuler et reposer le point ailleurs.
            </Text>
            <Text style={styles.help}>
              Un point se déplace en le faisant glisser, et se supprime en le touchant. Les
              portions qui le touchaient sont recalculées.
            </Text>
            <Text style={styles.help}>
              Le partage envoie un fichier GPX : une montre, un planificateur ou un autre
              téléphone sauront le lire, et cette app sait le relire.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={naming} transparent animationType="fade" onRequestClose={() => setNaming(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setNaming(false)}>
          <Pressable onPress={() => undefined} style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>Nom du parcours</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              // Static, and the hint below says what an empty field means.
              // Showing the day's name here would mean reading the clock
              // while drawing, and a screen's output cannot depend on when it
              // happened to be drawn.
              placeholder="Sans nom"
              placeholderTextColor={colors.subtle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                setName(draft.trim() || null);
                setDirty(true);
                setNaming(false);
              }}
              style={styles.namingField}
            />
            <Text style={styles.namingHint}>
              Laissé vide, il prendra le nom du jour.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable
        onPress={keep}
        disabled={route.waypoints.length < 2 || saving}
        accessibilityRole="button"
        accessibilityLabel="Enregistrer le parcours"
        style={({ pressed }) => [
          styles.keep,
          pressed && styles.pressed,
          (route.waypoints.length < 2 || saving) && styles.keepOff,
        ]}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.accentText} />
        ) : (
          <Text style={styles.keepLabel}>Enregistrer</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // The one figure that matters while drawing, where the eye already is.
  readout: {
    position: "absolute", top: 12, left: 12,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16,
    backgroundColor: colors.background, ...floatingShadow,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1 },
  name: {
    color: colors.text, fontSize: 15, fontFamily: font.semibold,
    letterSpacing: -0.1, maxWidth: 190,
  },
  nameEmpty: { color: colors.subtle, fontFamily: font.regular },
  distance: {
    color: colors.text, fontSize: 26, fontFamily: font.bold,
    letterSpacing: -0.6, fontVariant: ["tabular-nums"],
  },

  sheetBackdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheetBody: {
    width: "100%", maxWidth: 380, borderRadius: 18, padding: 20, gap: 10,
    backgroundColor: colors.background,
  },
  sheetTitle: {
    color: colors.subtle, fontSize: 11, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  namingField: {
    color: colors.text, fontSize: 19, fontFamily: font.semibold,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
    paddingVertical: 8,
  },
  namingHint: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  help: { color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 22 },

  unit: { color: colors.subtle, fontSize: 13, fontFamily: font.semibold, letterSpacing: 0 },
  hint: { color: colors.muted, fontSize: 13, fontFamily: font.regular, marginTop: 1 },

  tools: { position: "absolute", top: 12, right: 12, gap: 10 },
  tool: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.background, ...floatingShadow,
  },
  toolOff: { opacity: 0.35 },
  pressed: { opacity: 0.6 },

  keep: {
    position: "absolute", left: 16, right: 16, bottom: 24,
    height: 50, borderRadius: 25,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accent, ...floatingShadow,
  },
  keepOff: { opacity: 0.4 },
  keepLabel: { color: colors.accentText, fontSize: 17, fontFamily: font.semibold },

  // A ring for every tap, filled for the one the route starts from: on a loop
  // the start and the end sit on top of one another, and which is which is
  // the only thing the shape cannot say.
  pin: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#ffffff", borderWidth: 3 },
  pinFirst: { width: 15, height: 15, borderRadius: 7.5 },
});
