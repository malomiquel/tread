"use client";

import Link from "next/link";
import { IoChevronBack } from "react-icons/io5";
import { activityName, sportOf } from "@tread/core/activity";
import { paceSeries } from "@tread/core/charts";
import { formatDistance, formatDuration, formatElevation, formatPace, formatSpeed } from "@tread/core/format";
import { effortKm, elevationChangeM, elevationProfile, splits } from "@tread/core/geo";
import { gradeAdjustedPace } from "@tread/core/gradePace";
import { formatBpm, zoneName } from "@tread/core/heart";
import { decimal, defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import { lapsOf } from "@tread/core/laps";
import { exertionName, kindName, sessionKind } from "@tread/core/plan";
import { distanceUnit, elevationUnit, paceUnit, speedUnit, toElevationUnits, unitLengthM } from "@tread/core/units";
import { weatherLabel, weatherLine } from "@tread/core/weather";
import { sessionById, sessionName } from "@tread/core/workout";
import { Figures } from "@/components/Figures";
import { LineChart } from "@/components/LineChart";
import { SectionHeader } from "@/components/SectionHeader";
import { SummaryBanner } from "@/components/SummaryBanner";
import { TrackMap } from "@/components/TrackMap";
import { outingName } from "@/lib/display";
import type { OutingDetail } from "@/lib/types";

const strings = defineStrings({
  fr: {
    back: "Historique",
    distance: "Distance",
    time: "Temps",
    pace: "Allure",
    speed: "Vitesse",
    climb: "Dénivelé +",
    descent: "Dénivelé −",
    effortKm: "Km-effort",
    gap: "Allure ajustée",
    splits: "Kilomètre par kilomètre",
    splitsMiles: "Mile par mile",
    laps: "Tours",
    lap: (n: number) => `Tour ${n}`,
    finish: "Fin",
    altitude: "Altitude",
    paceAlong: "Allure en chemin",
    low: "Min",
    high: "Max",
    slowest: "Plus lent",
    fastest: "Plus rapide",
    about: "La sortie",
    session: "Séance",
    felt: "Ressenti",
    shoes: "Chaussures",
    weather: "Météo",
    cadence: "Cadence",
    cadenceUnit: "pas/min",
    heart: "Fréquence cardiaque",
    heartLine: (avg: string, max: string) => `${avg} bpm en moyenne · ${max} au plus haut`,
    zones: "Zones",
    note: "Note",
    nothing: "Rien d'autre n'a été noté pour cette sortie.",
    noTrack: "Pas de tracé GPS : saisie à la main, ou sur tapis.",
  },
  en: {
    back: "History",
    distance: "Distance",
    time: "Time",
    pace: "Pace",
    speed: "Speed",
    climb: "Climb",
    descent: "Descent",
    effortKm: "Effort km",
    gap: "Grade-adjusted",
    splits: "Kilometre by kilometre",
    splitsMiles: "Mile by mile",
    laps: "Laps",
    lap: (n: number) => `Lap ${n}`,
    finish: "Finish",
    altitude: "Altitude",
    paceAlong: "Pace along the way",
    low: "Min",
    high: "Max",
    slowest: "Slowest",
    fastest: "Fastest",
    about: "The outing",
    session: "Session",
    felt: "Felt",
    shoes: "Shoes",
    weather: "Weather",
    cadence: "Cadence",
    cadenceUnit: "spm",
    heart: "Heart rate",
    heartLine: (avg: string, max: string) => `${avg} bpm on average · ${max} at the top`,
    zones: "Zones",
    note: "Note",
    nothing: "Nothing else was noted for this outing.",
    noTrack: "No GPS track: entered by hand, or on a treadmill.",
  },
});

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function sessionLabel(id: string | null): string | null {
  if (!id) return null;
  const known = sessionById(id);
  if (known) return sessionName(known);
  const kind = sessionKind(id);
  return kind ? kindName(kind) : null;
}

export function OutingScreen({ outing }: { outing: OutingDetail }) {
  const s = useStrings(strings);
  const riding = outing.activity === "ride";
  const running = sportOf(outing.activity) === "running";
  const points = outing.points;
  const hasTrack = points.length > 1;

  const graded = running && hasTrack ? gradeAdjustedPace(points, outing.durationS) : null;
  // As on the phone: the way down and the climb's worth in distance, where the hills were real.
  const hilly = running && hasTrack && (outing.elevationGainM ?? 0) >= 20;
  const hillFigures = hilly
    ? [
      { label: s.descent, value: formatElevation(elevationChangeM(points).lossM), unit: elevationUnit() },
      { label: s.effortKm, value: decimal(effortKm(outing.distanceM, outing.elevationGainM ?? 0).toFixed(1)), unit: "km" },
    ]
    : [];
  const figures = [
    { label: s.time, value: formatDuration(outing.durationS) },
    riding
      ? { label: s.speed, value: formatSpeed(outing.durationS > 0 ? outing.distanceM / outing.durationS : 0), unit: speedUnit() }
      : { label: s.pace, value: formatPace(outing.avgPaceSKm), unit: paceUnit() },
    { label: s.climb, value: formatElevation(outing.elevationGainM ?? 0), unit: elevationUnit() },
    ...hillFigures,
    ...(graded && outing.avgPaceSKm && Math.abs(graded - outing.avgPaceSKm) >= 3
      ? [{ label: s.gap, value: formatPace(graded), unit: paceUnit() }]
      : []),
  ];

  const kmSplits = hasTrack && !riding ? splits(points, unitLengthM()) : [];
  const fullSplits = kmSplits.filter((split) => !split.partial);
  const slowest = Math.max(1, ...kmSplits.map((split) => split.durationS / Math.max(split.distanceM / unitLengthM(), 0.01)));
  const laps = lapsOf(outing.laps, outing.distanceM, outing.durationS);
  const altitude = hasTrack ? elevationProfile(points) : [];
  const paces = hasTrack && !riding ? paceSeries(points) : [];

  const date = capitalised(new Date(outing.startedAt).toLocaleString(intlLocale(), {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }));
  const session = sessionLabel(outing.sessionId);
  const about: { label: string; value: string }[] = [
    session ? { label: s.session, value: session } : null,
    outing.exertion ? { label: s.felt, value: exertionName(outing.exertion) } : null,
    outing.shoeName ? { label: s.shoes, value: outing.shoeName } : null,
    outing.weather ? { label: s.weather, value: [weatherLabel(outing.weather.code), weatherLine(outing.weather)].filter(Boolean).join(" · ") } : null,
    outing.cadenceSpm ? { label: s.cadence, value: `${Math.round(outing.cadenceSpm)} ${s.cadenceUnit}` } : null,
    outing.heart ? { label: s.heart, value: s.heartLine(formatBpm(outing.heart.avgBpm), formatBpm(outing.heart.maxBpm)) } : null,
  ].filter((entry): entry is { label: string; value: string } => entry !== null);

  return (
    <div className="page">
      <Link href="/history" className="back"><IoChevronBack aria-hidden />{s.back}</Link>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1>
            {outingName(outing)}
            {outing.activity !== "run" ? <span className="tag" style={{ fontSize: 14 }}>{activityName(outing.activity)}</span> : null}
          </h1>
          <p className="subtitle">{date}</p>
        </div>
      </div>

      <SummaryBanner big label={s.distance} value={formatDistance(outing.distanceM)} unit={distanceUnit()} figures={figures} />

      <div className="grid-main" style={{ marginTop: 16 }}>
        <div>
          {hasTrack ? <TrackMap line={points} /> : <div className="panel padded"><p className="note" style={{ margin: 0 }}>{s.noTrack}</p></div>}
          {altitude.length > 1 ? (
            <>
              <SectionHeader title={s.altitude} />
              <div className="panel padded">
                <LineChart
                  label={s.altitude}
                  series={altitude.map((p) => ({ distanceM: p.distanceM, value: p.altitudeM }))}
                  format={(v) => `${Math.round(toElevationUnits(v))} ${elevationUnit()}`}
                  lowLabel={s.low}
                  highLabel={s.high}
                />
              </div>
            </>
          ) : null}
          {paces.length > 1 ? (
            <>
              <SectionHeader title={s.paceAlong} />
              <div className="panel padded">
                <LineChart
                  label={s.paceAlong}
                  series={paces}
                  invert
                  format={(v) => `${formatPace(v)}${paceUnit()}`}
                  lowLabel={s.slowest}
                  highLabel={s.fastest}
                />
              </div>
            </>
          ) : null}
        </div>

        <div>
          <SectionHeader title={s.about} />
          <div className="panel">
            {about.length > 0 ? (
              <ul className="rows">
                {about.map((entry) => (
                  <li key={entry.label} className="row" style={{ minHeight: 56, display: "block" }}>
                    <span className="figure-label" style={{ display: "block" }}>{entry.label}</span>
                    <span style={{ fontSize: 17, fontWeight: 600 }}>{entry.value}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="note" style={{ margin: "12px 0" }}>{s.nothing}</p>}
          </div>
          {outing.heart && outing.heart.zonesS.length > 0 ? (
            <>
              <SectionHeader title={s.zones} />
              <div className="panel padded bars">
                {outing.heart.zonesS.map((seconds, zone) => {
                  const total = outing.heart!.zonesS.reduce((sum, value) => sum + value, 0) || 1;
                  return (
                    <div key={zone} className="bar-row" style={{ gridTemplateColumns: "110px 1fr 64px" }}>
                      <span className="km">{zoneName(zone)}</span>
                      <span className="bar"><span style={{ width: `${(seconds / total) * 100}%` }} /></span>
                      <span className="time">{formatDuration(seconds)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
          {outing.note ? (
            <>
              <SectionHeader title={s.note} />
              <div className="panel padded"><p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--muted)" }}>{outing.note}</p></div>
            </>
          ) : null}
          {kmSplits.length > 0 ? (
            <>
              <SectionHeader
                title={unitLengthM() === 1000 ? s.splits : s.splitsMiles}
                aside={fullSplits.length > 0 ? `${s.fastest} ${formatPace(Math.min(...fullSplits.map((split) => split.durationS)) * (1000 / unitLengthM()))}${paceUnit()}` : undefined}
              />
              <div className="panel padded bars">
                {kmSplits.map((split) => {
                  const perUnit = split.durationS / Math.max(split.distanceM / unitLengthM(), 0.01);
                  return (
                    <div key={split.km} className="bar-row">
                      <span className="km">{split.partial ? formatDistance(split.distanceM) : split.km}</span>
                      <span className="bar"><span style={{ width: `${Math.max(8, (1 - (perUnit / slowest) * 0.7) * 100)}%` }} /></span>
                      <span className="time">{formatPace((perUnit * 1000) / unitLengthM())}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
          {laps.length > 0 ? (
            <>
              <SectionHeader title={s.laps} />
              <div className="panel">
                <ul className="rows">
                  {laps.map((lap) => (
                    <li key={lap.number} className="row" style={{ minHeight: 52 }}>
                      <span className="row-main"><span className="row-name">{lap.partial ? s.finish : s.lap(lap.number)}</span></span>
                      <span className="row-figures num">
                        <strong>{formatDistance(lap.distanceM)}</strong><span className="unit">{distanceUnit()}</span>
                        <span className="row-detail" style={{ display: "block" }}>
                          {formatDuration(lap.durationS)} · {lap.paceSKm ? `${formatPace(lap.paceSKm)}${paceUnit()}` : "–"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

