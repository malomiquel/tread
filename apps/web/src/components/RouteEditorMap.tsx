"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { drawnLine, type Route, type RoutePoint } from "@tread/core/route";

const strings = defineStrings({
  fr: { map: "Carte : clique pour ajouter un point, fais glisser un point pour le déplacer" },
  en: { map: "Map: click to add a point, drag a point to move it" },
});

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#00348f";

/** France as a whole, until the route or the browser says where. */
const FALLBACK = { center: [2.35, 46.6] as [number, number], zoom: 5 };

/**
 * The map a route is drawn on: a click adds a point, a point dragged moves,
 * the line between them is whatever the editor says it is. The map knows
 * nothing about routing; it only reports clicks and drags and draws the
 * route it is given.
 */
export function RouteEditorMap({ route, onAdd, onMove }: {
  route: Route;
  onAdd: (point: RoutePoint) => void;
  onMove: (index: number, point: RoutePoint) => void;
}) {
  const s = useStrings(strings);
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const maplibre = useRef<typeof import("maplibre-gl") | null>(null);
  // Read through refs: the map is made once, the callbacks change every render.
  const add = useRef(onAdd);
  const move = useRef(onMove);
  const latest = useRef(route);
  useEffect(() => {
    add.current = onAdd;
    move.current = onMove;
    latest.current = route;
  });

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};

    void import("maplibre-gl").then((module) => {
      if (disposed) return;
      // Bundled as CommonJS: the library is the default export at run time,
      // the namespace itself to the types.
      const lib = (module as unknown as { default?: typeof module }).default ?? module;
      maplibre.current = lib;
      const dark = window.matchMedia("(prefers-color-scheme: dark)");
      const start = latest.current.waypoints;
      const instance = new lib.Map({
        container: element,
        style: dark.matches ? STYLES.dark : STYLES.light,
        ...(start.length > 0
          ? {
            bounds: start.reduce(
              (box, p) => box.extend([p.lng, p.lat]),
              new lib.LngLatBounds([start[0].lng, start[0].lat], [start[0].lng, start[0].lat]),
            ),
            fitBoundsOptions: { padding: 60, maxZoom: 15 },
          }
          : FALLBACK),
        attributionControl: { compact: true },
        doubleClickZoom: false,
      });
      map.current = instance;
      instance.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      instance.getCanvas().style.cursor = "crosshair";

      // Where the runner is: a dot on the map and a button to come back to it.
      // A new route starts there, when the browser is willing to say.
      const locate = new lib.GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
        fitBoundsOptions: { maxZoom: 15 },
        showUserLocation: true,
        trackUserLocation: false,
      });
      instance.addControl(locate, "top-right");
      if (start.length === 0) instance.once("load", () => locate.trigger());

      instance.on("click", (event) => add.current({ lat: event.lngLat.lat, lng: event.lngLat.lng }));
      instance.on("style.load", () => {
        drawLine(instance, latest.current);
        placeHandles();
      });
      const follow = () => instance.setStyle(dark.matches ? STYLES.dark : STYLES.light);
      dark.addEventListener("change", follow);
      cleanup = () => {
        dark.removeEventListener("change", follow);
        instance.remove();
        map.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
    // Made once; the route is drawn by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A handle per point, draggable, the start set apart. */
  function placeHandles() {
    const instance = map.current;
    const lib = maplibre.current;
    if (!instance || !lib) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = latest.current.waypoints.map((point, index) => {
      const element = document.createElement("div");
      element.className = `route-handle${index === 0 ? " start" : ""}`;
      const marker = new lib.Marker({ element, draggable: true }).setLngLat([point.lng, point.lat]).addTo(instance);
      // A click on a handle is not a click on the map: it must not add a point.
      element.addEventListener("click", (event) => event.stopPropagation());
      marker.on("dragend", () => {
        const at = marker.getLngLat();
        move.current(index, { lat: at.lat, lng: at.lng });
      });
      return marker;
    });
  }

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    latest.current = route;
    if (instance.isStyleLoaded()) drawLine(instance, route);
    placeHandles();
    // placeHandles reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return <div ref={holder} className="map editor" role="application" aria-label={s.map} />;
}

/** The route's line, cased like the run tracks, drawn or redrawn. */
function drawLine(map: MapLibreMap, route: Route) {
  const coordinates = drawnLine(route).map((p) => [p.lng, p.lat] as [number, number]);
  const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } };
  const source = map.getSource("route") as { setData?: (value: typeof data) => void } | undefined;
  if (source?.setData) {
    source.setData(data);
    return;
  }
  map.addSource("route", { type: "geojson", data });
  map.addLayer({
    id: "route-casing", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": token("--background"), "line-width": 8 },
  });
  map.addLayer({
    id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": token("--track"), "line-width": 5 },
  });
}
