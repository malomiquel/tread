"use client";

import { useState } from "react";
import { IoCloudUploadOutline, IoPhonePortraitOutline } from "react-icons/io5";
import { activityName, countedSport, heldTypes, ofSport, type ActivityType } from "@tread/core/activity";
import { markScale, monthWeeks, monthsSince, runsByDay } from "@tread/core/calendar";
import { formatDistance, formatDuration } from "@tread/core/format";
import { defineStrings, intlLocale, plural, useStrings } from "@tread/core/i18n";
import { byMonth, monthSummary, weekStart } from "@tread/core/stats";
import { distanceUnit } from "@tread/core/units";
import { ChoiceMenu, Segmented } from "@/components/ChoiceMenu";
import { EmptyState } from "@/components/EmptyState";
import { NoMatch } from "@/components/NoMatch";
import { OutingRow } from "@/components/OutingRow";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { BannerTag, SummaryBanner } from "@/components/SummaryBanner";
import type { OutingRow as Row } from "@/lib/types";

const strings = defineStrings({
  fr: {
    title: "Historique",
    summary: (count: number, km: string) => `${plural(count, "course", "courses")} · ${km} ${distanceUnit()} au total`,
    rides: (count: number) => ` · ${plural(count, "sortie vélo", "sorties vélo")}`,
    thisMonth: "Ce mois-ci",
    thisMonthRides: "Ce mois-ci à vélo",
    monthRuns: (count: number, time: string) => `${plural(count, "course", "courses")} · ${time}`,
    monthRides: (count: number, time: string) => `${plural(count, "sortie", "sorties")} · ${time}`,
    nothingYet: "Pas encore de sortie ce mois-ci",
    lastMonth: (month: string, km: string) => `${month} : ${km} ${distanceUnit()}`,
    monthTotal: (km: string, count: number) => `${km} ${distanceUnit()} · ${count}`,
    allOutings: "Toutes les sorties",
    whichOutings: "Quelles sorties",
    noMatch: (type: string) => `Aucune sortie « ${type} » pour l'instant.`,
    list: "Liste",
    calendar: "Calendrier",
    view: "Affichage",
    days: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
    connect: "Connecter l'app",
    connectDetail: "Connecte-toi avec ce compte dans Tread, Réglages, et tes sorties arrivent ici.",
    upload: "Importer une copie",
    uploadDetail: "La copie de sécurité de l'app, ou tes fichiers GPX d'une autre montre.",
    note: "Rien n'est enregistré dans le navigateur : on court avec le téléphone.",
  },
  en: {
    title: "History",
    summary: (count: number, km: string) => `${plural(count, "run", "runs")} · ${km} ${distanceUnit()} in total`,
    rides: (count: number) => ` · ${plural(count, "ride", "rides")}`,
    thisMonth: "This month",
    thisMonthRides: "Riding this month",
    monthRuns: (count: number, time: string) => `${plural(count, "run", "runs")} · ${time}`,
    monthRides: (count: number, time: string) => `${plural(count, "ride", "rides")} · ${time}`,
    nothingYet: "No outing this month yet",
    lastMonth: (month: string, km: string) => `${month}: ${km} ${distanceUnit()}`,
    monthTotal: (km: string, count: number) => `${km} ${distanceUnit()} · ${count}`,
    allOutings: "All outings",
    whichOutings: "Which outings",
    noMatch: (type: string) => `No “${type}” outing yet.`,
    list: "List",
    calendar: "Calendar",
    view: "View",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    connect: "Connect the app",
    connectDetail: "Sign in with this account in Tread, Settings, and your outings arrive here.",
    upload: "Import a copy",
    uploadDetail: "The app's safety copy, or GPX files from another watch.",
    note: "Nothing is recorded in the browser: running is done with the phone.",
  },
});

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const monthName = (start: number, withYear: boolean) =>
  capitalised(new Date(start).toLocaleDateString(intlLocale(), withYear ? { month: "long", year: "numeric" } : { month: "long" }));

