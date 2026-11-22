import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { backupName, backupsIn, backupsToDrop, backupTime, copyDue, fingerprint } from "@tread/core/backup";
import ZipFile from "zip-file";
import {
  dataSummary, everythingForTransfer, listRuns, readSettings, restoreTransfer, transferExtras, transferRunOf, writeSetting,
} from "./db";
import { refreshReminders } from "./planReminders";
import { loadCustomSessions } from "./sessionLibrary";
import { loadSettings } from "./settings";
import { packTransfer, restoredSummary, TRANSFER_ENTRY, unpackTransfer, type Transfer } from "@tread/core/transfer";

/**
 * Where the safety copy goes, and the writing and reading of it.
 *
 * On an iPhone, the app's own folder in the runner's iCloud Drive: "Tread",
 * visible in the Files app, synced by iOS, no sign-in of ours. On Android,
 * a folder the runner picks once — in Google Drive, typically — which the
 * system lets the app keep writing to.
 */

type Cloud = typeof import("react-native-cloud-storage");

let cloudModule: Cloud | null | undefined;

/** The iCloud library, or null where its native half is missing. */
function cloud(): Cloud | null {
  if (cloudModule !== undefined) return cloudModule;
  if (Platform.OS !== "ios") return (cloudModule = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cloudModule = require("react-native-cloud-storage") as Cloud;
  } catch {
    cloudModule = null;
  }
  return cloudModule;
}

/** Settings keys, all local to this phone: another phone has its own cloud. */
const FOLDER_KEY = "backupFolder";
const LAST_KEY = "backupLast";

export type CopyTarget =
  | { kind: "icloud" }
  | { kind: "folder"; uri: string }
  | { kind: "none"; why: "noICloud" | "noFolder" };

/** Where copies would go right now. */
export async function copyTarget(): Promise<CopyTarget> {
  if (Platform.OS === "ios") {
    const api = cloud();
    const available = api ? await api.CloudStorage.isCloudAvailable().catch(() => false) : false;
    return available ? { kind: "icloud" } : { kind: "none", why: "noICloud" };
  }
  const uri = (await readSettings())[FOLDER_KEY];
  return uri ? { kind: "folder", uri } : { kind: "none", why: "noFolder" };
}

/** Android: let the runner pick the folder copies go to. Null when they cancel. */
export async function chooseCopyFolder(): Promise<string | null> {
  try {
    const folder = await Directory.pickDirectoryAsync();
    await writeSetting(FOLDER_KEY, folder.uri);
    return folder.uri;
  } catch {
    return null;
  }
}

/** The names of the copies already made, newest first. */
async function listCopies(target: CopyTarget): Promise<string[]> {
  if (target.kind === "icloud") {
    const api = cloud();
    if (!api) return [];
    const names = await api.CloudStorage.readdir("/", api.CloudStorageScope.Documents).catch(() => []);
    return backupsIn(names);
  }
  if (target.kind === "folder") {
    return backupsIn(new Directory(target.uri).list().map((entry) => entry.name));
  }
  return [];
}

