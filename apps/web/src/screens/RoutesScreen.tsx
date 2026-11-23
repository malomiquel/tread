"use client";

import { useState } from "react";
import Link from "next/link";
import { IoAddOutline, IoChevronForward, IoCloudUploadOutline, IoFlagOutline } from "react-icons/io5";
import { daysUntil } from "@tread/core/raceDay";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { raceWhen } from "@/screens/RaceScreen";
import { formatDistance } from "@tread/core/format";
import { defineStrings, intlLocale, plural, useStrings } from "@tread/core/i18n";
import { distanceUnit } from "@tread/core/units";
import { ChoiceMenu } from "@/components/ChoiceMenu";
import { EmptyState } from "@/components/EmptyState";
import { NoMatch } from "@/components/NoMatch";
import { PageHeader } from "@/components/PageHeader";
import { RunShape } from "@/components/RunShape";
import { routeLengthM, routeShape } from "@/lib/route";
import { useGpxRoutes } from "@/hooks/useGpxRoutes";
import type { RouteRow } from "@/lib/types";

type Sort = "recent" | "longest" | "shortest" | "name";

const strings = defineStrings({
  fr: {
    title: "Parcours",
    count: (n: number, km: string) => `${plural(n, "parcours", "parcours")} · ${km} ${distanceUnit()}`,
    narrowed: (shown: number, all: number) => `${shown} sur ${all}`,
    search: "Chercher un parcours",
    sort: "Trier",
    sorts: { recent: "Les plus récents", longest: "Les plus longs", shortest: "Les plus courts", name: "Par nom" } as Record<Sort, string>,
    emptyTitle: "Dessiner un parcours",
    emptyDetail: "Clique sur la carte : le tracé suit les rues, la distance et le D+ tombent juste.",
    importTitle: "Importer un fichier GPX",
    importDetail: "Depuis un planificateur, une montre ou un ami. Tu peux aussi le déposer ici.",
    note: "Un parcours fait ici arrive sur ton téléphone à la prochaine synchro.",
    newRoute: "Nouveau parcours",
    importGpx: "Importer un GPX",
    importing: "Import…",
    race: "Course",
    addRace: "Ajouter une course officielle : importe le GPX de son parcours",
    planRace: "Préparer une course",
    planRaceDetail: "Importe le parcours officiel, puis choisis la date et ton objectif.",
    upcoming: "Courses à venir",
    raceToday: "Aujourd'hui",
    raceIn: (days: number) => `J-${days}`,
    imported: (added: number, unreadable: number) => [
      added > 0 ? plural(added, "parcours importé", "parcours importés") : null,
      unreadable > 0 ? plural(unreadable, "fichier illisible", "fichiers illisibles") : null,
    ].filter(Boolean).join(" · ") || "Aucun parcours dans ce fichier.",
  },
  en: {
    title: "Routes",
    count: (n: number, km: string) => `${plural(n, "route", "routes")} · ${km} ${distanceUnit()}`,
    narrowed: (shown: number, all: number) => `${shown} of ${all}`,
    search: "Search routes",
    sort: "Sort",
    sorts: { recent: "Most recent", longest: "Longest", shortest: "Shortest", name: "By name" } as Record<Sort, string>,
    emptyTitle: "Draw a route",
    emptyDetail: "Click the map: the line follows the streets, so the distance and gain come out right.",
    importTitle: "Import a GPX file",
    importDetail: "From a planner, a watch or a friend. You can also drop it here.",
    note: "A route made here reaches your phone at its next sync.",
    newRoute: "New route",
    importGpx: "Import a GPX",
    importing: "Importing…",
    race: "Race",
    addRace: "Add an official race: import its course GPX",
    planRace: "Plan a race",
    planRaceDetail: "Import the official course, then choose the date and your goal.",
    upcoming: "Upcoming races",
    raceToday: "Today",
    raceIn: (days: number) => `${plural(days, "day", "days")} to go`,
    imported: (added: number, unreadable: number) => [
      added > 0 ? plural(added, "route imported", "routes imported") : null,
      unreadable > 0 ? plural(unreadable, "unreadable file", "unreadable files") : null,
    ].filter(Boolean).join(" · ") || "No route in this file.",
  },
});

