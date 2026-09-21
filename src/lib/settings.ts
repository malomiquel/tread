import { useSyncExternalStore } from "react";
import { readSettings, writeSetting } from "./db";

export interface Settings {
  /** Speak each kilometre out loud. The buzz happens either way. */
  voice: boolean;
  /**
   * The pace to hold, in seconds per kilometre, or null to run free.
   *
   * Kept in settings rather than on the session, because a target belongs to
   * the runner and not to the plan: the same five-by-four-hundred is a
   * different session at four minutes a kilometre than at six.
   */
  targetPaceSKm: number | null;
}

const DEFAULTS: Settings = { voice: true, targetPaceSKm: null };

/**
 * Settings live in SQLite but are read synchronously from a cache, because
 * the tracker consults them on every GPS fix and cannot await a query there.
 * The cache is filled once at startup by loadSettings().
 */
let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

function publish(next: Settings): void {
  current = next;
  for (const listener of listeners) listener();
}

export async function loadSettings(): Promise<void> {
  try {
    const stored = await readSettings();
    publish({
      voice: stored.voice ? stored.voice === "true" : DEFAULTS.voice,
      targetPaceSKm: readTarget(stored.targetPaceSKm),
    });
  } catch {
    // Unreadable settings are not worth failing a launch over.
    publish(DEFAULTS);
  }
}

export const getSettings = (): Settings => current;

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

/**
 * A stored pace, or null. Anything unreadable reads as no target, because a
 * wrong target would have the app correct a runner towards a number nobody
 * chose.
 */
function readTarget(raw: string | undefined): number | null {
  if (!raw || raw === "null") return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** Speak the kilometres, or stop speaking them. */
export async function toggleVoice(): Promise<void> {
  await store({ ...current, voice: !current.voice }, "voice", String(!current.voice));
}

/** Set the pace to hold, or null to run free. */
export async function setTargetPace(seconds: number | null): Promise<void> {
  await store({ ...current, targetPaceSKm: seconds }, "targetPaceSKm", String(seconds));
}

/** The cache moves first, so the interface reacts before the disk answers. */
async function store(next: Settings, key: string, value: string): Promise<void> {
  publish(next);
  try {
    await writeSetting(key, value);
  } catch {
    /* the change still holds for this session */
  }
}
