import "server-only";
import JSZip from "jszip";
import { prisma, type Prisma } from "@tread/db";
import type { UnitSystem } from "@tread/core/units";
import { readActivity, type ActivityType } from "@tread/core/activity";
import { bestEfforts } from "@tread/core/efforts";
import type { TrackPoint } from "@tread/core/geo";
import { parseGpx } from "@tread/core/gpx";
import { measureTrack } from "@tread/core/measure";
import { isNewerRace, readRaceSettings } from "@tread/core/raceDay";
import { TRANSFER_ENTRY, readTransfer, type Transfer, type TransferRun } from "@tread/core/transfer";

/**
 * Bringing a history into an account.
 *
 * Two doors, one shape. The phone sends its whole state as a `Transfer` (the
 * same file "Switch phones" and the safety copy write); the browser uploads
 * either that file or GPX tracks, which become a `Transfer` holding runs only.
 *
 * An outing is known by when it started. A run already here is updated with
 * what the phone says about it now (renamed, retyped, rated); its track is
 * not sent twice. Nothing is deleted for being missing from what arrives
 * (it may simply not be on that phone): the phone says which runs it
 * deleted, and only those go (`deleteOutings`).
 */

export interface Ingested {
  added: number;
  updated: number;
  routes: number;
  plan: boolean;
}

/** About sixty fixes, rounded to a metre or so: the outline drawn in a list. */
function shapeOf(points: readonly TrackPoint[]): [number, number][] {
  const step = Math.max(1, Math.floor(points.length / 60));
  return points
    .filter((_, index) => index % step === 0 || index === points.length - 1)
    .map((p) => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5]);
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

/** What can change about a run after it was recorded. */
function editable(run: TransferRun) {
  return {
    endedAt: run.endedAt !== null ? new Date(run.endedAt) : null,
    activity: readActivity(run.activity ?? null),
    name: run.name,
    distanceM: run.distanceM,
    durationS: run.durationS,
    avgPaceSKm: run.avgPaceSKm,
    elevationGainM: run.elevationGainM,
    fastestKmS: run.fastestKmS,
    cadenceSpm: run.cadenceSpm,
    exertion: run.exertion,
    sessionId: run.sessionId,
    shoeRef: run.shoeId ?? null,
    routeRef: run.routeId ?? null,
    tags: run.tags ?? [],
    note: run.note ?? null,
    blocks: json(run.blocks),
    laps: json(run.laps ?? []),
    weather: run.weather ? json(run.weather) : undefined,
    heart: run.heart ? json(run.heart) : undefined,
  };
}

const CHUNK = 25;

async function ingestRuns(userId: string, runs: readonly TransferRun[]): Promise<{ added: number; updated: number }> {
  const known = new Map(
    (await prisma.outing.findMany({ where: { userId }, select: { id: true, startedAt: true } }))
      .map((outing) => [outing.startedAt.getTime(), outing.id]),
  );
  // A run without a track (a treadmill, one entered by hand) still counts, as
  // on the phone: only an empty one, no track and no distance, is left out.
  const fresh = runs.filter((run) => !known.has(run.startedAt) && (run.points.length >= 2 || run.distanceM > 0));
  const seen = runs.filter((run) => known.has(run.startedAt));

  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK).map((run) => ({ id: crypto.randomUUID(), run }));
    await prisma.$transaction([
      prisma.outing.createMany({
        data: chunk.map(({ id, run }) => ({
          id,
          userId,
          startedAt: new Date(run.startedAt),
          ...editable(run),
          shape: json(shapeOf(run.points)),
          efforts: readActivity(run.activity ?? null) === "ride" ? json({}) : json(bestEfforts(run.points)),
        })),
        skipDuplicates: true,
      }),
      prisma.track.createMany({
        data: chunk.filter(({ run }) => run.points.length >= 2).map(({ id, run }) => ({ outingId: id, points: json(run.points) })),
        skipDuplicates: true,
      }),
    ]);
  }

  for (let i = 0; i < seen.length; i += CHUNK) {
    await prisma.$transaction(seen.slice(i, i + CHUNK).map((run) =>
      prisma.outing.update({ where: { id: known.get(run.startedAt)! }, data: editable(run) })));
  }
  return { added: fresh.length, updated: seen.length };
}

/** Everything a phone sends: runs, routes, shoes, its own sessions, the plan and its settings. */
/** The setting the phone's units, worked out, are kept under (see `pickUnits`). */
export const PHONE_UNITS_KEY = "phoneUnits";