export function HistoryScreen({ outings }: { outings: Row[] }) {
  const s = useStrings(strings);
  const [chosen, setChosen] = useState<ActivityType | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");

  const runs = ofSport(outings, "running");
  const rides = ofSport(outings, "cycling");
  const shown = chosen ? outings.filter((outing) => outing.activity === chosen) : outings;
  const sport = countedSport(chosen);
  const counted = ofSport(shown, sport);
  const types = heldTypes(outings, chosen);

  if (outings.length === 0) {
    return (
      <div className="page narrow">
        <PageHeader title={s.title} />
        <EmptyState
          actions={[
            { title: s.connect, detail: s.connectDetail, icon: <IoPhonePortraitOutline size={22} />, href: "/settings#phone", primary: true },
            { title: s.upload, detail: s.uploadDetail, icon: <IoCloudUploadOutline size={22} />, href: "/settings#import" },
          ]}
          note={s.note}
        />
      </div>
    );
  }

  // The month banner stays the runner's month, unless rides alone are shown.
  const month = monthSummary(sport === "cycling" ? rides : runs);
  const total = runs.reduce((sum, run) => sum + run.distanceM, 0);

  return (
    <div className="page narrow">
      <PageHeader
        title={s.title}
        subtitle={s.summary(runs.length, formatDistance(total)) + (rides.length > 0 ? s.rides(rides.length) : "")}
      />
      <SummaryBanner
        label={sport === "cycling" ? s.thisMonthRides : s.thisMonth}
        value={formatDistance(month.current.distanceM)}
        unit={distanceUnit()}
        detail={month.current.runs > 0
          ? (sport === "cycling" ? s.monthRides : s.monthRuns)(month.current.runs, formatDuration(month.current.durationS))
          : s.nothingYet}
        tags={month.previous.distanceM > 0
          ? <BannerTag>{s.lastMonth(monthName(month.previous.start, false), formatDistance(month.previous.distanceM))}</BannerTag>
          : null}
      />

      <div className="controls" style={{ marginTop: 16 }}>
        {types.length > 1 ? (
          <ChoiceMenu
            title={s.whichOutings}
            label={chosen ? activityName(chosen) : s.allOutings}
            on={chosen !== null}
            chosen={chosen}
            onChoose={setChosen}
            choices={[
              { value: null, label: s.allOutings, count: outings.length },
              ...types.map((type) => ({ value: type, label: activityName(type), count: outings.filter((o) => o.activity === type).length })),
            ]}
          />
        ) : <span />}
        <Segmented
          label={s.view}
          value={view}
          onChange={setView}
          options={[{ value: "list", label: s.list }, { value: "calendar", label: s.calendar }]}
        />
      </div>

      {shown.length === 0 && chosen ? (
        <NoMatch sentence={s.noMatch(activityName(chosen))} onShowAll={() => setChosen(null)} />
      ) : view === "list" ? (
        byMonth(shown).map((group) => {
          const summed = ofSport(group.runs, sport);
          return (
            <section key={group.key} aria-labelledby={`m-${group.key}`}>
              <SectionHeader
                id={`m-${group.key}`}
                sticky
                title={monthName(group.start, true)}
                aside={s.monthTotal(formatDistance(summed.reduce((sum, run) => sum + run.distanceM, 0)), summed.length)}
              />
              <div className="panel">
                <ul className="rows">
                  {group.runs.map((outing) => <li key={outing.id}><OutingRow outing={outing} /></li>)}
                </ul>
              </div>
            </section>
          );
        })
      ) : (
        <Calendar shown={shown} counted={counted} days={s.days} />
      )}
    </div>
  );
}

/**
 * Months of Monday-first weeks: a dot a day sized by distance, today outlined,
 * each week's total at the end of its row. A ride shown among runs is a ring
 * of fixed size: it is there, but sizes no dot and counts in no week.
 */
function Calendar({ shown, counted, days }: { shown: Row[]; counted: Row[]; days: string[] }) {
  const ids = new Map(shown.map((outing, index) => [index, outing]));
  const numbered = shown.map((outing, index) => ({ id: index, startedAt: outing.startedAt, distanceM: outing.distanceM }));
  const countedSet = new Set(counted);
  const byDay = runsByDay(numbered.filter((entry) => countedSet.has(ids.get(entry.id)!)));
  const others = runsByDay(numbered.filter((entry) => !countedSet.has(ids.get(entry.id)!)));
  const longest = Math.max(0, ...[...byDay.values()].map((day) => day.distanceM));
  const weekTotals = new Map<number, number>();
  for (const outing of counted) {
    const week = weekStart(outing.startedAt);
    weekTotals.set(week, (weekTotals.get(week) ?? 0) + outing.distanceM);
  }
  const now = Date.now();
  const today = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  const oldest = Math.min(...shown.map((outing) => outing.startedAt));

  return (
    <>
      {monthsSince(oldest, now).map(({ year, month }) => {
        const start = new Date(year, month, 1).getTime();
        return (
          <section key={`${year}-${month}`}>
            <SectionHeader title={monthName(start, true)} />
            <div className="panel padded">
              <div className="calendar">
                {days.map((day) => <div key={day} className="dow">{day}</div>)}
                <div />
                {monthWeeks(year, month).map((week) => [
                  ...week.days.map((day, index) => {
                    if (!day) return <div key={`${week.start}-${index}`} className="day" />;
                    const ran = byDay.get(day.start);
                    const other = others.get(day.start);
                    const size = ran ? 30 * markScale(ran.distanceM, longest) : 0;
                    return (
                      <div key={day.start} className={`day${day.start === today ? " today" : ""}`} title={ran ? `${formatDistance(ran.distanceM)} ${distanceUnit()}` : undefined}>
                        <span className="date">{day.date}</span>
                        {ran ? <span className="dot" style={{ width: size, height: size }} /> : null}
                        {other ? <span className="ring" /> : null}
                      </div>
                    );
                  }),
                  <div key={`${week.start}-total`} className="week-total">
                    {weekTotals.get(week.start) ? `${formatDistance(weekTotals.get(week.start)!)} ${distanceUnit()}` : ""}
                  </div>,
                ])}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
