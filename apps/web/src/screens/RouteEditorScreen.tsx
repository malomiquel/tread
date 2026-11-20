"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IoArrowUndoOutline, IoChevronBack, IoRepeatOutline, IoTrashOutline } from "react-icons/io5";
import { formatDistance, formatElevation } from "@tread/core/format";
import { defineStrings, useStrings } from "@tread/core/i18n";
import {
  autoRouteName, drawnLine, emptyRoute, fetchLeg, isLoop, legsAround, movedWaypoint, routeDistanceM, snapped,
  withWaypoint, withoutLast, type Route, type RoutePoint,
} from "@tread/core/route";
import { distanceUnit, elevationUnit } from "@tread/core/units";
import { Figures } from "@/components/Figures";
import { LineChart } from "@/components/LineChart";
import { RouteEditorMap } from "@/components/RouteEditorMap";
import { useElevation } from "@/hooks/useElevation";
import { placeName } from "@/lib/place";

const strings = defineStrings({
  fr: {
    back: "Parcours",
    titleNew: "Nouveau parcours",
    titleEdit: "Modifier le parcours",
    name: "Nom du parcours",
    save: "Enregistrer",
    saving: "Enregistrement…",
    hint: "Clique sur la carte pour poser des points : le tracé suit les rues. Fais glisser un point pour le déplacer.",
    undo: "Annuler le dernier point",
    loop: "Revenir au départ",
    clear: "Tout effacer",
    distance: "Distance",
    gain: "D+",
    loss: "D−",
    profile: "Profil d'altitude",
    low: "Min",
    high: "Max",
    failed: "Le parcours n'a pas pu être enregistré. Réessaie.",
    tooShort: "Pose au moins deux points.",
  },
  en: {
    back: "Routes",
    titleNew: "New route",
    titleEdit: "Edit the route",
    name: "Route name",
    save: "Save",
    saving: "Saving…",
    hint: "Click the map to place points: the line follows the streets. Drag a point to move it.",
    undo: "Undo the last point",
    loop: "Back to the start",
    clear: "Clear all",
    distance: "Distance",
    gain: "Gain",
    loss: "Loss",
    profile: "Elevation profile",
    low: "Min",
    high: "Max",
    failed: "The route couldn't be saved. Try again.",
    tooShort: "Place at least two points.",
  },
});

/**
 * Drawing a route on a large screen, where it is easier than with a finger:
 * points clicked on the map, the streets between them asked of the same
 * router the phone uses, the distance and the climb as it grows. Saved here,
 * it reaches the phone at its next sync.
 */
export function RouteEditorScreen({ initial }: {
  initial?: { id: string; name: string; waypoints: RoutePoint[]; legs: RoutePoint[][] };
}) {
  const s = useStrings(strings);
  const router = useRouter();
  const [route, setRoute] = useState<Route>(() => (initial ? { waypoints: initial.waypoints, legs: initial.legs } : emptyRoute()));
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const line = useMemo(() => drawnLine(route), [route]);
  const elevation = useElevation(line);
  const distance = routeDistanceM(route);

  /** Ask the router for one leg and put it in place, unless the route has moved on since. */
  function routeLeg(index: number, from: RoutePoint, to: RoutePoint) {
    void fetchLeg(from, to).then((leg) => {
      setRoute((current) => {
        const still = current.waypoints[index] === from && current.waypoints[index + 1] === to;
        return still ? snapped(current, index, leg) : current;
      });
    });
  }

  function add(point: RoutePoint) {
    setError("");
    const next = withWaypoint(route, point);
    setRoute(next);
    if (next.waypoints.length > 1) {
      const index = next.legs.length - 1;
      routeLeg(index, next.waypoints[index], next.waypoints[index + 1]);
    }
  }

  function move(index: number, point: RoutePoint) {
    const next = movedWaypoint(route, index, point);
    setRoute(next);
    for (const leg of legsAround(next, index)) routeLeg(leg, next.waypoints[leg], next.waypoints[leg + 1]);
  }

  async function save() {
    if (route.waypoints.length < 2) {
      setError(s.tooShort);
      return;
    }
    setSaving(true);
    setError("");
    const place = await placeName(route.waypoints[0]);
    const body = JSON.stringify({ name: name.trim() || autoRouteName(Date.now()), waypoints: route.waypoints, legs: route.legs, place });
    try {
      const response = await fetch(initial ? `/api/routes/${initial.id}` : "/api/routes", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) throw new Error(String(response.status));
      const id = initial?.id ?? ((await response.json()) as { id: string }).id;
      router.push(`/routes/${id}`);
      router.refresh();
    } catch {
      setError(s.failed);
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <Link href={initial ? `/routes/${initial.id}` : "/routes"} className="back"><IoChevronBack aria-hidden />{s.back}</Link>
      <div className="page-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>{initial ? s.titleEdit : s.titleNew}</h1>
          <p className="subtitle">{s.hint}</p>
        </div>
        <button type="button" className="header-button primary" onClick={() => void save()} disabled={saving}>
          {saving ? s.saving : s.save}
        </button>
      </div>

      <div className="editor-bar">
        <input
          className="editor-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={autoRouteName(Date.now())}
          aria-label={s.name}
          maxLength={120}
        />
        <div className="editor-tools">
          <button type="button" className="chip" onClick={() => setRoute(withoutLast(route))} disabled={route.waypoints.length === 0}>
            <IoArrowUndoOutline aria-hidden />{s.undo}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => add(route.waypoints[0])}
            disabled={route.waypoints.length < 2 || isLoop(route)}
          >
            <IoRepeatOutline aria-hidden />{s.loop}
          </button>
          <button type="button" className="chip" onClick={() => setRoute(emptyRoute())} disabled={route.waypoints.length === 0}>
            <IoTrashOutline aria-hidden />{s.clear}
          </button>
        </div>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}

      <RouteEditorMap route={route} onAdd={add} onMove={move} />

      <div className="panel padded" style={{ marginTop: 16 }}>
        <Figures
          tone="page"
          figures={[
            { label: s.distance, value: formatDistance(distance), unit: distanceUnit() },
            { label: s.gain, value: elevation ? formatElevation(elevation.gainM) : "–", unit: elevationUnit() },
            { label: s.loss, value: elevation ? formatElevation(elevation.lossM) : "–", unit: elevationUnit() },
          ]}
        />
        {/* Room kept for the profile, so the page does not jump when it arrives. */}
        <div className="profile-room">
          {elevation ? (
            <LineChart
              series={elevation.profile}
              format={(metres) => `${formatElevation(metres)} ${elevationUnit()}`}
              lowLabel={s.low}
              highLabel={s.high}
              label={s.profile}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
