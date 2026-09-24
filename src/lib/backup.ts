/**
 * The safety copy: the app's whole data, written by itself to the runner's
 * own cloud — iCloud Drive on an iPhone, a folder of their choosing (Google
 * Drive, typically) on Android.
 *
 * No Tread account and no Tread server: the copy lives where the runner's
 * other files live, and it is the same file "Switch phones" makes, so it can
 * be opened by hand on any phone. Several are kept, newest first, so a copy
 * damaged by an interrupted write never takes the history down with it.
 */

/** Copies kept; older ones are removed as new ones arrive. */
export const KEEP_BACKUPS = 7;

const PREFIX = "tread-copie-";
const SUFFIX = ".zip";

/** "tread-copie-2026-09-24-0715.zip": sortable by name, readable by eye. */
export function backupName(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${PREFIX}${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${SUFFIX}`;
}

/** When a copy was made, from its name, or null for any other file. */
export function backupTime(name: string): number | null {
  const match = name.match(/^tread-copie-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.zip$/);
  if (!match) return null;
  const [, year, month, day, hours, minutes] = match.map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

/** The copies among a folder's files, newest first. */
export function backupsIn(names: readonly string[]): string[] {
  return names
    .filter((name) => backupTime(name) !== null)
    .sort((a, b) => (backupTime(b) ?? 0) - (backupTime(a) ?? 0));
}

/** The copies to remove once a new one is written. */
export const backupsToDrop = (names: readonly string[], keep = KEEP_BACKUPS): string[] =>
  backupsIn(names).slice(keep);

/**
 * A cheap summary of the data, so a copy is only written when something
 * changed: how many of each thing there are, and the latest of each.
 */
export function fingerprint(counts: Record<string, number | null>): string {
  return Object.keys(counts).sort().map((key) => `${key}:${counts[key] ?? "-"}`).join("|");
}

/**
 * Whether a copy is due: something changed since the last one, and the last
 * one is not so recent that writing again would only churn the cloud.
 */
export function copyDue(
  last: { at: number; fingerprint: string } | null,
  now: number,
  current: string,
  minGapMs = 2 * 60_000,
): boolean {
  if (last === null) return true;
  if (last.fingerprint === current) return false;
  return now - last.at >= minGapMs;
}
