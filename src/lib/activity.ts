import { defineStrings } from "./i18n.ts";

/**
 * What kind of outing a run was, and what it was for.
 *
 * The type is what was done — on a road, a trail, a treadmill, on foot — and
 * a run has exactly one. Tags are what it was for, and a run can have
 * several: a race is also a long run. Both are stored as identifiers and
 * named here, so a run tagged in French reads in English too.
 */

export type ActivityType = "run" | "trail" | "treadmill" | "walk" | "hike";
export type RunTag = "race" | "long" | "workout" | "easy" | "recovery";

export const ACTIVITY_TYPES: readonly ActivityType[] = ["run", "trail", "treadmill", "walk", "hike"];
export const RUN_TAGS: readonly RunTag[] = ["race", "long", "workout", "easy", "recovery"];

const words = defineStrings({
  fr: {
    types: {
      run: "Course", trail: "Trail", treadmill: "Tapis", walk: "Marche", hike: "Randonnée",
    } as Record<ActivityType, string>,
    tags: {
      race: "Compétition", long: "Sortie longue", workout: "Fractionné", easy: "Footing", recovery: "Récupération",
    } as Record<RunTag, string>,
  },
  en: {
    types: {
      run: "Run", trail: "Trail", treadmill: "Treadmill", walk: "Walk", hike: "Hike",
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
