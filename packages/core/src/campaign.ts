import { defineStrings } from "./i18n.ts";
import { phaseName, type Kind, type Phase, type ScheduledSession } from "./plan.ts";
import { sessionMinutes } from "./workout.ts";

/**
 * A plan read as a campaign: its phases are chapters, its key sessions the
 * guardians of each chapter, and the race the last of them.
 *
 * Only a way of reading the plan the runner already has. It adds no session,
 * changes no date and asks for nothing more than the plan does. A session
 * passed over is passed, never failed: the chapter still opens on the next
 * one, the way the plan itself slides on.
 *
 * A guardian is what a coach would call the key session of a phase: its
 * longest long run, and its last session of quality (intervals or
 * threshold), the one that shows what the phase built.
 */

export type NodeState = "won" | "passed" | "next" | "ahead";

export interface CampaignNode {
  order: number;
  week: number;
  kind: Kind;
  at: number;
  guardian: boolean;
  /** The race: the end of the last chapter. */
  boss: boolean;
  state: NodeState;
  runId: number | null;
}

export type ChapterState = "cleared" | "done" | "current" | "ahead";

export interface Chapter {
  phase: Phase;
  /** 1-based. */
  index: number;
  weekFrom: number;
  weekTo: number;
  nodes: CampaignNode[];
  guardians: number;
  guardiansWon: number;
  /**
   * Cleared: every guardian beaten. Done: behind the runner with a guardian
   * passed over. Current: the chapter of the next session.
   */
  state: ChapterState;
}

export interface Campaign {
  chapters: Chapter[];
  guardians: number;
  guardiansWon: number;
  /** The chapter of the next session, or null once the race is behind. */
  current: Chapter | null;
}

const PHASES: readonly Phase[] = ["base", "build", "peak", "taper"];

/** The key sessions of one phase, by order. */
function guardiansOf(sessions: readonly ScheduledSession[]): Set<number> {
  const keys = new Set<number>();
  const longs = sessions.filter((session) => session.kind === "long");
  if (longs.length > 0) {
    const longest = longs.reduce((best, session) =>
      sessionMinutes(session.session) > sessionMinutes(best.session) ? session : best);
    keys.add(longest.order);
  }
  // The road's repetitions and threshold, and a trail's slope sessions.
  const quality = sessions.filter((session) => session.kind !== "long" && session.kind !== "easy" && session.kind !== "race");
  if (quality.length > 0) keys.add(quality[quality.length - 1].order);
  return keys;
}

/** Reads a schedule (as `schedule` lays it out) as a campaign. */
export function campaignOf(scheduled: readonly ScheduledSession[]): Campaign {
  const ordered = [...scheduled].sort((a, b) => a.order - b.order);
  const next = ordered.find((session) => !session.settled) ?? null;

  const chapters: Chapter[] = [];
  for (const phase of PHASES) {
    const sessions = ordered.filter((session) => session.phase === phase);
    if (sessions.length === 0) continue;
    const keys = guardiansOf(sessions.filter((session) => session.kind !== "race"));
    const nodes = sessions.map((session): CampaignNode => {
      const boss = session.kind === "race";
      const state: NodeState = session.settled
        ? (session.runId !== null ? "won" : "passed")
        : session.order === next?.order ? "next" : "ahead";
      return {
        order: session.order, week: session.week, kind: session.kind, at: session.at,
        guardian: keys.has(session.order) || boss, boss, state, runId: session.runId,
      };
    });
    const guardians = nodes.filter((node) => node.guardian);
    const guardiansWon = guardians.filter((node) => node.state === "won").length;
    const settled = nodes.every((node) => node.state === "won" || node.state === "passed");
    const state: ChapterState = settled
      ? (guardiansWon === guardians.length ? "cleared" : "done")
      : nodes.some((node) => node.state === "next") ? "current" : "ahead";
    chapters.push({
      phase, index: chapters.length + 1,
      weekFrom: Math.min(...sessions.map((session) => session.week)),
      weekTo: Math.max(...sessions.map((session) => session.week)),
      nodes, guardians: guardians.length, guardiansWon, state,
    });
  }
  return {
    chapters,
    guardians: chapters.reduce((sum, chapter) => sum + chapter.guardians, 0),
    guardiansWon: chapters.reduce((sum, chapter) => sum + chapter.guardiansWon, 0),
    current: chapters.find((chapter) => chapter.state === "current") ?? null,
  };
}

// ─── Words ───────────────────────────────────────────────────────────────

export const campaignWords = defineStrings({
  fr: {
    chapter: (index: number, phase: Phase) => `Chapitre ${index} · ${capitalise(phaseName(phase))}`,
    weeks: (from: number, to: number) => from === to ? `Semaine ${from}` : `Semaines ${from} à ${to}`,
    guardians: (won: number, total: number) => `${won} gardien${won > 1 ? "s" : ""} sur ${total}`,
    guardian: "Gardien",
    boss: "Le jour J",
    state: {
      won: "Faite", passed: "Passée", next: "La prochaine", ahead: "À venir",
    } as Record<NodeState, string>,
    chapterState: {
      cleared: "Chapitre bouclé", done: "Chapitre passé", current: "En cours", ahead: "À venir",
    } as Record<ChapterState, string>,
    lede: "Ton plan, chapitre par chapitre. Les gardiens sont ses séances clés, la course est la dernière.",
  },
  en: {
    chapter: (index: number, phase: Phase) => `Chapter ${index} · ${capitalise(phaseName(phase))}`,
    weeks: (from: number, to: number) => from === to ? `Week ${from}` : `Weeks ${from} to ${to}`,
    guardians: (won: number, total: number) => `${won} of ${total} guardian${total > 1 ? "s" : ""}`,
    guardian: "Guardian",
    boss: "Race day",
    state: {
      won: "Done", passed: "Passed", next: "Next", ahead: "Ahead",
    },
    chapterState: {
      cleared: "Chapter cleared", done: "Chapter behind you", current: "Under way", ahead: "Ahead",
    },
    lede: "Your plan, chapter by chapter. The guardians are its key sessions, the race is the last.",
  },
});

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
