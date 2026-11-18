"use client";

import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { autoName, formatDate, formatDistance, formatDuration, formatElevation, formatPace, formatSpeed } from "@tread/core/format";
import { defineStrings, setLanguage, useStrings } from "@tread/core/i18n";
import { distanceUnit, elevationUnit, paceUnit, speedUnit } from "@tread/core/units";
import { Brand } from "@/components/Brand";
import { RunShape } from "@/components/RunShape";
import { readOuting, type Outing } from "@/lib/outing";

const strings = defineStrings({
  fr: {
    title: "Mes sorties",
    count: (n: number) => (n === 1 ? "1 sortie" : `${n} sorties`),
    total: "Distance totale",
    runsAndRides: (runs: number, rides: number) => `${runs} course${runs === 1 ? "" : "s"} · ${rides} vélo`,
    list: "Sorties",
    addMore: "Ajouter des GPX",
    getStarted: "Pour commencer",
    openTitle: "Ouvrir des fichiers GPX",
    openDetail: "Un GPX ou l'archive de Tread, d'une montre ou d'un autre site. Lus ici, jamais envoyés.",
    drop: "ou dépose-les ici",
    note: "Dans Tread, une sortie s'exporte en GPX depuis son menu ⋯, et toutes à la fois depuis Réglages › Données › Toutes mes courses.",
    ride: "Vélo",
    untitled: "Sortie",
    unreadable: (names: string) => `Aucune trace lisible dans : ${names}`,
  },
  en: {
    title: "My outings",
    count: (n: number) => (n === 1 ? "1 outing" : `${n} outings`),
    total: "Total distance",
    runsAndRides: (runs: number, rides: number) => `${runs} run${runs === 1 ? "" : "s"} · ${rides} ride${rides === 1 ? "" : "s"}`,
    list: "Outings",
    addMore: "Add GPX files",
    getStarted: "Get started",
    openTitle: "Open GPX files",
    openDetail: "A GPX or Tread's archive, from a watch or another site. Read here, never uploaded.",
    drop: "or drop them here",
    note: "In Tread, an outing exports as GPX from its ⋯ menu, and all of them from Settings › Data › All my runs.",
    ride: "Ride",
    untitled: "Outing",
    unreadable: (names: string) => `No readable track in: ${names}`,
  },
});

/** The GPX documents in a file: the file itself, or each one inside Tread's "All my runs" archive. */
async function gpxDocuments(file: File): Promise<{ file: string; outing: Outing | null }[]> {
  if (!/\.zip$/i.test(file.name)) {
    return [{ file: file.name, outing: readOuting(`${file.name}-${file.lastModified}`, await file.text()) }];
  }
  const archive = await JSZip.loadAsync(file);
  const entries = Object.values(archive.files).filter((entry) => !entry.dir && /\.gpx$/i.test(entry.name));
  return Promise.all(
    entries.map(async (entry) => ({ file: entry.name, outing: readOuting(`${file.name}/${entry.name}`, await entry.async("string")) })),
  );
}

export function Outings() {
  // The server chose the language from the browser's and wrote it on <html>.
  useEffect(() => {
    setLanguage(document.documentElement.lang === "fr" ? "fr" : "en");
  }, []);
  const s = useStrings(strings);
  const [outings, setOutings] = useState<Outing[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function open(files: FileList | null) {
    if (!files?.length) return;
    const read = (await Promise.all(Array.from(files).map(gpxDocuments))).flat();
    setFailed(read.filter((r) => !r.outing).map((r) => r.file));
    setOutings((current) => {
      const known = new Set(current.map((o) => o.id));
      const added = read.flatMap((r) => (r.outing && !known.has(r.outing.id) ? [r.outing] : []));
      return [...current, ...added].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    });
  }

  const totalM = outings.reduce((sum, o) => sum + o.distanceM, 0);
  const rides = outings.filter((o) => o.ride).length;

  return (
    <main
      className="page"
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        void open(event.dataTransfer.files);
      }}
    >
      <input ref={input} type="file" accept=".gpx,.zip,application/gpx+xml,application/zip" multiple hidden onChange={(e) => void open(e.target.files)} />
      <header className="top">
        <Brand />
        {outings.length > 0 && (
          <button type="button" className="pill" onClick={() => input.current?.click()}>
            {s.addMore}
          </button>
        )}
      </header>
      <h1 className="title">{s.title}</h1>
      <p className="subtitle num">{outings.length > 0 ? s.count(outings.length) : ""}</p>

      {outings.length === 0 ? (
        <>
          <div className="empty-rule" />
          <div className="label" style={{ marginBottom: 10 }}>
            {s.getStarted}
          </div>
          <div className={`drop${over ? " over" : ""}`}>
            <button type="button" className="action-card" onClick={() => input.current?.click()}>
              <div>
                <h3>{s.openTitle}</h3>
                <p>{s.openDetail}</p>
              </div>
            </button>
            <p className="note">{s.drop}</p>
          </div>
          <p className="note">{s.note}</p>
        </>
      ) : (
        <>
          <div className="banner">
            <div className="label">{s.total}</div>
            <div className="figure num">
              {formatDistance(totalM)}
              <small>{distanceUnit()}</small>
            </div>
            <div className="detail num">{s.runsAndRides(outings.length - rides, rides)}</div>
          </div>
          <div className="section-head">
            <h2>{s.list}</h2>
            <span className="aside num">
              {formatDistance(totalM)} {distanceUnit()}
            </span>
          </div>
          <ul className="rows">
            {outings.map((o) => (
              <li key={o.id} className="row">
                <div className="tile">
                  <RunShape points={o.points} />
                </div>
                <div>
                  <div className="name">
                    {o.name ?? (o.startedAt ? autoName(o.startedAt, o.ride) : s.untitled)}
                    {o.ride && <span className="chip">{s.ride}</span>}
                  </div>
                  <div className="detail num">
                    {o.startedAt ? `${formatDate(o.startedAt)} · ` : ""}
                    {formatDuration(o.durationS)} · {formatElevation(o.elevationGainM)}
                    {elevationUnit()}
                  </div>
                </div>
                <div className="figures num">
                  <strong>{formatDistance(o.distanceM)}</strong>
                  <span className="unit">{distanceUnit()}</span>
                  <div className="detail">
                    {o.ride
                      ? `${formatSpeed(o.durationS > 0 ? o.distanceM / o.durationS : 0)} ${speedUnit()}`
                      : `${formatPace(o.paceSecPerKm)} ${paceUnit()}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {failed.length > 0 && <p className="error">{s.unreadable(failed.join(", "))}</p>}
    </main>
  );
}
