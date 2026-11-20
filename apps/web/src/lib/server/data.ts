import { PREDICTION_WINDOW_MS } from "@tread/core/predictions";
import type { RouteRun } from "@tread/core/routeTime";
import "server-only";
import { prisma } from "@tread/db";
import { readActivity } from "@tread/core/activity";
import type { BestEfforts } from "@tread/core/efforts";
import type { TrackPoint } from "@tread/core/geo";
import type { Heart } from "@tread/core/heart";
import type { LapMark } from "@tread/core/laps";
import type { Exertion } from "@tread/core/plan";
import type { RoutePoint } from "@tread/core/route";
import type { TransferPlan } from "@tread/core/transfer";
import type { Weather } from "@tread/core/weather";
import type { RanBlock } from "@tread/core/workout";
import type {
  CardOuting, OutingDetail, OutingFigures, OutingRow, PlanData, Preferences, RouteRow, ShoeRow,
} from "@/lib/types";

/**
 * Every read the pages make, always narrowed to the signed-in person.
 *
 * The user id comes from the session, never from the URL: an outing id typed
 * by hand that belongs to somebody else reads as one that does not exist.
 */

const rowFields = {
  id: true, startedAt: true, activity: true, name: true, distanceM: true, durationS: true,
  avgPaceSKm: true, elevationGainM: true, shape: true,
} as const;

type RowRecord = {
  id: string; startedAt: Date; activity: string; name: string | null; distanceM: number; durationS: number;
  avgPaceSKm: number | null; elevationGainM: number | null; shape: unknown;
};

const toRow = (outing: RowRecord): OutingRow => ({
  id: outing.id,
  startedAt: outing.startedAt.getTime(),
  activity: readActivity(outing.activity),
  name: outing.name,
  distanceM: outing.distanceM,
  durationS: outing.durationS,
  avgPaceSKm: outing.avgPaceSKm,
  elevationGainM: outing.elevationGainM,
  shape: Array.isArray(outing.shape) ? (outing.shape as [number, number][]) : [],
});

/** Every outing, newest first, without tracks. */
export async function outingRows(userId: string): Promise<OutingRow[]> {
  const outings = await prisma.outing.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, select: rowFields });
  return outings.map(toRow);
}

/** The last few weeks of outings, as a route's time is estimated from them. */
export async function recentRuns(userId: string): Promise<RouteRun[]> {
  const since = new Date(Date.now() - PREDICTION_WINDOW_MS);
  const outings = await prisma.outing.findMany({
    where: { userId, startedAt: { gte: since } },
    orderBy: { startedAt: "desc" },
    take: 40,
    select: { startedAt: true, activity: true, distanceM: true, durationS: true, elevationGainM: true },
  });
  return outings.map((outing) => ({
    startedAt: outing.startedAt.getTime(),
    activity: outing.activity as RouteRun["activity"],
    distanceM: outing.distanceM,
    durationS: outing.durationS,
    elevationGainM: outing.elevationGainM,
  }));
}

/** Every outing with what the profile adds up. */
export async function outingFigures(userId: string): Promise<OutingFigures[]> {
  const outings = await prisma.outing.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: { ...rowFields, efforts: true, shoeRef: true },
  });
  return outings.map((outing) => ({
    ...toRow(outing),
    efforts: (outing.efforts as BestEfforts | null) ?? null,
    shoeRef: outing.shoeRef,
  }));
}

/**
 * Every outing with what its card is dealt from. Cards are dealt in the
 * browser, not here: the hour a run started is read in the runner's own time
 * zone, as on the phone, and a server's clock may sit in another.
 */
export async function cardOutings(userId: string): Promise<CardOuting[]> {
  const outings = await prisma.outing.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: {
      ...rowFields, endedAt: true, fastestKmS: true, exertion: true, sessionId: true, tags: true,
      blocks: true, weather: true, efforts: true, routeRef: true,
    },
  });
  return outings.map((outing) => ({
    ...toRow(outing),
    endedAt: outing.endedAt?.getTime() ?? null,
    fastestKmS: outing.fastestKmS,
    exertion: (outing.exertion as Exertion | null) ?? null,
    sessionId: outing.sessionId,
    tags: outing.tags,
    blocks: (outing.blocks as unknown as RanBlock[]) ?? [],
    weather: (outing.weather as unknown as Weather | null) ?? null,
    efforts: (outing.efforts as BestEfforts | null) ?? null,
    routeRef: outing.routeRef,
  }));
}

export async function outingDetail(userId: string, id: string): Promise<OutingDetail | null> {
  const outing = await prisma.outing.findFirst({ where: { id, userId }, include: { track: true } });
  if (!outing) return null;
  const shoe = outing.shoeRef !== null
    ? await prisma.shoe.findUnique({ where: { userId_ref: { userId, ref: outing.shoeRef } }, select: { name: true } })
    : null;
  return {
    ...toRow(outing),
    endedAt: outing.endedAt?.getTime() ?? null,
    fastestKmS: outing.fastestKmS,
    cadenceSpm: outing.cadenceSpm,
    exertion: (outing.exertion as Exertion | null) ?? null,
    sessionId: outing.sessionId,
    shoeName: shoe?.name ?? null,
    tags: outing.tags,
    note: outing.note,
    blocks: (outing.blocks as unknown as RanBlock[]) ?? [],
    laps: (outing.laps as unknown as LapMark[]) ?? [],
    weather: (outing.weather as unknown as Weather | null) ?? null,
    heart: (outing.heart as unknown as Heart | null) ?? null,
    points: (outing.track?.points as unknown as TrackPoint[]) ?? [],
  };
}

const joinLegs = (legs: unknown, waypoints: unknown): RoutePoint[] => {
  const joined = Array.isArray(legs) ? (legs as RoutePoint[][]).flat() : [];
  return joined.length > 1 ? joined : Array.isArray(waypoints) ? (waypoints as RoutePoint[]) : [];
};

export async function routeRows(userId: string): Promise<RouteRow[]> {
  const routes = await prisma.route.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" } });
  return routes.map((route) => ({
    id: route.id, name: route.name, createdAt: route.createdAt.getTime(), place: route.place,
    line: joinLegs(route.legs, route.waypoints),
  }));
}

export async function routeById(userId: string, id: string): Promise<RouteRow | null> {
  const route = await prisma.route.findFirst({ where: { id, userId, deletedAt: null } });
  return route
    ? { id: route.id, name: route.name, createdAt: route.createdAt.getTime(), place: route.place, line: joinLegs(route.legs, route.waypoints) }
    : null;
}

export async function shoeRows(userId: string): Promise<ShoeRow[]> {
  const shoes = await prisma.shoe.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
  return shoes.map((shoe) => ({
    ref: shoe.ref, name: shoe.name, addedAt: shoe.addedAt.getTime(), startM: shoe.startM, limitM: shoe.limitM,
    retired: shoe.retired, isDefault: shoe.isDefault,
  }));
}

export async function planOf(userId: string): Promise<PlanData | null> {
  const plan = await prisma.plan.findUnique({ where: { userId } });
  return plan ? (plan.data as unknown as TransferPlan) : null;
}

export async function preferencesOf(userId: string): Promise<Preferences> {
  const found = await prisma.preferences.findUnique({ where: { userId } });
  return {
    settings: (found?.settings as Record<string, string> | undefined) ?? {},
    syncedAt: found?.syncedAt?.getTime() ?? null,
  };
}
