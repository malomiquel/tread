"use client";

import { useMemo, useState } from "react";
import {
  IoAlbumsOutline, IoCalendarClearOutline, IoFlameOutline, IoFootstepsOutline, IoRibbonOutline, IoSpeedometerOutline,
  IoStopwatchOutline, IoTrendingUpOutline, IoTrophyOutline,
} from "react-icons/io5";
import { ofSport } from "@tread/core/activity";
import { EFFORT_KEYS, effortName } from "@tread/core/efforts";
import { formatDistance, formatDuration, formatElevation } from "@tread/core/format";
import { cardWords, type Card } from "@tread/core/card";
import { goalAmount, measure } from "@tread/core/goals";
import { defineStrings, intlLocale, plural, useStrings } from "@tread/core/i18n";
import { readPrivacyRadius } from "@tread/core/privacy";
import { goalName } from "@tread/core/plan";
import { effortSamples, predictRaces } from "@tread/core/predictions";
import { wearOf } from "@tread/core/shoes";
import { goalProgress, weekStreak, weekTotals, weeklyVolumeKm, yearToDate } from "@tread/core/stats";
import { distanceUnit, elevationUnit, paceUnit } from "@tread/core/units";
import { formatPace } from "@tread/core/format";
import { CardViewer } from "@/components/CardViewer";
import { Figures } from "@/components/Figures";
import { PageHeader } from "@/components/PageHeader";
import { RecordRow } from "@/components/RecordRow";
import { MiniCard, RunCard } from "@/components/RunCard";
import { SectionHeader } from "@/components/SectionHeader";
import { BannerTag, SummaryBanner } from "@/components/SummaryBanner";
import { dealAlbum, goalOf } from "@/lib/album";
import { outingName } from "@/lib/display";
import type { CardOuting, OutingFigures, ShoeRow } from "@/lib/types";

const strings = defineStrings({
  fr: {
    title: "Profil",
    week: "Cette semaine",
    runs: "Courses",
    time: "Temps",
    climb: "Dénivelé",
    goalLine: (percent: number, goal: string) => `${percent} % de ${goal}`,
    goalLeft: (left: string) => `encore ${left}`,
    goalReached: "Objectif atteint",
    noGoal: "Pas d'objectif de la semaine : fixe-le dans l'app.",
    collection: "Collection",
    allCards: "Toute la collection",
    allCardsDetail: (rare: number) => (rare > 0 ? `${plural(rare, "carte rare", "cartes rares")} et mieux` : "Grandes cartes, séries et règles"),
    card: (label: string) => `Carte : ${label}`,
    progress: "Progression",
    streak: "Semaines d'affilée",
    streakDetail: (best: number, goal: boolean) => `${goal ? "Objectif tenu" : "Au moins une course"} · record ${best}`,
    weeks: (n: number) => plural(n, "semaine", "semaines"),
    year: (year: number) => `Depuis le 1er janvier ${year}`,
    yearDetail: (last: string) => `L'an dernier à la même date : ${last} ${distanceUnit()}`,
    habit: "En moyenne",
    habitDetail: "Par semaine, sur les huit dernières",
    performance: "Records",
    longest: "Plus longue course",
    fastestKm: "Kilomètre le plus rapide",
    biggestClimb: "Plus gros dénivelé",
    efforts: "Meilleurs temps",
    predictions: "Temps prédits",
    predictionsEmpty: "Il faut une course rapide de 5 km ou plus dans les douze dernières semaines.",
    predictedFrom: (from: string) => `D'après ton ${from}`,
    allTime: "Depuis le début",
    total: "Distance",
    count: "Courses",
    hours: "Temps",
    shoes: "Chaussures",
    retired: "Retirée",
    worn: "À changer",
    soon: "Bientôt",
    shoeDetail: (km: string, limit: string) => `${km} sur ${limit} ${distanceUnit()}`,
    empty: "Les chiffres arrivent avec ta première course.",
  },
  en: {
    title: "Profile",
    week: "This week",
    runs: "Runs",
    time: "Time",
    climb: "Climb",
    goalLine: (percent: number, goal: string) => `${percent}% of ${goal}`,
    goalLeft: (left: string) => `${left} to go`,
    goalReached: "Goal reached",
    noGoal: "No weekly goal: set it in the app.",
    collection: "Collection",
    allCards: "The whole collection",
    allCardsDetail: (rare: number) => (rare > 0 ? `${plural(rare, "rare card", "rare cards")} and better` : "Great cards, sets and rules"),
    card: (label: string) => `Card: ${label}`,
    progress: "Progress",
    streak: "Weeks in a row",
    streakDetail: (best: number, goal: boolean) => `${goal ? "Goal met" : "At least one run"} · best ${best}`,
    weeks: (n: number) => plural(n, "week", "weeks"),
    year: (year: number) => `Since 1 January ${year}`,
    yearDetail: (last: string) => `Last year by this date: ${last} ${distanceUnit()}`,
    habit: "On average",
    habitDetail: "A week, over the last eight",
    performance: "Records",
    longest: "Longest run",
    fastestKm: "Fastest kilometre",
    biggestClimb: "Biggest climb",
    efforts: "Best efforts",
    predictions: "Predicted times",
    predictionsEmpty: "It takes a fast run of 5 km or more in the last twelve weeks.",
    predictedFrom: (from: string) => `From your ${from}`,
    allTime: "All time",
    total: "Distance",
    count: "Runs",
    hours: "Time",
    shoes: "Shoes",
    retired: "Retired",
    worn: "Replace",
    soon: "Soon",
    shoeDetail: (km: string, limit: string) => `${km} of ${limit} ${distanceUnit()}`,
    empty: "The figures arrive with your first run.",
  },
});

