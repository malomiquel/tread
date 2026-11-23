"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoCalendarOutline, IoChevronBack, IoRemoveOutline, IoRepeatOutline, IoTrendingDown, IoTrendingUp,
} from "react-icons/io5";
import { repeatProfile } from "@tread/core/elevation";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@tread/core/format";
import { distanceM } from "@tread/core/geo";
import { decimal, defineStrings, intlLocale, plural, useStrings } from "@tread/core/i18n";
import { daysUntil, goalVerdict, heatCost, racePlan, type GoalVerdict } from "@tread/core/raceDay";
import { MOST_LAPS } from "@tread/core/route";
import { estimateRouteTime, type RouteRun } from "@tread/core/routeTime";
import { weatherRequest } from "@tread/core/services";
import { distanceUnit, elevationUnit, paceUnit, toDistanceUnits, unitLengthM } from "@tread/core/units";
import { forecastQuery, readHourly, weatherLabel, weatherLine, type Weather } from "@tread/core/weather";
import { LineChart } from "@/components/LineChart";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { SummaryBanner } from "@/components/SummaryBanner";
import { useElevation } from "@/hooks/useElevation";
import { routeLengthM } from "@/lib/route";
import type { RouteRow } from "@/lib/types";

const strings = defineStrings({
  fr: {
    title: "Plan de course",
    goal: "Objectif",
    pace: "Allure moy.",
    distance: "Distance",
    gain: "D+",
    faster: "Plus rapide de 15 secondes",
    slower: "Plus lent de 15 secondes",
    estimate: (time: string, low: string, high: string) => `D'après tes sorties : ${time} (${low} à ${high})`,
    noEstimate: "Pas assez de sorties récentes pour estimer ton temps.",
    verdict: {
      ambitious: "Ambitieux : plus vite que tes meilleurs jours récents.",
      realistic: "Réaliste : dans ce que tu cours en ce moment.",
      cautious: "Prudent : tu cours plus vite que ça en ce moment.",
    } satisfies Record<GoalVerdict, string>,
    lede: "Ton temps réparti sur le parcours, pour un effort régulier : plus lent dans les montées, un peu plus vite ailleurs. Le téléphone suit ce plan pendant la course.",
    raceDay: "Jour de course",
    laps: "Tours de la boucle",
    fewer: "Un tour de moins",
    more: "Un tour de plus",
    clearDate: "Retirer la date",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    inDays: (days: number) => `Dans ${plural(days, "jour", "jours")}`,
    noDateFooter: "Avec une date, la course apparaît dans tes courses à venir et reçoit sa météo seize jours avant.",
    forecastLater: "La météo du départ arrivera seize jours avant la course.",
    forecast: (line: string) => `Prévu au départ : ${line}.`,
    heat: (extra: string) => `Avec cette chaleur, compte environ ${extra} de plus sur ton objectif.`,
    profile: "Profil",
    low: "Min",
    high: "Max",
    climbs: "Montées",
    climb: (length: string, grade: string) => `${length} à ${grade}`,
    climbFrom: (at: string) => `à partir du ${at}`,
    splits: "Allure par kilomètre",
    splitsMile: "Allure par mile",
    split: (n: number) => `Km ${n}`,
    splitMile: (n: number) => `Mile ${n}`,
    splitDetail: (grade: string, at: string) => `${grade} · passage ${at}`,
    flat: "plat",
    saveFailed: "Le plan n'a pas pu être enregistré. Réessaie.",
  },
  en: {
    title: "Race plan",
    goal: "Goal",
    pace: "Avg pace",
    distance: "Distance",
    gain: "Gain",
    faster: "Faster by 15 seconds",
    slower: "Slower by 15 seconds",
    estimate: (time: string, low: string, high: string) => `From your runs: ${time} (${low} to ${high})`,
    noEstimate: "Not enough recent runs to estimate your time.",
    verdict: {
      ambitious: "Ambitious: faster than your best recent days.",
      realistic: "Realistic: within what you are running now.",
      cautious: "Cautious: you are running faster than that now.",
    },
    lede: "Your time spread over the course for an even effort: slower on the climbs, a little quicker elsewhere. The phone follows this plan during the race.",
    raceDay: "Race day",
    laps: "Laps of the loop",
    fewer: "One lap fewer",
    more: "One lap more",
    clearDate: "Remove the date",
    today: "Today",
    tomorrow: "Tomorrow",
    inDays: (days: number) => `In ${plural(days, "day", "days")}`,
    noDateFooter: "With a date, the race shows among your upcoming races and gets its weather sixteen days ahead.",
    forecastLater: "The weather for the start will come sixteen days before the race.",
    forecast: (line: string) => `Forecast for the start: ${line}.`,
    heat: (extra: string) => `In this heat, allow about ${extra} more than your goal.`,
    profile: "Profile",
    low: "Min",
    high: "Max",
    climbs: "Climbs",
    climb: (length: string, grade: string) => `${length} at ${grade}`,
    climbFrom: (at: string) => `from ${at}`,
    splits: "Pace per kilometre",
    splitsMile: "Pace per mile",
    split: (n: number) => `Km ${n}`,
    splitMile: (n: number) => `Mile ${n}`,
    splitDetail: (grade: string, at: string) => `${grade} · at ${at}`,
    flat: "flat",
    saveFailed: "The plan couldn't be saved. Try again.",
  },
});

