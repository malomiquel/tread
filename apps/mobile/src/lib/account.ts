import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { fingerprint } from "@tread/core/backup";
import { afterSync, PENDING_DELETIONS_KEY, readPending } from "@tread/core/sync";
import { packTransfer } from "@tread/core/transfer";
import { getUnitSystem } from "@tread/core/units";
import { dataSummary, everythingForTransfer, readSettings, writeSetting } from "./db";

/**
 * The Tread account: the same one as on the web, so what this phone records
 * can be read on a large screen.
 *
 * The phone stays the source and keeps working without it. Signed in, it
 * sends its whole state (the file "Switch phones" writes) to the web app
 * after each run and when it comes back to the foreground, if anything
 * changed; the server keeps one copy of each run, known by when it started.
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

let running: Promise<SyncOutcome> | null = null;

/**
 * Send everything to the account. `force` sends even when nothing changed
 * since the last time. One at a time; never throws.
 */
export function syncNow(force = false): Promise<SyncOutcome> {
  running ??= (async (): Promise<SyncOutcome> => {
    try {
      const cookie = await authClient.getCookie();
      if (!cookie) return { kind: "signedOut" };
      // The units count too: the web reads them from here.
      const current = `${fingerprint(await dataSummary())}|${getUnitSystem()}`;
      const last = await lastSync();
      if (!force && last?.fingerprint === current) return { kind: "unchanged" };

      const archive = await packTransfer(await everythingForTransfer());
      const deleted = readPending((await readSettings())[PENDING_DELETIONS_KEY]);
      const response = await fetch(`${API_URL}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        // The cookie is set by hand above; letting fetch add its own would clash with it.
        credentials: "omit",
        // The units this phone shows, worked out: "Automatic" follows the
        // phone's region, which the web cannot see for itself.
        body: JSON.stringify({ archive, deleted, units: getUnitSystem() }),
      });
      if (response.status === 401) return { kind: "signedOut" };
      if (!response.ok) return { kind: "failed" };
      const result = (await response.json()) as SyncResult;
      // Read again: a run deleted while this was on its way stays pending.
      await writeSetting(PENDING_DELETIONS_KEY, afterSync((await readSettings())[PENDING_DELETIONS_KEY], deleted));
      await writeSetting(SYNC_KEY, JSON.stringify({
        at: Date.now(), fingerprint: `${fingerprint(await dataSummary())}|${getUnitSystem()}`,
      } satisfies SyncState));
      return { kind: "done", result };
    } catch {
      return { kind: "failed" };
    } finally {
      running = null;
    }
  })();
  return running;
}
