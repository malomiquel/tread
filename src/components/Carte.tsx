import { useEffect, useRef } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { bornes, segments, type Point } from "@/lib/geo";
import { couleurs } from "@/lib/theme";

interface Props {
  points: Point[];
  /** Vrai pendant la course : la camera suit le dernier point. */
  suivre?: boolean;
  /** Vrai sur l'ecran de detail : la trace entiere est cadree une fois. */
  cadrer?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PARIS = { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.05, longitudeDelta: 0.05 };

/**
 * Trace de course sur Apple Plans ou Google Maps selon la plateforme.
 * Une polyligne par segment : une pause ne dessine pas de trait entre le
 * point ou l'on s'est arrete et celui ou l'on a repris.
 */
export function Carte({ points, suivre = false, cadrer = false, style }: Props) {
  const ref = useRef<MapView>(null);
  const dernier = points.length ? points[points.length - 1] : null;
  const segs = segments(points);

  useEffect(() => {
    if (!suivre || !dernier) return;
    ref.current?.animateCamera({ center: { latitude: dernier.lat, longitude: dernier.lng } }, { duration: 600 });
  }, [suivre, dernier]);

  const cadrerTrace = () => {
    const b = bornes(points);
    if (!cadrer || !b) return;
    ref.current?.fitToCoordinates(
      [{ latitude: b.minLat, longitude: b.minLng }, { latitude: b.maxLat, longitude: b.maxLng }],
      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false },
    );
  };

  const regionInitiale = dernier
    ? { latitude: dernier.lat, longitude: dernier.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : PARIS;

  return (
    <MapView
      ref={ref}
      style={[styles.carte, style]}
      initialRegion={regionInitiale}
      userInterfaceStyle="dark"
      showsUserLocation={suivre}
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
