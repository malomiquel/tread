/**
 * Runs deleted on the phone, waiting to be deleted on the account too.
 *
 * The phone sends its history, and the server never deletes what is
 * merely missing from it: a reinstalled phone with an empty database would
 * otherwise empty the account. So a deletion is said out loud instead: the
 * phone keeps the start of every run it deletes (an outing's identity on the
 * server) until a sync has passed it on.
 */

/** The setting the list lives in, on the phone only. */
export const PENDING_DELETIONS_KEY = "accountDeleted";

/** Enough for any real backlog, small enough to stay a setting. */
export const MAX_PENDING = 1000;

/** The list as stored, or none when it is absent or unreadable. */
export function readPending(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is number => Number.isFinite(value)) : [];
  } catch {
    return [];
  }
}

/** One more deletion, kept once, the oldest dropped past the cap. */
export function withPending(raw: string | null | undefined, startedAt: number): string {
  const list = readPending(raw).filter((value) => value !== startedAt);
  list.push(startedAt);
  return JSON.stringify(list.slice(-MAX_PENDING));
}

/** What is left once a sync has passed `sent` on: deletions made meanwhile stay. */
export function afterSync(raw: string | null | undefined, sent: readonly number[]): string {
  const done = new Set(sent);
  return JSON.stringify(readPending(raw).filter((value) => !done.has(value)));
}

/**
 * Runs already on the account, each with the signature it had when it was
 * sent: `{ [startedAt]: signature }`. On the phone only.
 *
 * The whole history used to travel on every sync. Packed and zipped on the
 * JavaScript thread, a long history froze the app for seconds at launch, and
 * past a few dozen runs the request outgrew what the server accepts, so it
 * failed and was tried again, whole, at the next launch. Now only the runs
 * that are new or changed since they were last sent go, a few at a time.
 */
export const SYNCED_RUNS_KEY = "accountSyncedRuns";

export type SyncedRuns = Record<string, string>;

/** The map as stored, or empty when it is absent or unreadable. */
export function readSynced(raw: string | null | undefined): SyncedRuns {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

/**
 * A short fingerprint of what a run says about itself (everything sent but
 * its track) and of how many fixes its track holds. FNV-1a, 32 bits: enough
 * to notice an edit, not meant to resist anybody.
 */
export function runSignature(fields: unknown, pointCount: number): string {
  const text = JSON.stringify(fields) ?? "";
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${pointCount}`;
}

/** The starts of the runs the account does not have as they are now. */
export function runsToSend(
  current: readonly { startedAt: number; signature: string }[],
  synced: SyncedRuns,
): number[] {
  return current.filter((run) => synced[String(run.startedAt)] !== run.signature).map((run) => run.startedAt);
}

/** What stays known once a sync is over: only runs still on the phone. */
export function keepPresent(synced: SyncedRuns, present: Iterable<number>): SyncedRuns {
  const kept: SyncedRuns = {};
  for (const startedAt of present) {
    const signature = synced[String(startedAt)];
    if (signature !== undefined) kept[String(startedAt)] = signature;
  }
  return kept;
}

/**
 * Fixes per request. About an hour at one fix a second: a request stays well
 * under the server's limit, and packing one is short enough not to be felt.
 */
export const MAX_BATCH_POINTS = 5000;

/**
 * Runs grouped so that no group holds more than `maxPoints` fixes, in order.
 * A run longer than that on its own goes alone rather than being split: the
 * server keeps a track whole or not at all.
 */
export function batchRuns<T extends { points: number }>(runs: readonly T[], maxPoints = MAX_BATCH_POINTS): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const run of runs) {
    if (current.length > 0 && size + run.points > maxPoints) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(run);
    size += run.points;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
