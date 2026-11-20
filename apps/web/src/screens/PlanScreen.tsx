"use client";

import { IoCheckmarkCircle, IoEllipseOutline, IoFlagOutline, IoPhonePortraitOutline, IoRemoveCircleOutline } from "react-icons/io5";
import { formatDuration } from "@tread/core/format";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import {
  goalName, kindName, nextSession, phaseName, planProgress, ranCount, schedule, sessionTargetName, startOfDay,
  type Done, type ScheduledSession,
} from "@tread/core/plan";
import { sessionMinutes, sessionName } from "@tread/core/workout";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { SummaryBanner } from "@/components/SummaryBanner";
import type { PlanData } from "@/lib/types";

const strings = defineStrings({
  fr: {
    title: "Plan",
    subtitle: (race: string, date: string) => `${race} · ${date}`,
    next: "Prochaine séance",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    raceDay: "Le jour de la course",
    done: "Programme terminé",
    doneDetail: "Toutes les séances sont derrière toi.",
    daysLeft: "Avant la course",
    dayUnit: (n: number): string => (n > 1 ? "jours" : "jour"),
    sessions: "Séances faites",
    target: "Objectif",
    finish: "Finir",
    week: (n: number, phase: string) => `Semaine ${n} · ${phase}`,
    minutes: (n: number) => `${n} min`,
    ran: "Faite",
    skipped: "Passée",
    pending: "À faire",
    emptyTitle: "Crée ton programme dans l'app",
    emptyDetail: "Choisis ta course dans Tread, onglet Plan : il apparaît ici à la synchro suivante.",
    note: "Le programme se règle sur le téléphone, qui sait ce que tu as couru.",
  },
  en: {
    title: "Plan",
    subtitle: (race: string, date: string) => `${race} · ${date}`,
    next: "Next session",
    today: "Today",
    tomorrow: "Tomorrow",
    raceDay: "Race day",
    done: "Plan complete",
    doneDetail: "Every session is behind you.",
    daysLeft: "To race day",
    dayUnit: (n: number): string => (n === 1 ? "day" : "days"),
    sessions: "Sessions done",
    target: "Target",
    finish: "Finish",
    week: (n: number, phase: string) => `Week ${n} · ${phase}`,
    minutes: (n: number) => `${n} min`,
    ran: "Done",
    skipped: "Skipped",
    pending: "To do",
    emptyTitle: "Create your plan in the app",
    emptyDetail: "Pick your race in Tread, Plan tab: it shows here at the next sync.",
    note: "The plan is set on the phone, which knows what you ran.",
  },
});

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function PlanScreen({ plan }: { plan: PlanData | null }) {
  const s = useStrings(strings);

  if (!plan) {
    return (
      <div className="page narrow">
        <PageHeader title={s.title} />
        <EmptyState
          actions={[{ title: s.emptyTitle, detail: s.emptyDetail, icon: <IoPhonePortraitOutline size={22} />, href: "/settings#phone", primary: true }]}
          note={s.note}
        />
      </div>
    );
  }

  const today = startOfDay(Date.now());
  const done = new Map<number, Done>(plan.done.map((entry) => [entry.order, { runId: entry.runId, at: entry.at }]));
  const scheduled = schedule(plan.sessions, done, today, plan.raceAt, plan.days);
  const next = nextSession(scheduled);
  const ran = ranCount(done);
  const day = (at: number) => capitalised(new Date(at).toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long" }));
  const when = (at: number) => (at === today ? s.today : at === today + 86_400_000 ? s.tomorrow : day(at));
  const daysLeft = Math.max(0, Math.round((startOfDay(plan.raceAt) - today) / 86_400_000));

  const weeks = new Map<number, ScheduledSession[]>();
  for (const session of scheduled) weeks.set(session.week, [...(weeks.get(session.week) ?? []), session]);

  // A trail run to finish has no time: zero is stored, and "Finish" shown.
  const goalTime = plan.targetTimeS > 0 ? formatDuration(plan.targetTimeS) : s.finish;

  return (
    <div className="page narrow">
      <PageHeader title={s.title} subtitle={s.subtitle(goalName(plan.goal), day(plan.raceAt))} />
      <SummaryBanner
        label={next ? s.next : s.done}
        value={next ? (next.kind === "race" ? goalName(plan.goal) : sessionName(next.session)) : `${ran}/${plan.sessions.length}`}
        detail={next
          ? `${next.kind === "race" ? s.raceDay : when(next.at)} · ${next.kind === "race" ? goalTime : sessionTargetName(next.session, next.targetSKm)}`
          : s.doneDetail}
        figures={[
          { label: s.daysLeft, value: String(daysLeft), unit: s.dayUnit(daysLeft) },
          { label: s.sessions, value: `${ran}/${plan.sessions.length}` },
          { label: s.target, value: goalTime },
        ]}
        progress={planProgress(plan.sessions, ran)}
      />

      {[...weeks.entries()].map(([week, sessions]) => (
        <section key={week}>
          <SectionHeader title={s.week(week, phaseName(sessions[0].phase))} />
          <div className="panel">
            <ul className="rows">
              {sessions.map((session) => {
                const race = session.kind === "race";
                const state = session.settled ? (session.runId !== null ? s.ran : s.skipped) : s.pending;
                const Icon = race ? IoFlagOutline : session.settled ? (session.runId !== null ? IoCheckmarkCircle : IoRemoveCircleOutline) : IoEllipseOutline;
                const upcoming = next?.order === session.order;
                return (
                  <li key={session.order} className="row" aria-current={upcoming ? "step" : undefined}>
                    <span className="tile" style={{ color: session.settled && session.runId !== null ? "var(--accent)" : undefined }}>
                      <Icon size={20} aria-label={state} />
                    </span>
                    <span className="row-main">
                      <span className="row-name" style={{ display: "block" }}>
                        {race ? goalName(plan.goal) : sessionName(session.session)}
                        {upcoming ? <span className="tag">{s.next}</span> : null}
                      </span>
                      <span className="row-detail" style={{ display: "block" }}>
                        {when(session.at)} · {kindName(session.kind)}
                      </span>
                    </span>
                    <span className="row-figures">
                      <strong>{race ? goalTime : s.minutes(sessionMinutes(session.session))}</strong>
                      <span className="row-detail" style={{ display: "block" }}>{race ? s.target : sessionTargetName(session.session, session.targetSKm)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