/** A local path without its scheme, as the iCloud library wants it. */
const localPath = (file: File) => file.uri.replace(/^file:\/\//, "");

/** Put the zip staged at `staged` where copies go, under `name`. */
async function writeCopy(target: CopyTarget, name: string, staged: File): Promise<void> {
  if (target.kind === "icloud") {
    const api = cloud();
    if (!api) throw new Error("iCloud unavailable");
    await api.CloudStorage.uploadFile(`/${name}`, localPath(staged), { mimeType: "application/zip" }, api.CloudStorageScope.Documents);
    return;
  }
  if (target.kind === "folder") {
    // Read and written natively: the bytes pass through, nothing is computed on them.
    await new Directory(target.uri).createFile(name, "application/zip").write(await staged.bytes());
  }
}

/** Text gathered before each write, so a long history is a few dozen writes, not one per run. */
const WRITE_CHUNK = 512 * 1024;

/**
 * The transfer file's JSON, written run by run into `file`.
 *
 * The same text `JSON.stringify` of the whole would give, without ever
 * holding it: stringifying a long history in one go blocked the JavaScript
 * thread for seconds, and every run awaited here lets a touch through.
 */
async function writeTransferJson(file: File): Promise<void> {
  const head = JSON.stringify({ ...(await transferExtras()), runs: [] });
  const open = '"runs":[]}';
  if (!head.endsWith(open)) throw new Error("unexpected transfer shape");
  if (file.exists) file.delete();
  file.create();
  let pending = head.slice(0, -2);
  let first = true;
  for (const run of await listRuns()) {
    pending += (first ? "" : ",") + JSON.stringify(await transferRunOf(run));
    first = false;
    if (pending.length >= WRITE_CHUNK) {
      await file.write(pending, { append: true });
      pending = "";
    }
  }
  await file.write(`${pending}]}`, { append: true });
}

/**
 * The whole state as a zip file in the cache, named `name`.
 *
 * Zipped natively where the app has its zip module, off the JavaScript
 * thread; otherwise (Expo Go, an older build) in JavaScript, as before.
 */
async function stageCopy(name: string): Promise<File> {
  const staged = new File(Paths.cache, name);
  if (staged.exists) staged.delete();
  if (ZipFile) {
    const json = new File(Paths.cache, TRANSFER_ENTRY);
    try {
      await writeTransferJson(json);
      await ZipFile.zipFile(json.uri, TRANSFER_ENTRY, staged.uri);
    } finally {
      if (json.exists) json.delete();
    }
    return staged;
  }
  await staged.write(await packTransfer(await everythingForTransfer()), { encoding: "base64" });
  return staged;
}

async function removeCopy(target: CopyTarget, name: string): Promise<void> {
  if (target.kind === "icloud") {
    const api = cloud();
    await api?.CloudStorage.unlink(`/${name}`, api.CloudStorageScope.Documents).catch(() => undefined);
    return;
  }
  if (target.kind === "folder") {
    const found = new Directory(target.uri).list().find((entry) => entry.name === name);
    if (found instanceof File) found.delete();
  }
}

export interface CopyState {
  target: CopyTarget;
  /** When the newest copy there was made, or null for none yet. */
  lastAt: number | null;
}

/** What Settings shows: where copies go, and how fresh the last one is. */
export async function copyState(): Promise<CopyState> {
  const target = await copyTarget();
  const newest = (await listCopies(target).catch(() => []))[0];
  return { target, lastAt: newest ? backupTime(newest) : null };
}

let writing: Promise<boolean> | null = null;

/**
 * Write a copy now if anything changed since the last one; `force` writes one
 * whatever. Returns whether a copy was written. One at a time.
 */
export function makeCopy(force = false): Promise<boolean> {
  writing ??= (async () => {
    try {
      const target = await copyTarget();
      if (target.kind === "none") return false;
      const now = Date.now();
      const current = fingerprint(await dataSummary());
      const stored = (await readSettings())[LAST_KEY];
      const last = stored ? JSON.parse(stored) as { at: number; fingerprint: string } : null;
      if (!force && !copyDue(last, now, current)) return false;

      const name = backupName(now);
      const staged = await stageCopy(name);
      try {
        await writeCopy(target, name, staged);
      } finally {
        if (staged.exists) staged.delete();
      }
      for (const old of backupsToDrop(await listCopies(target))) await removeCopy(target, old);
      await writeSetting(LAST_KEY, JSON.stringify({ at: now, fingerprint: current }));
      return true;
    } catch {
      return false;
    } finally {
      writing = null;
    }
  })();
  return writing;
}

/**
 * The newest copy's contents, for restoring, or null when there is none.
 *
 * A copy that is there but cannot be read — a download that failed, a file
 * cut short — throws instead: "no copy" said about a copy that exists sends
 * somebody away from the one thing that would have brought their runs back.
 */
export async function readNewestCopy(): Promise<{ transfer: Transfer; at: number } | null> {
  const target = await copyTarget();
  const newest = (await listCopies(target))[0];
  if (!newest) return null;
  let base64: string;
  if (target.kind === "icloud") {
    const api = cloud();
    if (!api) return null;
    const staged = new File(Paths.cache, newest);
    await api.CloudStorage.downloadFile(`/${newest}`, localPath(staged), api.CloudStorageScope.Documents);
    base64 = await staged.base64();
    staged.delete();
  } else if (target.kind === "folder") {
    const found = new Directory(target.uri).list().find((entry) => entry.name === newest);
    if (!(found instanceof File)) return null;
    base64 = await found.base64();
  } else {
    return null;
  }
  const transfer = await unpackTransfer(base64);
  if (!transfer) throw new Error("unreadable copy");
  return { transfer, at: backupTime(newest) ?? 0 };
}

/**
 * Bring the newest copy back in, merged with what is here: runs already here
 * are kept as they are, missing ones added. Returns the sentence to show, or
 * null when there was no copy to read.
 */
export async function restoreNewestCopy(): Promise<string | null> {
  const copy = await readNewestCopy();
  if (!copy) return null;
  const done = await restoreTransfer(copy.transfer);
  // The caches came from this phone's state before the copy arrived.
  await loadSettings();
  await loadCustomSessions();
  await refreshReminders({ force: true });
  return restoredSummary(done, copy.transfer.plan !== null);
}

/** Key marking that an empty app has already been offered its copy back. */
const OFFERED_KEY = "backupRestoreOffered";

/**
 * A copy worth offering back: this phone has no runs yet (a reinstall, a new
 * iPhone) and the cloud has a copy with some. Asked once per install.
 */
export async function copyToOffer(): Promise<{ runs: number; at: number } | null> {
  try {
    if ((await readSettings())[OFFERED_KEY] === "true") return null;
    if ((await listRuns()).length > 0) return null;
    // A copy that could not be read is offered again at the next launch:
    // only an answer, a copy or none, settles the question.
    const copy = await readNewestCopy();
    await writeSetting(OFFERED_KEY, "true");
    return copy && copy.transfer.runs.length > 0 ? { runs: copy.transfer.runs.length, at: copy.at } : null;
  } catch {
    return null;
  }
}
