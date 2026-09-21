/** Structured sessions: what to run, and for how long, announced as you go. */

export type Effort = "échauffement" | "rapide" | "récupération" | "allure" | "retour au calme";

/**
 * One block of a session, measured either in distance or in time — never both.
 *
 * The distinction is the whole point. A four-hundred-metre repetition is over
 * when four hundred metres are behind you, however long that took; a ninety
 * second recovery is over after ninety seconds, however far you got. Forcing
 * either into the other's unit is how a session stops matching the one the
 * runner meant to do.
 */
export interface Step {
  effort: Effort;
  metres?: number;
  seconds?: number;
}

export interface Session {
  id: string;
  name: string;
  steps: Step[];
}

/** What is left of a step, in its own unit. Null in the unit it does not use. */
export interface Remaining {
  metres: number | null;
  seconds: number | null;
}

export function stepIsDone(step: Step, coveredM: number, elapsedS: number): boolean {
  if (step.metres !== undefined) return coveredM >= step.metres;
  if (step.seconds !== undefined) return elapsedS >= step.seconds;
  return false;
}

export function stepRemaining(step: Step, coveredM: number, elapsedS: number): Remaining {
  if (step.metres !== undefined) {
    return { metres: Math.max(0, step.metres - coveredM), seconds: null };
  }
  if (step.seconds !== undefined) {
    return { metres: null, seconds: Math.max(0, step.seconds - elapsedS) };
  }
  return { metres: null, seconds: null };
}

/** How a step is named aloud and on screen. */
export function stepLabel(step: Step): string {
  const measure = step.metres !== undefined
    ? step.metres >= 1000
      ? `${(step.metres / 1000).toString().replace(".", ",")} km`
      : `${step.metres} m`
    : `${Math.round((step.seconds ?? 0) / 60)} min`;
  return `${measure} ${step.effort}`;
}

/**
 * Roughly how long a session takes, for the line under its name.
 *
 * Distance blocks are counted at five minutes a kilometre, which is a guess
 * and says so: the figure exists to tell a twenty minute session from an hour
 * long one, not to be relied upon.
 */
export function sessionMinutes(session: Session): number {
  const seconds = session.steps.reduce(
    (total, step) => total + (step.seconds ?? ((step.metres ?? 0) / 1000) * 300),
    0,
  );
  return Math.round(seconds / 60);
}

const repeat = (fois: number, ...bloc: Step[]): Step[] =>
  Array.from({ length: fois }, () => bloc).flat();

/**
 * The catalogue, kept deliberately short.
 *
 * Five sessions that between them cover what a runner actually alternates
 * between — short repetitions, threshold, a pyramid, an easy run and a long
 * one. A longer list would need a builder, and a builder is a different
 * feature.
 */
export const SESSIONS: Session[] = [
  {
    id: "400",
    name: "5 × 400 m",
    steps: [
      { effort: "échauffement", seconds: 600 },
      ...repeat(5, { effort: "rapide", metres: 400 }, { effort: "récupération", metres: 200 }),
      { effort: "retour au calme", seconds: 300 },
    ],
  },
  {
    id: "seuil",
    name: "3 × 8 min au seuil",
    steps: [
      { effort: "échauffement", seconds: 900 },
      ...repeat(3, { effort: "allure", seconds: 480 }, { effort: "récupération", seconds: 180 }),
      { effort: "retour au calme", seconds: 600 },
    ],
  },
  {
    id: "pyramide",
    name: "Pyramide 1-2-3-2-1",
    steps: [
      { effort: "échauffement", seconds: 600 },
      { effort: "rapide", seconds: 60 }, { effort: "récupération", seconds: 60 },
      { effort: "rapide", seconds: 120 }, { effort: "récupération", seconds: 120 },
      { effort: "rapide", seconds: 180 }, { effort: "récupération", seconds: 180 },
      { effort: "rapide", seconds: 120 }, { effort: "récupération", seconds: 120 },
      { effort: "rapide", seconds: 60 },
      { effort: "retour au calme", seconds: 600 },
    ],
  },
  {
    id: "footing",
    name: "Footing 30 min",
    steps: [{ effort: "allure", seconds: 1800 }],
  },
  {
    id: "longue",
    name: "Sortie longue 1 h",
    steps: [
      { effort: "échauffement", seconds: 600 },
      { effort: "allure", seconds: 2400 },
      { effort: "retour au calme", seconds: 600 },
    ],
  },
];

export const sessionById = (id: string | null): Session | null =>
  SESSIONS.find((s) => s.id === id) ?? null;
