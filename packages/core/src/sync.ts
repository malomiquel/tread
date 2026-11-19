/**
 * Runs deleted on the phone, waiting to be deleted on the account too.
 *
 * The phone sends its whole history, and the server never deletes what is
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
