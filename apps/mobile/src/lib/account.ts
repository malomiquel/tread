import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { fingerprint } from "@tread/core/backup";
import {
  afterSync, batchRuns, keepPresent, PENDING_DELETIONS_KEY, readPending, readSynced, runSignature, runsToSend,
  SYNCED_RUNS_KEY, type SyncedRuns,
} from "@tread/core/sync";
import { packTransfer, travellingSettings } from "@tread/core/transfer";
import { getUnitSystem } from "@tread/core/units";
import { dataSummary, deleteSettings, readSettings, runsForSync, transferExtras, transferRuns, writeSetting } from "./db";

/**
 * The Tread account: the same one as on the web, so what this phone records
 * can be read on a large screen.
 *
 * The phone stays the source and keeps working without it. Signed in, it
 * sends its state (the file "Switch phones" writes) to the web app after each
 * run, at launch and when it goes to the background, if anything changed;
 * the server keeps one copy of each run, known by when it started. Only the
 * runs new or changed since they were last sent travel, a few at a time
 * (see `SYNCED_RUNS_KEY`); the rest of the state goes with each request.
 *
 * The session lives in the keychain (SecureStore), never in plain storage.
 */

/**
 * Where the web app answers: the deployed one in a release build, the Mac's
 * in development (a simulator reaches it at localhost). EXPO_PUBLIC_API_URL
 * overrides both, for a real phone against the Mac on the same network.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? "http://localhost:3020" : "https://tread-web-omega.vercel.app")
).replace(/\/$/, "");

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "tread",
      storagePrefix: "tread",
      storage: SecureStore,
      // The server names its cookies "tread.…" (auth.ts, advanced.cookiePrefix).
      cookiePrefix: "tread",
    }),
  ],
});

/** When this phone last sent its history, and what it held then. Kept on this phone only. */
export const SYNC_KEY = "accountSync";

export interface SyncState {
  at: number;
  fingerprint: string;
}

export async function lastSync(): Promise<SyncState | null> {
  const raw = (await readSettings())[SYNC_KEY];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return typeof parsed.at === "number" && typeof parsed.fingerprint === "string" ? (parsed as SyncState) : null;
  } catch {
    return null;
  }
}

/** What the server said it did. */
export interface SyncResult {
  added: number;
  updated: number;
}

export type SyncOutcome =
  | { kind: "done"; result: SyncResult }
  | { kind: "signedOut" }
  | { kind: "unchanged" }
  | { kind: "failed" };

/**
 * How a sync is asked for. `auto`: only if something changed, and not again
 * soon after a failure. `now`: whatever, the runner asked. `fresh`: as if
 * the account had nothing yet, just after signing in, since it may be
 * another account than the last one.
 */
export type SyncMode = "auto" | "now" | "fresh";

/** After a failure, automatic syncs wait this long before trying again. */
const RETRY_AFTER_MS = 10 * 60_000;

let running: Promise<SyncOutcome> | null = null;
let failedAt = 0;

/** Forget what was sent, on signing out: the next account starts from nothing. */
export async function forgetSync(): Promise<void> {
  await deleteSettings([SYNC_KEY, SYNCED_RUNS_KEY]).catch(() => undefined);
}

/** Send what the account lacks. One at a time; never throws. */
export function syncNow(mode: SyncMode = "auto"): Promise<SyncOutcome> {
  running ??= (async (): Promise<SyncOutcome> => {
    try {
      const cookie = await authClient.getCookie();
      if (!cookie) return { kind: "signedOut" };
      if (mode === "auto" && Date.now() - failedAt < RETRY_AFTER_MS) return { kind: "failed" };
      // The units count too: the web reads them from here.
      const current = `${fingerprint(await dataSummary())}|${getUnitSystem()}`;
      const last = await lastSync();
      if (mode === "auto" && last?.fingerprint === current) return { kind: "unchanged" };

      const stored = await readSettings();
      const synced: SyncedRuns = mode === "fresh" ? {} : readSynced(stored[SYNCED_RUNS_KEY]);
      const runs = (await runsForSync()).map((run) => ({ ...run, signature: runSignature(run.fields, run.points) }));
      const due = new Set(runsToSend(runs.map((run) => ({ startedAt: run.fields.startedAt, signature: run.signature })), synced));
      const batches = batchRuns(runs.filter((run) => due.has(run.fields.startedAt)));
      // Nothing new to carry still sends the rest: a plan, a renamed route.
      if (batches.length === 0) batches.push([]);

      const extras = await transferExtras();
      const base = { ...extras, settings: travellingSettings(extras.settings) };
      const deleted = readPending(stored[PENDING_DELETIONS_KEY]);
      const total: SyncResult = { added: 0, updated: 0 };

      for (const [index, batch] of batches.entries()) {
        const archive = await packTransfer({ ...base, runs: await transferRuns(batch.map((run) => run.id)) });
        const response = await fetch(`${API_URL}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          // The cookie is set by hand above; letting fetch add its own would clash with it.
          credentials: "omit",
          // The units this phone shows, worked out: "Automatic" follows the
          // phone's region, which the web cannot see for itself.
          body: JSON.stringify({ archive, deleted: index === 0 ? deleted : [], units: getUnitSystem() }),
        });
        if (response.status === 401) return { kind: "signedOut" };
        if (!response.ok) {
          failedAt = Date.now();
          return { kind: "failed" };
        }
        const result = (await response.json()) as SyncResult;
        total.added += result.added;
        total.updated += result.updated;
        if (index === 0) {
          // Read again: a run deleted while this was on its way stays pending.
          await writeSetting(PENDING_DELETIONS_KEY, afterSync((await readSettings())[PENDING_DELETIONS_KEY], deleted));
        }
        // Kept after every request, so a sync cut short picks up where it stopped.
        for (const run of batch) synced[String(run.fields.startedAt)] = run.signature;
        await writeSetting(SYNCED_RUNS_KEY, JSON.stringify(synced));
      }

      await writeSetting(SYNCED_RUNS_KEY, JSON.stringify(keepPresent(synced, runs.map((run) => run.fields.startedAt))));
      await writeSetting(SYNC_KEY, JSON.stringify({
        at: Date.now(), fingerprint: `${fingerprint(await dataSummary())}|${getUnitSystem()}`,
      } satisfies SyncState));
      failedAt = 0;
      return { kind: "done", result: total };
    } catch {
      failedAt = Date.now();
      return { kind: "failed" };
    } finally {
      running = null;
    }
  })();
  return running;
}
