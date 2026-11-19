"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { defineStrings, useStrings } from "@tread/core/i18n";

const strings = defineStrings({ fr: { map: "Carte du tracé" }, en: { map: "Map of the track" } });

/** OpenFreeMap: OpenStreetMap tiles with no key and no account, light and dark. */
const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** A token's value, read off the page: a map is drawn on a canvas and cannot read a CSS variable. */
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#00348f";

/**
 * A track on the map, start and finish marked, framed to fit.
 *
 * The line is the `track` colour of the palette, as on the phone; the map
 * follows the appearance and redraws the line when it changes.
 */
export function TrackMap({ line, small }: { line: readonly { lat: number; lng: number }[]; small?: boolean }) {
  const s = useStrings(strings);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = holder.current;
    if (!element || line.length < 2) return;
    let disposed = false;
    let cleanup = () => {};

    void import("maplibre-gl").then(({ default: maplibre }) => {
      if (disposed) return;
      const dark = window.matchMedia("(prefers-color-scheme: dark)");
      const coordinates = line.map((p) => [p.lng, p.lat] as [number, number]);
      const bounds = coordinates.reduce(
        (box, point) => box.extend(point),
        new maplibre.LngLatBounds(coordinates[0], coordinates[0]),
      );
      const map = new maplibre.Map({
        container: element,
        style: dark.matches ? STYLES.dark : STYLES.light,
        bounds,
        fitBoundsOptions: { padding: 36 },
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

      const draw = () => {
        const colour = token("--track");
        const ground = token("--background");
        if (!map.getSource("track")) {
          map.addSource("track", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } } });
          map.addSource("ends", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [
                { type: "Feature", properties: { end: "start" }, geometry: { type: "Point", coordinates: coordinates[0] } },
                { type: "Feature", properties: { end: "finish" }, geometry: { type: "Point", coordinates: coordinates[coordinates.length - 1] } },
              ],
            },
          });
        }
        if (!map.getLayer("track-casing")) {
          map.addLayer({ id: "track-casing", type: "line", source: "track", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": ground, "line-width": 7 } });
          map.addLayer({ id: "track", type: "line", source: "track", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": colour, "line-width": 4 } });
          map.addLayer({
            id: "ends", type: "circle", source: "ends",
            paint: {
              "circle-radius": 6, "circle-stroke-width": 3, "circle-stroke-color": ground,
              "circle-color": ["match", ["get", "end"], "start", colour, token("--text")],
            },
          });
        }
      };
      map.on("style.load", draw);

      const follow = () => map.setStyle(dark.matches ? STYLES.dark : STYLES.light);
      dark.addEventListener("change", follow);
      cleanup = () => {
        dark.removeEventListener("change", follow);
        map.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [line]);

  return <div ref={holder} className={`map${small ? " small" : ""}`} role="img" aria-label={s.map} />;
}
