import { defineStrings } from "./i18n.ts";

/**
 * What kind of outing a run was, and what it was for.
 *
 * The type is what was done — on a road, a trail, a treadmill, on foot — and
 * a run has exactly one. Tags are what it was for, and a run can have
 * several: a race is also a long run. Both are stored as identifiers and
 * named here, so a run tagged in French reads in English too.
 */

export type ActivityType = "run" | "trail" | "treadmill" | "walk" | "hike" | "ride";
export type RunTag = "race" | "long" | "workout" | "easy" | "recovery";

export const ACTIVITY_TYPES: readonly ActivityType[] = ["run", "trail", "treadmill", "walk", "hike", "ride"];
export const RUN_TAGS: readonly RunTag[] = ["race", "long", "workout", "easy", "recovery"];

const words = defineStrings({
  fr: {
    types: {
      run: "Course", trail: "Trail", treadmill: "Tapis", walk: "Marche", hike: "Randonnée", ride: "Vélo",
    } as Record<ActivityType, string>,
    tags: {
      race: "Compétition", long: "Sortie longue", workout: "Fractionné", easy: "Footing", recovery: "Récupération",
    } as Record<RunTag, string>,
  },
  en: {
    types: {
      run: "Run", trail: "Trail", treadmill: "Treadmill", walk: "Walk", hike: "Hike", ride: "Ride",
    },
    tags: {
      race: "Race", long: "Long run", workout: "Workout", easy: "Easy run", recovery: "Recovery",
    },
  },
});

export const activityName = (type: ActivityType): string => words().types[type];
export const tagName = (tag: RunTag): string => words().tags[tag];

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  run: "speedometer-outline",
  trail: "trail-sign-outline",
  treadmill: "barbell-outline",
  walk: "walk-outline",
  hike: "leaf-outline",
  ride: "bicycle-outline",
};

/** A stored type, or a run for anything unknown or absent. */
export const readActivity = (raw: string | null): ActivityType =>
  ACTIVITY_TYPES.find((type) => type === raw) ?? "run";

/** Stored tags, known ones only, in the order they are offered. */
export function parseTags(raw: string | null): RunTag[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return RUN_TAGS.filter((tag) => parsed.includes(tag));
  } catch {
    return [];
  }
}

/** Tags with one switched on or off, kept in their offered order. */
export function toggleTag(tags: readonly RunTag[], tag: RunTag): RunTag[] {
  const next = tags.includes(tag) ? tags.filter((held) => held !== tag) : [...tags, tag];
  return RUN_TAGS.filter((known) => next.includes(known));
}

/**
 * The two sports the app records. Everything on foot is running: a walk or a
 * hike is slow running as far as totals go. A ride is not: forty kilometres
 * on a bike are not forty kilometres in the legs, so rides keep their own
 * figures and stay out of the runner's totals, records and plan.
 */
export type Sport = "running" | "cycling";

export const SPORTS: readonly Sport[] = ["running", "cycling"];

export const sportOf = (activity: ActivityType): Sport => (activity === "ride" ? "cycling" : "running");

/** The type a run recorded in that sport is stored with. */
export const recordedActivity = (sport: Sport): ActivityType => (sport === "cycling" ? "ride" : "run");

export const readSport = (raw: string | undefined): Sport => SPORTS.find((sport) => sport === raw) ?? "running";

/** Only the outings of one sport, in the order they came. */
export const ofSport = <T extends { activity: ActivityType }>(runs: readonly T[], sport: Sport = "running"): T[] =>
  runs.filter((run) => sportOf(run.activity) === sport);

const sportWords = defineStrings({
  fr: { running: "Course", cycling: "Vélo" } as Record<Sport, string>,
  en: { running: "Run", cycling: "Ride" },
});

export const sportName = (sport: Sport): string => sportWords()[sport];

export const SPORT_ICONS: Record<Sport, string> = {
  running: "walk-outline",
  cycling: "bicycle-outline",
};