export async function ingestTransfer(userId: string, transfer: Transfer, phoneUnits?: UnitSystem): Promise<Ingested> {
  const { added, updated } = await ingestRuns(userId, transfer.runs);

  for (const route of transfer.routes) {
    const key = { userId_createdAt: { userId, createdAt: new Date(route.createdAt) } };
    // The race planned on it is taken only when newer than the one held:
    // it may have been changed here since the phone last heard.
    const held = route.race ? await prisma.route.findUnique({ where: key, select: { race: true } }) : null;
    const race = route.race && isNewerRace(route.race, readRaceSettings(held?.race)) ? { race: json(route.race) } : {};
    const data = { name: route.name, waypoints: json(route.waypoints), legs: json(route.legs), place: route.place, ...race };
    await prisma.route.upsert({
      where: key,
      create: { userId, createdAt: new Date(route.createdAt), ...data },
      update: data,
    });
  }
  for (const shoe of transfer.shoes ?? []) {
    const data = {
      name: shoe.name, addedAt: new Date(shoe.addedAt), startM: shoe.startM, limitM: shoe.limitM,
      retired: shoe.retired, isDefault: shoe.isDefault,
    };
    await prisma.shoe.upsert({
      where: { userId_ref: { userId, ref: shoe.id } },
      create: { userId, ref: shoe.id, ...data },
      update: data,
    });
  }
  for (const session of transfer.sessions ?? []) {
    const data = { name: session.name, createdAt: new Date(session.createdAt), groups: json(session.groups) };
    await prisma.workout.upsert({
      where: { userId_ref: { userId, ref: session.id } },
      create: { userId, ref: session.id, ...data },
      update: data,
    });
  }

  // The phone holds the plan: none there means it was ended there.
  if (transfer.plan) {
    await prisma.plan.upsert({ where: { userId }, create: { userId, data: json(transfer.plan) }, update: { data: json(transfer.plan) } });
  } else {
    await prisma.plan.deleteMany({ where: { userId } });
  }
  const settings = phoneUnits ? { ...transfer.settings, [PHONE_UNITS_KEY]: phoneUnits } : transfer.settings;
  await prisma.preferences.upsert({
    where: { userId },
    create: { userId, settings: json(settings), syncedAt: new Date() },
    update: { settings: json(settings), syncedAt: new Date() },
  });

  return { added, updated, routes: transfer.routes.length, plan: transfer.plan !== null };
}

/** A GPX track as a run that knows nothing but its track. */
function runFromGpx(xml: string): TransferRun | null {
  const { name, points, ride } = parseGpx(xml);
  const activity: ActivityType = ride ? "ride" : "run";
  const measured = measureTrack(name, points, activity);
  if (!measured) return null;
  return {
    ...measured,
    cadenceSpm: null, exertion: null, sessionId: null, blocks: [], weather: null, heart: null,
    activity, points,
  };
}

/** What an upload turned out to be. */
export type Upload =
  | { kind: "transfer"; transfer: Transfer }
  | { kind: "gpx"; runs: TransferRun[]; unreadable: number }
  | { kind: "unknown" };

/**
 * Read a file dropped in the browser: Tread's own file (the safety copy or
 * "Switch phones"), a zip of GPX files ("All my runs"), or a GPX file.
 */
export async function readUpload(name: string, bytes: ArrayBuffer): Promise<Upload> {
  if (/\.gpx$/i.test(name)) {
    const run = runFromGpx(new TextDecoder().decode(bytes));
    return run ? { kind: "gpx", runs: [run], unreadable: 0 } : { kind: "gpx", runs: [], unreadable: 1 };
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return { kind: "unknown" };
  }
  const entry = zip.file(TRANSFER_ENTRY);
  if (entry) {
    const transfer = readTransfer(await entry.async("string"));
    return transfer ? { kind: "transfer", transfer } : { kind: "unknown" };
  }
  const files = zip.file(/\.gpx$/i);
  if (files.length === 0) return { kind: "unknown" };
  const runs: TransferRun[] = [];
  let unreadable = 0;
  for (const file of files) {
    const run = runFromGpx(await file.async("string"));
    if (run) runs.push(run);
    else unreadable += 1;
  }
  return { kind: "gpx", runs, unreadable };
}

/** Runs from GPX files: added when new, nothing else touched. */
export async function ingestGpxRuns(userId: string, runs: readonly TransferRun[]): Promise<Ingested> {
  const known = new Set(
    (await prisma.outing.findMany({ where: { userId }, select: { startedAt: true } })).map((o) => o.startedAt.getTime()),
  );
  const { added } = await ingestRuns(userId, runs.filter((run) => !known.has(run.startedAt)));
  return { added, updated: 0, routes: 0, plan: false };
}

/** Runs the phone deleted, by when they started; their tracks go with them. */
export async function deleteOutings(userId: string, startedAts: readonly number[]): Promise<number> {
  if (startedAts.length === 0) return 0;
  const { count } = await prisma.outing.deleteMany({
    where: { userId, startedAt: { in: startedAts.map((at) => new Date(at)) } },
  });
  return count;
}
