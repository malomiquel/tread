import JSZip from "jszip";
import type { TrackPoint } from "./geo";
import type { Heart } from "./heart";
import { parseGroups, type DraftGroup } from "./customSession.ts";
import { parseLaps, type LapMark } from "./laps.ts";
import type { Exertion, Goal, PerWeek, PlannedSession } from "./plan";
import { defineStrings, intlLocale } from "./i18n.ts";
import type { RoutePoint } from "./route";
import type { Weather } from "./weather";
import { currentEffort, currentSession, currentSessionId, type RanBlock } from "./workout.ts";

/**
 * Moving everything to another phone.
 *
 * The app keeps its runs in one database on one device and talks to no
 * server, which is the point of it — and also the one thing that makes a new
 * phone frightening. The GPX export was never a substitute: it carries the
 * tracks and drops the programme, the exertions, the weather and the heart.
 *
 * So the whole state travels as one versioned file, handed to the platform's
 * own share sheet and picked up on the other side. That choice is deliberate
 * against the obvious alternative — a small web server on one phone and a QR
 * code on the other. The server would need two native modules, a local
 * network permission, and both phones on a Wi-Fi that does not isolate its
 * clients; it would also have to be remembered to be switched off. A file
 * goes by AirDrop, by Quick Share, by Bluetooth, by a message or by a cable,
 * on either platform, and stops existing when it has been read.
 *
 * Nothing in this file touches the database or the platform, so the shape of
 * what travels is testable on its own.
 */

/** Stamped into the file, so that anything else picked by mistake is refused. */
export const TRANSFER_FORMAT = "tread-transfer";

/**
 * The shape of what travels.
 *
 * Bumped when a change would confuse an older app reading a newer file. The
 * reader refuses anything above the version it knows: a phone cannot be asked
 * to guess at fields that did not exist when it was written.
 */
export const TRANSFER_VERSION = 1;

/** One run, with everything the app knows about it, and its track. */
export interface TransferRun {
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  name: string | null;
  elevationGainM: number | null;
  fastestKmS: number | null;
  cadenceSpm: number | null;
  exertion: Exertion | null;
  sessionId: string | null;
  blocks: RanBlock[];
  weather: Weather | null;
  heart: Heart | null;
  /** Absent from files written before laps existed. */
  laps?: LapMark[];
  /** The pair it was run in, by its id in `shoes`. */
  shoeId?: number | null;
  /** Absent from older files: a run, untagged. */
  activity?: string;
  tags?: string[];
  /** What the runner wrote. The photos stay behind: a transfer is a file to send. */
  note?: string | null;
  points: TrackPoint[];
  /*
   * No `healthUuid`. It names a workout inside the old phone's HealthKit
   * store, and the new phone's Health has its own — carrying it across would
   * let this app believe it owns a record it has never written, and try to
   * delete it. The new phone syncs its own copies instead.
   */
}

/** The programme, with the sessions already ticked off. */
export interface TransferPlan {
  goal: Goal;
  raceAt: number;
  weeks: number;
  perWeek: PerWeek;
  targetTimeS: number;
  createdAt: number;
  days: number[];
  sessions: PlannedSession[];
  /** Session order, the run that settled it, and when. */
  done: { order: number; runId: number | null; at: number }[];
}

/**
 * A drawn route: its handles and the streets between them.
 *
 * No picture. The file it points at lives in this phone's documents, and the
 * list on the other phone takes its own the first time it shows the route.
 */
export interface TransferRoute {
  name: string;
  createdAt: number;
  waypoints: RoutePoint[];
  legs: RoutePoint[][];
  place: string | null;
}

/**
 * A session the runner wrote. Its id travels with it, because runs name the
 * session they followed by it ("custom-3").
 */
export interface TransferSession {
  id: number;
  name: string;
  createdAt: number;
  groups: DraftGroup[];
}

/** A pair of shoes. Its id travels with it, because runs name their pair by it. */
export interface TransferShoe {
  id: number;
  name: string;
  addedAt: number;
  startM: number;
  limitM: number;
  retired: boolean;
  isDefault: boolean;
}

export interface Transfer {
  format: typeof TRANSFER_FORMAT;
  version: number;
  exportedAt: number;
  runs: TransferRun[];
  /**
   * Absent from files written before routes travelled, which read as none —
   * an addition an older reader can ignore, so the version did not move.
   */
  routes: TransferRoute[];
  plan: TransferPlan | null;
  /** The runner's own sessions. Absent from older files, which read as none. */
  sessions?: TransferSession[];
  /** Running shoes. Absent from older files, which read as none. */
  shoes?: TransferShoe[];
  /** Voice, target pace, weekly goal, reminders — as they are stored. */
  settings: Record<string, string>;
}

