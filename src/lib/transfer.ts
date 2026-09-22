import JSZip from "jszip";
import type { TrackPoint } from "./geo";
import type { Heart } from "./heart";
import type { Exertion, Goal, PerWeek, PlannedSession } from "./plan";
import type { Weather } from "./weather";
import type { RanBlock } from "./workout";

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

export interface Transfer {
  format: typeof TRANSFER_FORMAT;
  version: number;
  exportedAt: number;
  runs: TransferRun[];
  plan: TransferPlan | null;
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
      runs: file.runs.filter((run): run is TransferRun =>
        !!run && typeof run === "object"
        && typeof (run as TransferRun).startedAt === "number"
        && Array.isArray((run as TransferRun).points)),
      plan: readPlan(file.plan),
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
  return { ...found, done: Array.isArray(found.done) ? found.done : [] };
}

function readSettingsBag(settings: unknown): Record<string, string> {
  if (!settings || typeof settings !== "object") return {};
  return Object.fromEntries(
    Object.entries(settings as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/**
 * What is in the file, in words, to be read before anything is written.
 *
 * Shown in the confirmation because an import is the one operation in the app
 * that arrives from outside it: the only way to know it is the right file is
 * to be told what it holds.
 */
export function describeTransfer(transfer: Transfer): string {
  const runs = transfer.runs.length;
  const points = transfer.runs.reduce((total, run) => total + run.points.length, 0);
  return [
    `${runs} course${runs > 1 ? "s" : ""}`,
    `${points.toLocaleString("fr-FR").replace(/ | /g, " ")} points GPS`,
    transfer.plan ? "un programme" : null,
    Object.keys(transfer.settings).length > 0 ? "tes réglages" : null,
  ].filter(Boolean).join(" · ");
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
