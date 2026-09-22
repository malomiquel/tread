import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { fitRegion } from "@/lib/geo";
import { keepPicture, PREVIEW } from "@/lib/picture";
import { drawnLine, regionAroundRoute, type Route } from "@/lib/route";
import { literalColors } from "@/lib/theme";

/** Where the map is parked: laid out and drawn, simply not on screen. */
const OFFSCREEN = -(PREVIEW.width + 40);

export interface RouteSnapshotHandle {
  /** Photographs one route, and resolves where the picture was kept. */
  capture: (route: Route) => Promise<string | null>;
}

/**
 * The map that exists only to photograph routes nobody has drawn here.
 *
 * A route drawn in the editor is photographed by the editor's own map, which
 * is already on screen with the route on it. A route that arrived from a file
 * has never been on any map, so it needs one — and this is one, parked off
 * screen, asked for a picture and asked again for the next route.
 *
 * Deliberately not CardMapSource: that one exists to photograph a run at the
 * share card's framing and weight, holds a single track for its whole life,
 * and answers a different question. Two maps that are never in the same place
 * doing the same thing at different sizes is one map too few, not one too
 * many.
 */
export const RouteSnapshot = forwardRef<RouteSnapshotHandle, object>(function RouteSnapshot(
  _props,
  ref,
) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const map = useRef<MapView>(null);
  /** The route currently being photographed, which is why it is drawn at all. */
  const [showing, setShowing] = useState<Route | null>(null);

  useImperativeHandle(ref, () => ({
    capture: async (route) => {
      const region = regionAroundRoute(route);
      if (!region) return null;

      setShowing(route);
      // Two frames rather than one: the first is the one React renders into,
      // the second is the one the map has actually drawn the line in.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      try {
        const taken = await map.current?.takeSnapshot({
          ...PREVIEW,
          // Fitted to the picture's shape first, or the map widens the region
          // itself and frames something else.
          region: fitRegion(region, PREVIEW.width, PREVIEW.height),
          format: "png",
          result: "file",
        });
        return taken ? keepPicture(taken) : null;
      } catch {
        return null;
      } finally {
        setShowing(null);
      }
    },
  }), []);

  const line = showing ? drawnLine(showing) : [];

  return (
    <View style={styles.parked} pointerEvents="none" collapsable={false}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        userInterfaceStyle={scheme}
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
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  parked: {
    position: "absolute", left: OFFSCREEN, top: 0,
    width: PREVIEW.width, height: PREVIEW.height,
  },
});