export function RoutesScreen({ routes }: { routes: RouteRow[] }) {
  const s = useStrings(strings);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const gpx = useGpxRoutes();
  const raceGpx = useGpxRoutes({ race: true });
  const [over, setOver] = useState(false);
  // A GPX file dropped anywhere on the page is imported.
  const drop = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setOver(false);
      void gpx.importFiles(event.dataTransfer.files);
    },
  };
  const status = gpx.busy || raceGpx.busy ? s.importing : gpx.result ? s.imported(gpx.result.added, gpx.result.unreadable) : null;

  if (routes.length === 0) {
    return (
      <div className={`page narrow${over ? " dropping" : ""}`} {...drop}>
        <input {...gpx.inputProps} />
        <input {...raceGpx.inputProps} />
        <PageHeader title={s.title} subtitle={status} />
        <EmptyState
          actions={[
            { title: s.emptyTitle, detail: s.emptyDetail, icon: <IoAddOutline size={22} />, href: "/routes/new", primary: true },
            { title: s.importTitle, detail: s.importDetail, icon: <IoCloudUploadOutline size={22} />, onClick: gpx.pick },
            { title: s.planRace, detail: s.planRaceDetail, icon: <IoFlagOutline size={22} />, onClick: raceGpx.pick },
          ]}
          note={s.note}
        />
      </div>
    );
  }

  const measured = routes.map((route) => ({ ...route, lengthM: routeLengthM(route.line) }));
  const needle = query.trim().toLocaleLowerCase();
  const shown = measured
    .filter((route) => !needle || route.name.toLocaleLowerCase().includes(needle) || (route.place ?? "").toLocaleLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "longest" ? b.lengthM - a.lengthM
        : sort === "shortest" ? a.lengthM - b.lengthM
          : sort === "name" ? a.name.localeCompare(b.name, intlLocale())
            : b.createdAt - a.createdAt);
  const total = measured.reduce((sum, route) => sum + route.lengthM, 0);
  // Races still to run, soonest first, kept through their whole day.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const races = measured
    .filter((route): route is typeof route & { race: { date: number } } =>
      route.race?.date != null && route.race.date >= today.getTime())
    .sort((a, b) => a.race.date - b.race.date);

  return (
    <div className={`page narrow${over ? " dropping" : ""}`} {...drop}>
      <input {...gpx.inputProps} />
      <input {...raceGpx.inputProps} />
      <PageHeader
        title={s.title}
        subtitle={status ?? (shown.length < measured.length ? s.narrowed(shown.length, measured.length) : s.count(measured.length, formatDistance(total)))}
        action={
          <div className="header-actions">
            <button type="button" className="header-button" onClick={raceGpx.pick} disabled={raceGpx.busy} title={s.addRace} aria-label={s.addRace}>
              <IoFlagOutline size={18} aria-hidden />
              <span>{s.race}</span>
            </button>
            <button type="button" className="header-button" onClick={gpx.pick} disabled={gpx.busy}>
              <IoCloudUploadOutline size={18} aria-hidden />
              <span>{s.importGpx}</span>
            </button>
            <Link href="/routes/new" className="header-button primary">
              <IoAddOutline size={18} aria-hidden />
              <span>{s.newRoute}</span>
            </Link>
          </div>
        }
      />
      {races.length > 0 && !needle ? (
        <>
          <SectionHeader title={s.upcoming} />
          <div className="panel" style={{ marginBottom: 18 }}>
            <ul className="rows">
              {races.map((route) => {
                const days = daysUntil(route.race.date, Date.now());
                return (
                  <li key={route.id}>
                    <RecordRow
                      icon={<IoFlagOutline />}
                      name={route.name}
                      detail={`${raceWhen(route.race.date)} · ${formatDistance(route.lengthM * (route.race.laps ?? 1))} ${distanceUnit()}`}
                      value={days <= 0 ? s.raceToday : s.raceIn(days)}
                      href={`/routes/${route.id}/race`}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      ) : null}
      {measured.length > 1 ? (
        <>
          <input className="search" type="search" placeholder={s.search} aria-label={s.search} value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="chip-row" style={{ marginBottom: 14 }}>
            <ChoiceMenu
              title={s.sort}
              label={s.sorts[sort]}
              on
              chosen={sort}
              onChoose={setSort}
              choices={(Object.keys(s.sorts) as Sort[]).map((value) => ({ value, label: s.sorts[value] }))}
            />
          </div>
        </>
      ) : null}
      {shown.length === 0 ? (
        <NoMatch onShowAll={() => setQuery("")} />
      ) : (
        <div className="panel">
          <ul className="rows">
            {shown.map((route) => (
              <li key={route.id}>
                <Link href={`/routes/${route.id}`} className="row">
                  <span className="tile"><RunShape shape={routeShape(route.line)} /></span>
                  <span className="row-main">
                    <span className="row-name" style={{ display: "block" }}>{route.name}</span>
                    <span className="row-detail" style={{ display: "block" }}>
                      {route.place ?? new Date(route.createdAt).toLocaleDateString(intlLocale(), { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </span>
                  <span className="row-figures"><strong>{formatDistance(route.lengthM)}</strong><span className="unit">{distanceUnit()}</span></span>
                  <IoChevronForward className="chevron" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
