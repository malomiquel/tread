import { useSyncExternalStore } from "react";
import { customIdOf, toSession, type CustomSession, type DraftGroup } from "./customSession";
import { deleteCustomSession, listCustomSessions, saveCustomSession } from "./db";
import { sessionById, type Session } from "./workout";

/**
 * The runner's own sessions, held in memory like the settings are.
 *
 * Read once at launch and kept current by the writes below, because a
 * session is looked up by id synchronously — when one is chosen, and when a
 * finished run is opened — and those lookups cannot wait on a query.
 */
let sessions: CustomSession[] = [];
const listeners = new Set<() => void>();

function publish(next: CustomSession[]): void {
  sessions = next;
  for (const listener of listeners) listener();
}

export async function loadCustomSessions(): Promise<void> {
  try {
    publish(await listCustomSessions());
  } catch {
    // The catalogue still works without them.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCustomSessions(): CustomSession[] {
  return useSyncExternalStore(subscribe, () => sessions, () => sessions);
}

export const customSession = (id: number): CustomSession | null =>
  sessions.find((session) => session.id === id) ?? null;

/** Any session by id: the catalogue's, or one the runner wrote. */
export function findSession(id: string | null): Session | null {
  const custom = customIdOf(id);
  if (custom === null) return sessionById(id);
  const found = customSession(custom);
  return found ? toSession(found) : null;
}

export async function storeCustomSession(id: number | null, name: string, groups: DraftGroup[]): Promise<number> {
  const saved = await saveCustomSession(id, name, groups);
  await loadCustomSessions();
  return saved;
}

export async function removeCustomSession(id: number): Promise<void> {
  await deleteCustomSession(id);
  await loadCustomSessions();
}