/**
 * Read a file back, or refuse it.
 *
 * Null for anything that is not one of these: a GPX archive picked by
 * mistake, a half-written file, or one from a future version of the app. The
 * screen says which, so nobody is left guessing at a silent failure.
 */
export function readTransfer(text: string): Transfer | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const file = parsed as Partial<Transfer>;
    if (file.format !== TRANSFER_FORMAT) return null;
    if (typeof file.version !== "number" || file.version > TRANSFER_VERSION) return null;
    if (!Array.isArray(file.runs)) return null;
    return {
      format: TRANSFER_FORMAT,
      version: file.version,
      exportedAt: typeof file.exportedAt === "number" ? file.exportedAt : 0,
      // Every run needs the two fields the import keys on; the rest can be
      // absent and simply arrives empty.
      runs: file.runs
        .filter((run): run is TransferRun =>
          !!run && typeof run === "object"
          && typeof (run as TransferRun).startedAt === "number"
          && Array.isArray((run as TransferRun).points))
        // A file from an older version spells its sessions in French.
        .map((run) => ({
          ...run,
          sessionId: typeof run.sessionId === "string" ? currentSessionId(run.sessionId) : null,
          blocks: Array.isArray(run.blocks)
            ? run.blocks.map((block) => ({ ...block, effort: currentEffort(block.effort) }))
            : [],
          ...(Array.isArray(run.laps) ? { laps: parseLaps(JSON.stringify(run.laps)) } : {}),
        })),
      routes: readRoutes(file.routes),
      plan: readPlan(file.plan),
      ...(Array.isArray(file.sessions) ? { sessions: readSessions(file.sessions) } : {}),
      ...(Array.isArray(file.shoes) ? { shoes: readShoes(file.shoes) } : {}),
      settings: readSettingsBag(file.settings),
    };
  } catch {
    return null;
  }
}

function readPlan(plan: unknown): TransferPlan | null {
  if (!plan || typeof plan !== "object") return null;
  const found = plan as TransferPlan;
  if (!Array.isArray(found.sessions) || typeof found.raceAt !== "number") return null;
  return {
    ...found,
    sessions: found.sessions.map((planned) => ({ ...planned, session: currentSession(planned.session) })),
    done: Array.isArray(found.done) ? found.done : [],
  };
}

function readShoes(shoes: unknown[]): TransferShoe[] {
  return shoes.flatMap((shoe): TransferShoe[] => {
    if (!shoe || typeof shoe !== "object") return [];
    const found = shoe as Partial<TransferShoe>;
    if (typeof found.id !== "number" || typeof found.name !== "string") return [];
    return [{
      id: found.id,
      name: found.name,
      addedAt: typeof found.addedAt === "number" ? found.addedAt : 0,
      startM: typeof found.startM === "number" ? found.startM : 0,
      limitM: typeof found.limitM === "number" && found.limitM > 0 ? found.limitM : 700_000,
      retired: found.retired === true,
      isDefault: found.isDefault === true,
    }];
  });
}

function readSessions(sessions: unknown[]): TransferSession[] {
  return sessions.flatMap((session): TransferSession[] => {
    if (!session || typeof session !== "object") return [];
    const found = session as Partial<TransferSession>;
    const groups = parseGroups(JSON.stringify(found.groups ?? null));
    if (typeof found.id !== "number" || !groups) return [];
    return [{
      id: found.id,
      name: typeof found.name === "string" ? found.name : "",
      createdAt: typeof found.createdAt === "number" ? found.createdAt : 0,
      groups,
    }];
  });
}

function readRoutes(routes: unknown): TransferRoute[] {
  if (!Array.isArray(routes)) return [];
  return routes
    .filter((route): route is TransferRoute =>
      !!route && typeof route === "object"
      && typeof (route as TransferRoute).name === "string"
      && typeof (route as TransferRoute).createdAt === "number"
      && Array.isArray((route as TransferRoute).waypoints)
      && Array.isArray((route as TransferRoute).legs))
    .map((route) => ({ ...route, place: typeof route.place === "string" ? route.place : null }));
}

/**
 * Settings that only mean something on the phone that wrote them.
 *
 * The chosen route is a row id, and row ids are handed out afresh on the
 * other side: carried across, it would put somebody else's route — or none
 * at all — under the first run on the new phone.
 */
const LOCAL_SETTINGS = new Set(["routeId"]);

function readSettingsBag(settings: unknown): Record<string, string> {
  if (!settings || typeof settings !== "object") return {};
  return Object.fromEntries(
    Object.entries(settings as Record<string, unknown>)
      .filter((entry): entry is [string, string] =>
        typeof entry[1] === "string" && !LOCAL_SETTINGS.has(entry[0])),
  );
}