const GOAL_STEP_S = 15;
const roundTo = (seconds: number, step: number) => Math.round(seconds / step) * step;
const percent = (grade: number) => `${grade > 0 ? "+" : ""}${decimal((grade * 100).toFixed(1))} %`;
/** A line that comes back within 50 m of its start, as the phone judges a loop. */
const isLoopLine = (line: RouteRow["line"]) => line.length > 2 && distanceM(line[0], line[line.length - 1]) < 50;

/** "2026-04-12T09:00" for a date field, in the runner's own time. */
function toLocalInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The date a race is on, as a short line: "dim. 12 avr., 09:00". */
export function raceWhen(at: number): string {
  return new Date(at).toLocaleString(intlLocale(), {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * A race on a route, as on the phone: the goal and what recent outings say
 * of it, the day and its forecast, the laps of a loop, then the pace for
 * every kilometre. Every change is kept at once and reaches the phone at
 * its next sync.
 */
export function RaceScreen({ route, recent }: { route: RouteRow; recent: RouteRun[] }) {
  const s = useStrings(strings);
  const elevation = useElevation(route.line, 0);
  const loop = isLoopLine(route.line);
  const lapM = routeLengthM(route.line);

  const [laps, setLaps] = useState(loop ? route.race?.laps ?? 1 : 1);
  const [date, setDate] = useState<number | null>(route.race?.date ?? null);
  const [goalS, setGoalS] = useState<number | null>(route.race?.goalS ?? null);
  const [forecast, setForecast] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);

  const totalM = lapM * laps;
  const estimate = useMemo(
    () => (elevation ? estimateRouteTime(recent, totalM, elevation.gainM * laps) : null),
    [recent, totalM, elevation, laps],
  );
  // A first goal from the runner's own form, once there is one to take.
  const goal = goalS ?? (estimate ? roundTo(estimate.timeS, GOAL_STEP_S) : roundTo(totalM * 0.33, GOAL_STEP_S));

  /** Kept as soon as changed; the answer to the last change is the one shown. */
  const saving = useRef(0);
  function save(change: { goalS?: number; date?: number | null; laps?: number }) {
    const next = { goalS: goal, date, laps, ...change };
    const ticket = ++saving.current;
    void fetch(`/api/routes/${route.id}/race`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((response) => {
        if (ticket === saving.current) setFailed(!response.ok);
      })
      .catch(() => {
        if (ticket === saving.current) setFailed(true);
      });
  }

  const changeGoal = (by: number) => {
    const next = Math.max(GOAL_STEP_S * 8, goal + by);
    setGoalS(next);
    save({ goalS: next });
  };
  // Another lap changes the race, not the runner: the time per lap is kept.
  const changeLaps = (by: number) => {
    const next = Math.max(1, Math.min(MOST_LAPS, laps + by));
    if (next === laps) return;
    const nextGoal = roundTo((goal * next) / laps, GOAL_STEP_S);
    setLaps(next);
    setGoalS(nextGoal);
    save({ laps: next, goalS: nextGoal });
  };
  const changeDate = (next: number | null) => {
    setDate(next);
    save({ date: next });
  };

  // The forecast for the start, once the race is within its reach.
  useEffect(() => {
    setForecast(null);
    const start = route.line[0];
    if (date === null || !start || date - Date.now() > 16 * 86_400_000 || date < Date.now() - 3_600_000) return;
    let live = true;
    fetch(weatherRequest(forecastQuery(start.lat, start.lng)))
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (live && payload) setForecast(readHourly(payload, date));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [route.line, date]);

  const unitM = unitLengthM();
  const metric = unitM === 1000;
  const plan = useMemo(
    () => racePlan(totalM, goal, elevation ? repeatProfile(elevation.profile, laps) : null, unitM),
    [totalM, goal, elevation, laps, unitM],
  );
  const verdict = goalVerdict(goal, estimate);
  const days = date === null ? null : daysUntil(date, Date.now());
  const countdown = days === null ? undefined : days <= 0 ? s.today : days === 1 ? s.tomorrow : s.inDays(days);
  const extraS = forecast ? Math.round((goal * heatCost(forecast.feelsLikeC)) / 5) * 5 : 0;
  const dateFooter = date === null
    ? s.noDateFooter
    : forecast
      ? [
        s.forecast([weatherLabel(forecast.code), weatherLine(forecast)].filter(Boolean).join(" · ")),
        extraS >= 10 ? s.heat(formatDuration(extraS)) : null,
      ].filter(Boolean).join(" ")
      : s.forecastLater;

  return (
    <div className="page">
      <Link href={`/routes/${route.id}`} className="back"><IoChevronBack aria-hidden />{route.name}</Link>
      <div className="page-head">
        <div>
          <h1>{s.title}</h1>
          <p className="subtitle">{route.name}</p>
        </div>
      </div>

      <SummaryBanner
        label={s.goal}
        value={formatDuration(goal)}
        detail={countdown}
        figures={[
          { label: s.pace, value: formatPace(goal / (totalM / 1000)), unit: paceUnit() },
          { label: s.distance, value: formatDistance(totalM), unit: distanceUnit() },
          { label: s.gain, value: elevation ? formatElevation(elevation.gainM * laps) : "–", unit: elevationUnit() },
        ]}
      />

      <div className="grid-main" style={{ marginTop: 16 }}>
        <div>
          <div className="panel padded race-goal">
            <button type="button" className="stepper-button press" aria-label={s.faster} onClick={() => changeGoal(-GOAL_STEP_S)}>−</button>
            <div className="race-goal-value">
              <strong className="num">{formatDuration(goal)}</strong>
              <span>
                {estimate
                  ? s.estimate(formatDuration(estimate.timeS), formatDuration(estimate.lowS), formatDuration(estimate.highS))
                  : s.noEstimate}
              </span>
            </div>
            <button type="button" className="stepper-button press" aria-label={s.slower} onClick={() => changeGoal(GOAL_STEP_S)}>+</button>
          </div>
          {/* Room kept for the verdict, so the page does not jump as it appears. */}
          <p className={`race-verdict${verdict === "ambitious" ? " warn" : ""}`}>{verdict ? s.verdict[verdict] : " "}</p>
          {failed ? <p className="error">{s.saveFailed}</p> : null}
          <p className="page-lede">{s.lede}</p>

          <SectionHeader title={s.profile} />
          <div className="panel padded">
            <div className="profile-room" style={{ marginTop: 0 }}>
              {elevation ? (
                <LineChart
                  series={repeatProfile(elevation.profile, laps)}
                  format={(metres) => `${formatElevation(metres)} ${elevationUnit()}`}
                  lowLabel={s.low}
                  highLabel={s.high}
                  label={s.profile}
                />
              ) : null}
            </div>
          </div>

          <SectionHeader title={metric ? s.splits : s.splitsMile} />
          <div className="panel">
            <ul className="rows">
              {plan?.splits.map((split, index) => (
                <li key={split.fromM}>
                  <RecordRow
                    icon={split.grade >= 0.01 ? <IoTrendingUp /> : split.grade <= -0.01 ? <IoTrendingDown /> : <IoRemoveOutline />}
                    name={metric ? s.split(index + 1) : s.splitMile(index + 1)}
                    detail={s.splitDetail(Math.abs(split.grade) < 0.005 ? s.flat : percent(split.grade), formatDuration(split.atS))}
                    value={formatPace(split.paceSKm)}
                    unit={paceUnit()}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <SectionHeader title={s.raceDay} />
          <div className="settings-group">
            <label className="setting">
              <span className="icon"><IoCalendarOutline size={19} aria-hidden /></span>
              <span className="setting-label">{s.raceDay}</span>
              <input
                type="datetime-local"
                className="race-date"
                value={date === null ? "" : toLocalInput(date)}
                min={`${toLocalInput(Date.now()).slice(0, 10)}T00:00`}
                onChange={(event) => {
                  const at = event.target.value ? new Date(event.target.value).getTime() : null;
                  if (at === null || Number.isFinite(at)) changeDate(at);
                }}
              />
            </label>
            {loop ? (
              <div className="setting">
                <span className="icon"><IoRepeatOutline size={19} aria-hidden /></span>
                <span className="setting-label">{s.laps}</span>
                <button type="button" className="stepper-button small press" aria-label={s.fewer} disabled={laps <= 1} onClick={() => changeLaps(-1)}>−</button>
                <span className="num race-laps">{laps} ×</span>
                <button type="button" className="stepper-button small press" aria-label={s.more} disabled={laps >= MOST_LAPS} onClick={() => changeLaps(1)}>+</button>
              </div>
            ) : null}
          </div>
          <p className="settings-footer">{dateFooter}</p>
          {date !== null ? (
            <p className="settings-footer">
              <button type="button" className="link-button danger-text" onClick={() => changeDate(null)}>{s.clearDate}</button>
            </p>
          ) : null}

          {plan && plan.climbs.length > 0 ? (
            <>
              <SectionHeader title={s.climbs} aside={String(plan.climbs.length)} />
              <div className="panel">
                <ul className="rows">
                  {plan.climbs.map((climb) => (
                    <li key={climb.fromM}>
                      <RecordRow
                        icon={<IoTrendingUp />}
                        name={s.climb(`${formatDistance(climb.toM - climb.fromM)} ${distanceUnit()}`, percent(climb.grade))}
                        detail={s.climbFrom(`${metric ? "km" : "mile"} ${decimal(toDistanceUnits(climb.fromM).toFixed(1))}`)}
                        value={`+${climb.costS}`}
                        unit="s"
                      />
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
