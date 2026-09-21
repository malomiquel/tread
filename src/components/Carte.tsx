import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { bornes, segments, type Point } from "@/lib/geo";
import { relevePosition, type Coordonnees } from "@/lib/position";
import { couleurs, ombres } from "@/lib/theme";

interface Props {
  points: Point[];
  /** Vrai pendant la course : la caméra suit le dernier point. */
  suivre?: boolean;
  /** Vrai sur l'écran de détail : la trace entière est cadrée une fois. */
  cadrer?: boolean;
  /** Où centrer tant qu'aucun point n'a été enregistré. */
  centreInitial?: Coordonnees | null;
  style?: StyleProp<ViewStyle>;
}

const PARIS = { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const ZOOM_COUREUR = 0.006;

/**
 * Trace de course sur Apple Plans ou Google Maps selon la plateforme.
 * Une polyligne par segment : une pause ne dessine pas de trait entre le
 * point où l'on s'est arrêté et celui où l'on a repris.
 */
export function Carte({ points, suivre = false, cadrer = false, centreInitial = null, style }: Props) {
  const ref = useRef<MapView>(null);
  const [localisation, setLocalisation] = useState(false);
  const vide = points.length === 0;
  const dernier = points.length ? points[points.length - 1] : null;
  const segs = segments(points);

  useEffect(() => {
    if (!suivre || !dernier) return;
    ref.current?.animateCamera({ center: { latitude: dernier.lat, longitude: dernier.lng } }, { duration: 600 });
  }, [suivre, dernier]);

  // La position arrive après le montage de la carte, donc après la lecture
  // d'initialRegion : il faut déplacer la caméra à la main. On passe par
  // animateToRegion et non animateCamera pour corriger aussi le niveau de
  // zoom, sinon la carte se centre juste mais reste à l'échelle d'une ville.
  useEffect(() => {
    if (!centreInitial || !vide) return;
    ref.current?.animateToRegion(
      { latitude: centreInitial.lat, longitude: centreInitial.lng, latitudeDelta: ZOOM_COUREUR, longitudeDelta: ZOOM_COUREUR },
      500,
    );
  }, [centreInitial, vide]);

  const cadrerTrace = () => {
    const b = bornes(points);
    if (!cadrer || !b) return;
    ref.current?.fitToCoordinates(
      [{ latitude: b.minLat, longitude: b.minLng }, { latitude: b.maxLat, longitude: b.maxLng }],
      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false },
    );
  };

  const recentrer = async () => {
    if (localisation) return;
    setLocalisation(true);
    try {
      const p = await relevePosition();
      if (p) {
        ref.current?.animateToRegion(
          { latitude: p.lat, longitude: p.lng, latitudeDelta: ZOOM_COUREUR, longitudeDelta: ZOOM_COUREUR },
          400,
        );
      }
    } catch {
      /* position indisponible : la carte reste où elle est */
    } finally {
      setLocalisation(false);
    }
  };

  const depart = dernier ? { lat: dernier.lat, lng: dernier.lng } : centreInitial;
  const regionInitiale = depart
    ? { latitude: depart.lat, longitude: depart.lng, latitudeDelta: ZOOM_COUREUR, longitudeDelta: ZOOM_COUREUR }
    : PARIS;

  return (
    <View style={[styles.conteneur, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={regionInitiale}
        userInterfaceStyle="light"
        showsUserLocation={!cadrer}
        showsMyLocationButton={false}
        showsCompass={false}
        pitchEnabled={false}
        onMapReady={cadrerTrace}
      >
        {segs.map((seg, i) => (
          <Polyline
            key={i}
            coordinates={seg.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={couleurs.trace}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ))}
        {!suivre && points.length > 0 && (
          <>
            <Marker coordinate={{ latitude: points[0].lat, longitude: points[0].lng }} pinColor="green" title="Départ" />
            {dernier && <Marker coordinate={{ latitude: dernier.lat, longitude: dernier.lng }} pinColor="red" title="Arrivée" />}
          </>
        )}
      </MapView>

      {!cadrer && (
        <Pressable
          onPress={() => void recentrer()}
          accessibilityRole="button"
          accessibilityLabel="Recentrer la carte sur ma position"
          // 44 points de côté : en dessous, la cible devient difficile à
          // viser du pouce, surtout en courant.
          hitSlop={8}
          style={({ pressed }) => [styles.bouton, pressed && styles.boutonPresse]}
        >
          {localisation ? (
            <ActivityIndicator size="small" color={couleurs.accent} />
          ) : (
            <Ionicons name="locate" size={20} color={couleurs.texte} />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, borderRadius: 16, overflow: "hidden", backgroundColor: couleurs.bordure },
  bouton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.surface,
    ...ombres.carte,
  },
  boutonPresse: { transform: [{ scale: 0.96 }], opacity: 0.9 },
});
