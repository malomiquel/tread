import { useEffect, useRef } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { bornes, segments, type Point } from "@/lib/geo";
import type { Coordonnees } from "@/lib/position";
import { couleurs } from "@/lib/theme";

interface Props {
  points: Point[];
  /** Vrai pendant la course : la camera suit le dernier point. */
  suivre?: boolean;
  /** Vrai sur l'ecran de detail : la trace entiere est cadree une fois. */
  cadrer?: boolean;
  /** Ou centrer tant qu'aucun point n'a ete enregistre. */
  centreInitial?: Coordonnees | null;
  style?: StyleProp<ViewStyle>;
}

const PARIS = { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.05, longitudeDelta: 0.05 };

/**
 * Trace de course sur Apple Plans ou Google Maps selon la plateforme.
 * Une polyligne par segment : une pause ne dessine pas de trait entre le
 * point ou l'on s'est arrete et celui ou l'on a repris.
 */
export function Carte({ points, suivre = false, cadrer = false, centreInitial = null, style }: Props) {
  const ref = useRef<MapView>(null);
  const vide = points.length === 0;
  const dernier = points.length ? points[points.length - 1] : null;
  const segs = segments(points);

  useEffect(() => {
    if (!suivre || !dernier) return;
    ref.current?.animateCamera({ center: { latitude: dernier.lat, longitude: dernier.lng } }, { duration: 600 });
  }, [suivre, dernier]);

  // La position arrive apres le montage de la carte, donc apres la lecture
  // d'initialRegion : il faut deplacer la camera a la main. On passe par
  // animateToRegion et non animateCamera pour corriger aussi le niveau de
  // zoom, sinon la carte se centre juste mais reste a l'echelle d'une ville.
  useEffect(() => {
    if (!centreInitial || !vide) return;
    ref.current?.animateToRegion(
      { latitude: centreInitial.lat, longitude: centreInitial.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
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

  const depart = dernier ? { lat: dernier.lat, lng: dernier.lng } : centreInitial;
  const regionInitiale = depart
    ? { latitude: depart.lat, longitude: depart.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }
    : PARIS;

  return (
    <MapView
      ref={ref}
      style={[styles.carte, style]}
      initialRegion={regionInitiale}
      userInterfaceStyle="dark"
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
  );
}

const styles = StyleSheet.create({ carte: { flex: 1, borderRadius: 16, overflow: "hidden" } });
