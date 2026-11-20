import { prisma, type Prisma } from "@tread/db";
import type { RoutePoint } from "@tread/core/route";

/**
 * Routes made or changed on the web, and the list the phone reads back.
 *
 * The phone sends its routes with every sync, keyed on when each was made
 * (`createdAt`); a route drawn here is made with the same key, so the two
 * meet on it. A route deleted here is kept as a mark (`deletedAt`) rather
 * than removed: otherwise the next sync from a phone that still has it
 * would bring it back.
 */

/** What a client sends to make or change a route. */
export interface RouteDraft {
  name: string;
  waypoints: RoutePoint[];
  legs: RoutePoint[][];
  place: string | null;
}

/** What the phone reads: every route, and the ones deleted here. */
export interface RoutesForPhone {
  routes: { name: string; createdAt: number; waypoints: RoutePoint[]; legs: RoutePoint[][]; place: string | null }[];
  deleted: number[];
}

/** Enough for any route a runner draws; more is a mistake or an attack. */
const MAX_WAYPOINTS = 400;
const MAX_POINTS = 50_000;
const MAX_NAME = 120;

function readPoint(value: unknown): RoutePoint | null {
  if (!value || typeof value !== "object") return null;
  const { lat, lng } = value as { lat: unknown; lng: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function readPoints(value: unknown, max: number): RoutePoint[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const points = value.map(readPoint);
  return points.every((point): point is RoutePoint => point !== null) ? points : null;
}

/** A draft from a request body, or null when it is not one. */
export function readDraft(body: unknown): RouteDraft | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { name?: unknown; waypoints?: unknown; legs?: unknown; place?: unknown };
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_NAME) : "";
  const waypoints = readPoints(raw.waypoints, MAX_WAYPOINTS);
  if (!name || !waypoints || waypoints.length < 2 || !Array.isArray(raw.legs)) return null;
  if (raw.legs.length !== waypoints.length - 1) return null;
  const legs = raw.legs.map((leg) => readPoints(leg, MAX_POINTS));
  if (!legs.every((leg): leg is RoutePoint[] => leg !== null)) return null;
  if (legs.reduce((total, leg) => total + leg.length, 0) > MAX_POINTS) return null;
  const place = typeof raw.place === "string" && raw.place.trim() ? raw.place.trim().slice(0, MAX_NAME) : null;
  return { name, waypoints, legs, place };
}

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function createRoute(userId: string, draft: RouteDraft): Promise<string> {
  const route = await prisma.route.create({
    data: {
      userId, createdAt: new Date(), name: draft.name, place: draft.place,
      waypoints: json(draft.waypoints), legs: json(draft.legs),
    },
  });
  return route.id;
}

/** True when the route was the user's and is changed. */
export async function updateRoute(userId: string, id: string, draft: RouteDraft): Promise<boolean> {
  const { count } = await prisma.route.updateMany({
    where: { id, userId, deletedAt: null },
    data: { name: draft.name, place: draft.place, waypoints: json(draft.waypoints), legs: json(draft.legs) },
  });
  return count > 0;
}

/** True when the route was the user's and is now marked deleted. */
export async function deleteRoute(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.route.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } });
  return count > 0;
}

export async function routesForPhone(userId: string): Promise<RoutesForPhone> {
  const rows = await prisma.route.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return {
    routes: rows.filter((row) => row.deletedAt === null).map((row) => ({
      name: row.name,
      createdAt: row.createdAt.getTime(),
      waypoints: (row.waypoints ?? []) as unknown as RoutePoint[],
      legs: (row.legs ?? []) as unknown as RoutePoint[][],
      place: row.place,
    })),
    deleted: rows.filter((row) => row.deletedAt !== null).map((row) => row.createdAt.getTime()),
  };
}

/** A route as the editor needs it: its handles and legs, not just its line. */
export async function routeForEdit(userId: string, id: string): Promise<{
  id: string; name: string; waypoints: RoutePoint[]; legs: RoutePoint[][];
} | null> {
  const row = await prisma.route.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) return null;
  return {
    id: row.id, name: row.name,
    waypoints: (row.waypoints ?? []) as unknown as RoutePoint[],
    legs: (row.legs ?? []) as unknown as RoutePoint[][],
  };
}
