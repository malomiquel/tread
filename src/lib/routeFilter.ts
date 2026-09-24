import { distanceM } from "./geo.ts";
import { defineStrings } from "./i18n.ts";
import { distanceUnit, toDistanceUnits } from "./units.ts";

/**
 * Finding a route again once there are more than a screenful: by name or
 * place, by length, by shape, and in the order that suits the moment —
 * newest, nearest, most run.
 */

export type RouteSort = "recent" | "nearby" | "mostRun" | "distance" | "name";
export const ROUTE_SORTS: readonly RouteSort[] = ["recent", "nearby", "mostRun", "distance", "name"];

export type RouteFilter = "loop" | "oneWay" | "short" | "mid" | "long" | "neverRun";
export const ROUTE_FILTERS: readonly RouteFilter[] = ["loop", "oneWay", "short", "mid", "long", "neverRun"];

/** What a route is judged on: all of it already worked out. */
export interface RouteFacts {
  id: number;
  name: string;
  place: string | null;
  createdAt: number;
  distanceM: number;
  loop: boolean;
  /** Where it starts, for "nearest". */
  start: { lat: number; lng: number } | null;
  /** Times run, and when last. */
  runs: number;
}

/** Lengths the bands split at, in metres. */
const SHORT_BELOW_M = 5000;
const LONG_ABOVE_M = 10_000;

/** "Foulée" and "foulee" are the same word to somebody typing on a phone. */
const folded = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function passes(route: RouteFacts, filter: RouteFilter): boolean {
  switch (filter) {
    case "loop": return route.loop;
    case "oneWay": return !route.loop;
    case "short": return route.distanceM < SHORT_BELOW_M;
    case "mid": return route.distanceM >= SHORT_BELOW_M && route.distanceM <= LONG_ABOVE_M;
    case "long": return route.distanceM > LONG_ABOVE_M;
    case "neverRun": return route.runs === 0;
  }
}

/**
 * Filters of the same kind widen the list, filters of different kinds narrow
 * it: "loops" and "5–10 km" is the loops of that length, while "under 5 km"
 * and "over 10 km" together are both.
 */
const FILTER_GROUPS: readonly (readonly RouteFilter[])[] = [["loop", "oneWay"], ["short", "mid", "long"], ["neverRun"]];

export function findRoutes<T extends RouteFacts>(
  routes: readonly T[],
  { query, filters, sort, here }: { query: string; filters: readonly RouteFilter[]; sort: RouteSort; here: { lat: number; lng: number } | null },
): T[] {
  const words = folded(query).split(/\s+/).filter(Boolean);
  const found = routes.filter((route) => {
    const text = folded(`${route.name} ${route.place ?? ""}`);
    if (!words.every((word) => text.includes(word))) return false;
    return FILTER_GROUPS.every((group) => {
      const on = group.filter((filter) => filters.includes(filter));
      return on.length === 0 || on.some((filter) => passes(route, filter));
    });
  });

  const away = (route: RouteFacts) => (here && route.start ? distanceM(here, route.start) : Infinity);
  const compare: Record<RouteSort, (a: T, b: T) => number> = {
    recent: (a, b) => b.createdAt - a.createdAt,
    nearby: (a, b) => away(a) - away(b) || b.createdAt - a.createdAt,
    mostRun: (a, b) => b.runs - a.runs || b.createdAt - a.createdAt,
    distance: (a, b) => a.distanceM - b.distanceM,
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  };
  return [...found].sort(compare[sort]);
}

const words = defineStrings({
  fr: {
    sorts: {
      recent: "Récents", nearby: "Les plus proches", mostRun: "Les plus courus", distance: "Distance", name: "Nom",
    } as Record<RouteSort, string>,
    loop: "Boucles",
    oneWay: "Aller simple",
    neverRun: "Jamais courus",
    short: (to: string, unit: string) => `Moins de ${to} ${unit}`,
    mid: (from: string, to: string, unit: string) => `${from} à ${to} ${unit}`,
    long: (from: string, unit: string) => `Plus de ${from} ${unit}`,
  },
  en: {
    sorts: { recent: "Newest", nearby: "Nearest", mostRun: "Most run", distance: "Distance", name: "Name" },
    loop: "Loops",
    oneWay: "One way",
    neverRun: "Never run",
    short: (to: string, unit: string) => `Under ${to} ${unit}`,
    mid: (from: string, to: string, unit: string) => `${from} to ${to} ${unit}`,
    long: (from: string, unit: string) => `Over ${from} ${unit}`,
  },
});

export const sortName = (sort: RouteSort): string => words().sorts[sort];
/** A band's edge in the runner's unit, to the nearest whole one: "5", "3". */
const edge = (metres: number): string => String(Math.round(toDistanceUnits(metres)));

export function filterName(filter: RouteFilter): string {
  const w = words();
  const unit = distanceUnit();
  switch (filter) {
    case "short": return w.short(edge(SHORT_BELOW_M), unit);
    case "mid": return w.mid(edge(SHORT_BELOW_M), edge(LONG_ABOVE_M), unit);
    case "long": return w.long(edge(LONG_ABOVE_M), unit);
    default: return w[filter];
  }
}
