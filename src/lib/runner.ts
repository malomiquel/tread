import { defineStrings } from "./i18n.ts";
import type { Goal, PerWeek } from "./plan.ts";

/**
 * What a new runner says about themselves in the welcome, and what the app
 * does with it.
 *
 * Three answers, each of which changes something on screen: why they run
 * decides where the app sends them, how much they run fills in what the
 * programme form would otherwise ask cold, and how often sets the rhythm of
 * both the programme and the weekly goal. Nothing is asked that is not used —
 * age and weight come from Health when they are needed at all.
 *
 * Only a starting point. Real runs always win: the moment there is a history
 * to measure, the programme form reads it instead of these guesses.
 */

export type RunnerGoal = "regular" | "race" | "comeback";
export type RunnerLevel = "new" | "occasional" | "weekly";
export type RunnerFrequency = PerWeek;

export interface RunnerProfile {
  goal: RunnerGoal;
  level: RunnerLevel;
  perWeek: RunnerFrequency;
}

export const RUNNER_GOALS: readonly RunnerGoal[] = ["regular", "race", "comeback"];
export const RUNNER_LEVELS: readonly RunnerLevel[] = ["new", "occasional", "weekly"];
export const RUNNER_FREQUENCIES: readonly RunnerFrequency[] = [1, 2, 3, 4];

/** A typical outing at each level, in kilometres. */
const OUTING_KM: Record<RunnerLevel, number> = { new: 3, occasional: 5, weekly: 7 };

/** The longest run someone at each level can be assumed to manage, in minutes. */
const LONGEST_MIN: Record<RunnerLevel, number> = { new: 20, occasional: 40, weekly: 60 };

/**
 * Coming back is running less than you used to, whatever you used to run.
 * The level says what the legs remember; this says what they can do today.
 */
const COMEBACK_SHARE = 0.6;

/** Kilometres a week this runner covers today, as far as their answers say. */
export function startingVolumeKm(profile: RunnerProfile): number {
  const share = profile.goal === "comeback" ? COMEBACK_SHARE : 1;
  return Math.max(3, Math.round(profile.perWeek * OUTING_KM[profile.level] * share));
}

/**
 * The weekly goal offered at the end of the welcome, in metres.
 *
 * What they already run rather than more: a goal met in the first week is
 * one that gets kept, and it can be raised from the profile once it is.
 */
export const startingWeeklyGoalM = (profile: RunnerProfile): number =>
  startingVolumeKm(profile) * 1000;

/** The longest run to build a programme from, in minutes. */
export function startingLongestMin(profile: RunnerProfile): number {
  const minutes = LONGEST_MIN[profile.level];
  return profile.goal === "comeback" ? Math.max(20, Math.round((minutes * COMEBACK_SHARE) / 5) * 5) : minutes;
}

/**
 * The race distance to put first in the programme form.
 *
 * The next step up from where they are: a first 5 km for someone starting,
 * a 10 km for the occasional runner, a half for someone out every week. The
 * marathon is never suggested — it has to be chosen.
 */
export function suggestedRace(profile: RunnerProfile): Goal {
  if (profile.level === "new") return "fiveK";
  if (profile.level === "occasional") return "tenK";
  return "half";
}

/**
 * Where the frequency slider starts, before it is touched.
 *
 * Two for anyone not yet running every week — enough to progress, few enough
 * to keep — and three for someone who already does.
 */
export const suggestedFrequency = (level: RunnerLevel): RunnerFrequency =>
  level === "weekly" ? 3 : 2;

/** A stored profile, or null for anything unreadable or never answered. */
export function readRunnerProfile(raw: string | undefined): RunnerProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RunnerProfile> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const { goal, level, perWeek } = parsed;
    if (!goal || !RUNNER_GOALS.includes(goal)) return null;
    if (!level || !RUNNER_LEVELS.includes(level)) return null;
    if (!perWeek || !RUNNER_FREQUENCIES.includes(perWeek)) return null;
    return { goal, level, perWeek };
  } catch {
    return null;
  }
}

/**
 * How each answer is said, wherever it is asked: in the welcome, and again
 * in the settings when it changes.
 */
export const runnerWords = defineStrings({
  fr: {
    goals: {
      regular: { title: "Courir régulièrement", detail: "Un objectif de distance chaque semaine" },
      race: { title: "Préparer une course", detail: "Un programme jusqu'au jour J" },
      comeback: { title: "Reprendre la course", detail: "Repartir en douceur après une pause" },
    } as Record<RunnerGoal, { title: string; detail: string }>,
    levels: {
      new: { title: "Je débute", detail: "Courir 20 minutes d'affilée est déjà un défi" },
      occasional: { title: "Je cours de temps en temps", detail: "Quelques sorties par mois, jusqu'à 40 minutes" },
      weekly: { title: "Je cours chaque semaine", detail: "Une heure ne me fait pas peur" },
    } as Record<RunnerLevel, { title: string; detail: string }>,
    frequencyUnit: (n: number): string => (n > 1 ? "sorties par semaine" : "sortie par semaine"),
    frequencyShort: (n: number): string => `${n}/sem.`,
    frequencyHints: {
      1: "De quoi garder le fil, même les semaines chargées.",
      2: "Assez pour progresser, assez peu pour tenir.",
      3: "Un vrai entraînement, avec de la place pour récupérer.",
      4: "Pour viser haut, avec un corps déjà habitué.",
    } as Record<RunnerFrequency, string>,
    frequencyLabel: "Sorties par semaine",
  },
  en: {
    goals: {
      regular: { title: "Run regularly", detail: "A distance goal every week" },
      race: { title: "Train for a race", detail: "A plan all the way to race day" },
      comeback: { title: "Get back into running", detail: "Ease back in after a break" },
    },
    levels: {
      new: { title: "I'm just starting", detail: "Running 20 minutes straight is already a challenge" },
      occasional: { title: "I run now and then", detail: "A few runs a month, up to 40 minutes" },
      weekly: { title: "I run every week", detail: "An hour doesn't scare me" },
    },
    frequencyUnit: (n: number): string => (n > 1 ? "runs a week" : "run a week"),
    frequencyShort: (n: number): string => `${n}/wk`,
    frequencyHints: {
      1: "Enough to keep the habit, even in busy weeks.",
      2: "Enough to improve, few enough to stick with.",
      3: "Real training, with room to recover.",
      4: "To aim high, with a body already used to it.",
    },
    frequencyLabel: "Runs a week",
  },
});
