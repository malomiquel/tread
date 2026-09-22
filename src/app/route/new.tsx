import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, Text, useColorScheme, View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { saveRoute } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { useInitialLocation } from "@/lib/location";
import {
  autoRouteName, drawnLine, emptyRoute, fetchLeg, isLoop, lastWaypoint, routeDistanceM,
  snapped, withoutLast, withWaypoint, type Route, type RoutePoint,
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
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const { coords } = useInitialLocation();
  const [route, setRoute] = useState<Route>(emptyRoute());
  /** True while the router is being asked about the leg just tapped. */
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  const line = drawnLine(route);
  const metres = routeDistanceM(route);

  /**
   * A tap lands at once, and the streets catch up.
   *
   * The straight line is drawn first and replaced when the router answers,
   * rather than the finger waiting on a network round trip. A route drawn at
   * the speed of a server is a route nobody finishes drawing.
   */
  async function addPoint(point: RoutePoint) {
    const from = lastWaypoint(route);
    const straight = withWaypoint(route, point);
    setRoute(straight);
    if (!from) return;

    setAsking(true);
    try {
      const leg = await fetchLeg(from, point);
      if (leg.length > 1) {
        setRoute((current) => {
          // Only if nothing else has happened since: an undo or another tap
          // during the wait has already moved on, and this answer is about a
          // route that no longer exists.
          if (current.waypoints.length !== straight.waypoints.length) return current;
          return snapped(current, current.legs.length - 1, leg);
        });
      }
    } finally {
      setAsking(false);
    }
  }

  function keep() {
    if (route.waypoints.length < 2 || saving) return;
    setSaving(true);
    void saveRoute(autoRouteName(Date.now()), route)
      .then(() => router.back())
      .catch(() => {
        setSaving(false);
        Alert.alert("Parcours non enregistré", "La base de données n'a pas répondu.");
      });
  }

  const drawable = route.waypoints.length > 0;

  return (
    <View style={styles.screen}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={
          coords
            ? {
                latitude: coords.lat, longitude: coords.lng,
                latitudeDelta: WALKING_ZOOM, longitudeDelta: WALKING_ZOOM,
              }
            : PARIS
        }
        userInterfaceStyle={scheme}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          void addPoint({ lat: latitude, lng: longitude });
        }}
      >
        {line.length > 1 && (
          <Polyline
            coordinates={line.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
            strokeColor={literalColors.track[scheme]}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Only the taps are marked. The points the router put in between are
            the street, not decisions anybody made. */}
        {route.waypoints.map((point, index) => (
          <Marker
            key={`${point.lat},${point.lng},${index}`}
            coordinate={{ latitude: point.lat, longitude: point.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
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
        <Text style={styles.distance}>
          {formatDistance(metres)}
          <Text style={styles.unit}> km</Text>
        </Text>
        <Text style={styles.hint}>
          {!drawable
            ? "Touche la carte pour poser le départ."
            : asking
              ? "Calcul du chemin…"
              : isLoop(route)
                ? "Boucle refermée."
                : "Touche pour continuer le tracé."}
        </Text>
      </View>

      <View style={styles.tools}>
        <Pressable
          onPress={() => setRoute(withoutLast(route))}
          disabled={!drawable}
          accessibilityRole="button"
          accessibilityLabel="Annuler le dernier point"
          style={({ pressed }) => [styles.tool, pressed && styles.pressed, !drawable && styles.toolOff]}
        >
          <Ionicons name="arrow-undo" size={19} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => setRoute(emptyRoute())}
          disabled={!drawable}
          accessibilityRole="button"
          accessibilityLabel="Effacer le tracé"
          style={({ pressed }) => [styles.tool, pressed && styles.pressed, !drawable && styles.toolOff]}
        >
          <Ionicons name="trash" size={18} color={colors.danger} />
        </Pressable>
      </View>

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
  distance: {
    color: colors.text, fontSize: 26, fontFamily: font.bold,
    letterSpacing: -0.6, fontVariant: ["tabular-nums"],
  },
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

  // A ring for every tap, filled for the one the route starts from: on a
  // loop the start and the end sit on top of one another, and which is which
  // is the only thing the shape cannot say.
  pin: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#ffffff", borderWidth: 3 },
  pinFirst: { width: 15, height: 15, borderRadius: 7.5 },
});