/** The newest cards shown under the week, before the whole collection. */
const NEWEST = 8;

const shortDate = (at: number) => new Date(at).toLocaleDateString(intlLocale(), { day: "numeric", month: "short", year: "numeric" });

export function ProfileScreen({ name, outings, cardOutings, shoes, settings }: {
  name: string;
  outings: OutingFigures[];
  /** The same outings as their cards read them. */
  cardOutings: CardOuting[];
  shoes: ShoeRow[];
  settings: Record<string, string>;
}) {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const now = Date.now();
  const album = useMemo(() => dealAlbum(cardOutings, goalOf(settings)), [cardOutings, settings]);
  const [held, setHeld] = useState<Card | null>(null);
  const heldOuting = held ? album.byNumber.get(held.runId)?.outing : undefined;
  const rareCards = album.newest.filter((card) => card.rarity === "rare" || card.rarity === "exceptional").length;
  // A runner's figures: rides count in none of them.
  const runs = ofSport(outings, "running");

  const week = weekTotals(runs, now);
  const goal = goalOf(settings);
  const covered = goal ? measure(goal.kind, { distanceM: week.distanceM, durationS: week.durationS, climbM: week.climbM }) : 0;
  const progress = goal ? goalProgress(covered, goal.target) : null;
  const streak = weekStreak(runs, goal, now);
  const ytd = yearToDate(runs, now);
  const habit = weeklyVolumeKm(runs, now);

  const longest = runs.reduce<OutingFigures | null>((best, run) => (!best || run.distanceM > best.distanceM ? run : best), null);
  const climbed = runs.reduce<OutingFigures | null>((best, run) => (!best || (run.elevationGainM ?? 0) > (best.elevationGainM ?? 0) ? run : best), null);
  const best = EFFORT_KEYS.flatMap((key) => {
    let found: { seconds: number; run: OutingFigures } | null = null;
    for (const run of runs) {
      const seconds = run.efforts?.[key];
      if (seconds && (!found || seconds < found.seconds)) found = { seconds, run };
    }
    return found ? [{ key, ...found }] : [];
  });
  const fastestKm = best.find((effort) => effort.key === "1000");
  const predictions = predictRaces(
    effortSamples(runs.map((run) => ({ startedAt: run.startedAt, bestEfforts: run.efforts }))),
    now,
    habit,
  );

  const totalM = runs.reduce((sum, run) => sum + run.distanceM, 0);
  const totalS = runs.reduce((sum, run) => sum + run.durationS, 0);
  const totalClimb = runs.reduce((sum, run) => sum + (run.elevationGainM ?? 0), 0);

  return (
    <div className="page">
      <PageHeader title={s.title} subtitle={name} />
      <SummaryBanner
        label={s.week}
        value={formatDistance(week.distanceM)}
        unit={distanceUnit()}
        detail={goal && progress
          ? progress.reached ? s.goalReached : `${s.goalLine(progress.percent, goalAmount(goal.kind, goal.target))} · ${s.goalLeft(goalAmount(goal.kind, goal.target - covered))}`
          : s.noGoal}
        figures={[
          { label: s.runs, value: String(week.runs) },
          { label: s.time, value: formatDuration(week.durationS) },
          { label: s.climb, value: formatElevation(week.climbM), unit: elevationUnit() },
        ]}
        progress={progress ? progress.share : null}
        tags={streak.current > 1 ? <BannerTag>{s.weeks(streak.current)}</BannerTag> : null}
      />

      {runs.length === 0 ? <p className="note">{s.empty}</p> : (
        <>
          <SectionHeader title={s.collection} aside={String(album.newest.length)} />
          <div className="card-row" style={{ marginBottom: 10 }}>
            {album.newest.slice(0, NEWEST).map((card) => {
              const run = album.byNumber.get(card.runId);
              return run ? <MiniCard key={card.runId} card={card} outing={run.outing} onOpen={() => setHeld(card)} /> : null;
            })}
          </div>
          <div className="panel">
            <RecordRow icon={<IoAlbumsOutline size={19} />} name={s.allCards} detail={s.allCardsDetail(rareCards)} value="" href="/collection" />
          </div>

          <div className="grid-2">
            <section>
              <SectionHeader title={s.progress} />
              <div className="panel">
                <RecordRow icon={<IoFlameOutline size={19} />} name={s.streak} detail={s.streakDetail(streak.best, streak.kind === "goal")} value={String(streak.current)} />
                <RecordRow icon={<IoCalendarClearOutline size={19} />} name={s.year(ytd.year)} detail={s.yearDetail(formatDistance(ytd.lastYear.distanceM))} value={formatDistance(ytd.thisYear.distanceM)} unit={distanceUnit()} />
                {habit !== null ? <RecordRow icon={<IoTrendingUpOutline size={19} />} name={s.habit} detail={s.habitDetail} value={formatDistance(habit * 1000)} unit={distanceUnit()} /> : null}
              </div>

              <SectionHeader title={s.performance} />
              <div className="panel">
                {longest ? <RecordRow icon={<IoTrophyOutline size={19} />} name={s.longest} detail={`${outingName(longest)} · ${shortDate(longest.startedAt)}`} value={formatDistance(longest.distanceM)} unit={distanceUnit()} href={`/outings/${longest.id}`} /> : null}
                {fastestKm ? <RecordRow icon={<IoSpeedometerOutline size={19} />} name={s.fastestKm} detail={`${outingName(fastestKm.run)} · ${shortDate(fastestKm.run.startedAt)}`} value={formatPace(fastestKm.seconds)} unit={paceUnit()} href={`/outings/${fastestKm.run.id}`} /> : null}
                {climbed && (climbed.elevationGainM ?? 0) > 0 ? <RecordRow icon={<IoTrendingUpOutline size={19} />} name={s.biggestClimb} detail={`${outingName(climbed)} · ${shortDate(climbed.startedAt)}`} value={formatElevation(climbed.elevationGainM ?? 0)} unit={elevationUnit()} href={`/outings/${climbed.id}`} /> : null}
              </div>
            </section>

            <section>
              <SectionHeader title={s.efforts} />
              <div className="panel">
                {best.map((effort) => (
                  <RecordRow
                    key={effort.key}
                    icon={<IoStopwatchOutline size={19} />}
                    name={effortName(effort.key)}
                    detail={`${outingName(effort.run)} · ${shortDate(effort.run.startedAt)}`}
                    value={formatDuration(effort.seconds)}
                    href={`/outings/${effort.run.id}`}
                  />
                ))}
              </div>

              <SectionHeader title={s.predictions} />
              <div className="panel">
                {predictions.length === 0 ? <p className="note" style={{ margin: "12px 0" }}>{s.predictionsEmpty}</p> : predictions.map((prediction) => (
                  <RecordRow
                    key={prediction.goal}
                    icon={<IoRibbonOutline size={19} />}
                    name={goalName(prediction.goal)}
                    detail={`${formatPace(prediction.paceSKm)}${paceUnit()} · ${s.predictedFrom(effortName(prediction.from.key))}`}
                    value={formatDuration(prediction.timeS)}
                  />
                ))}
              </div>
            </section>
          </div>

          <SectionHeader title={s.allTime} />
          <div className="panel padded">
            <Figures tone="page" figures={[
              { label: s.count, value: String(runs.length) },
              { label: s.total, value: formatDistance(totalM), unit: distanceUnit() },
              { label: s.hours, value: formatDuration(totalS) },
              { label: s.climb, value: formatElevation(totalClimb), unit: elevationUnit() },
            ]} />
          </div>
        </>
      )}

      {shoes.length > 0 ? (
        <>
          <SectionHeader title={s.shoes} />
          <div className="panel">
            {shoes.map((shoe) => {
              const distanceM = shoe.startM + runs.filter((run) => run.shoeRef === shoe.ref).reduce((sum, run) => sum + run.distanceM, 0);
              const { share, wear } = wearOf({ distanceM, limitM: shoe.limitM });
              return (
                <div key={shoe.ref} className="row">
                  <span className="tile"><IoFootstepsOutline size={19} aria-hidden /></span>
                  <span className="row-main">
                    <span className="row-name" style={{ display: "block" }}>
                      {shoe.name}
                      {shoe.retired ? <span className="tag">{s.retired}</span> : wear !== "fresh" ? <span className="tag warning">{wear === "worn" ? s.worn : s.soon}</span> : null}
                    </span>
                    <span className="row-detail" style={{ display: "block" }}>{s.shoeDetail(formatDistance(distanceM), formatDistance(shoe.limitM))}</span>
                  </span>
                  <span className="row-figures" style={{ width: 120 }}>
                    <span className="bar-row" style={{ display: "block" }}>
                      <span className="bar" style={{ display: "block" }}>
                        <span style={{ width: `${Math.min(1, share) * 100}%`, background: wear === "fresh" ? "var(--accent)" : "var(--warning)" }} />
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <CardViewer
        open={held !== null && heldOuting !== undefined}
        onClose={() => setHeld(null)}
        href={heldOuting ? `/outings/${heldOuting.id}` : undefined}
        label={held && heldOuting ? s.card(`${words.number(held.number)}, ${words.rarity[held.rarity]}, ${outingName(heldOuting)}`) : ""}
      >
        {held && heldOuting ? <RunCard card={held} outing={heldOuting} privacyRadiusM={readPrivacyRadius(settings.privacyRadiusM)} /> : null}
      </CardViewer>
    </div>
  );
}