/**
 * What is in the file, in words, to be read before anything is written.
 *
 * Shown in the confirmation because an import is the one operation in the app
 * that arrives from outside it: the only way to know it is the right file is
 * to be told what it holds.
 */
const transferWords = defineStrings({
  fr: {
    runs: (n: number) => `${n} course${n > 1 ? "s" : ""}`,
    points: (count: string) => `${count} points GPS`,
    routes: (n: number) => `${n} parcours`,
    plan: "un programme",
    settings: "tes réglages",
    added: (n: number) => `${n} course${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}`,
    known: (n: number) => `${n} déjà connue${n > 1 ? "s" : ""}`,
    routesAdded: (n: number) => `${n} parcours ajouté${n > 1 ? "s" : ""}`,
    planTaken: "programme repris",
    planKept: "programme ignoré : celui d'ici a été gardé",
    settingsTaken: "réglages repris",
    nothing: "Rien de nouveau.",
  },
  en: {
    runs: (n: number) => `${n} run${n === 1 ? "" : "s"}`,
    points: (count: string) => `${count} GPS points`,
    routes: (n: number) => `${n} route${n === 1 ? "" : "s"}`,
    plan: "a training plan",
    settings: "your settings",
    added: (n: number) => `${n} run${n === 1 ? "" : "s"} added`,
    known: (n: number) => `${n} already here`,
    routesAdded: (n: number) => `${n} route${n === 1 ? "" : "s"} added`,
    planTaken: "plan brought over",
    planKept: "plan skipped: the one on this phone was kept",
    settingsTaken: "settings brought over",
    nothing: "Nothing new.",
  },
});

export function describeTransfer(transfer: Transfer): string {
  const words = transferWords();
  const runs = transfer.runs.length;
  const points = transfer.runs.reduce((total, run) => total + run.points.length, 0);
  return [
    words.runs(runs),
    // Grouped as the language groups thousands, with the narrow spaces some
    // locales use flattened to ordinary ones so the line wraps predictably.
    words.points(points.toLocaleString(intlLocale()).replace(/[\u00a0\u202f]/g, " ")),
    transfer.routes.length > 0 ? words.routes(transfer.routes.length) : null,
    transfer.plan ? words.plan : null,
    Object.keys(transfer.settings).length > 0 ? words.settings : null,
  ].filter(Boolean).join(" · ");
}

/** What an import did, as the receiving phone counts it. */
export interface Restored {
  added: number;
  known: number;
  routes: number;
  plan: boolean;
  settings: boolean;
}

/**
 * The sentence shown once an import is done.
 *
 * Said the same way by both doors a transfer comes in through — the file and
 * the local network — so it is written once, here.
 */
export function restoredSummary(done: Restored, offeredPlan: boolean): string {
  const words = transferWords();
  return [
    done.added > 0 ? words.added(done.added) : null,
    done.known > 0 ? words.known(done.known) : null,
    done.routes > 0 ? words.routesAdded(done.routes) : null,
    done.plan ? words.planTaken : null,
    offeredPlan && !done.plan ? words.planKept : null,
    done.settings ? words.settingsTaken : null,
  ].filter(Boolean).join(" · ") || words.nothing;
}

/** The file itself, dated so two transfers never look alike. */
export function transferFileName(now = Date.now()): string {
  return `tread-transfert-${new Date(now).toISOString().slice(0, 10)}.zip`;
}

/** The single entry inside that zip. */
export const TRANSFER_ENTRY = "tread.json";

/**
 * The file that travels: one json document inside a zip.
 *
 * Compressed because a history is mostly coordinates — a long one runs to
 * hundreds of thousands of points, and the same data deflates to roughly a
 * tenth. That is the difference between a file somebody can send and one
 * they give up on.
 *
 * No checksum of our own. A zip already carries a CRC for every entry and
 * refuses to unpack a damaged one, so a second hash would only restate what
 * the container has already checked.
 */
export async function packTransfer(transfer: Transfer): Promise<string> {
  const zip = new JSZip();
  zip.file(TRANSFER_ENTRY, JSON.stringify(transfer));
  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
}

/** The same file read back, or null for anything that is not one. */
export async function unpackTransfer(base64: string): Promise<Transfer | null> {
  try {
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const entry = zip.file(TRANSFER_ENTRY);
    // A GPX archive is a zip too, and this is where one picked by mistake is
    // turned away: it has courses inside it, not this.
    if (!entry) return null;
    return readTransfer(await entry.async("string"));
  } catch {
    return null;
  }
}
