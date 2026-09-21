import { useSyncExternalStore } from "react";
import { readSettings, writeSetting } from "./db";

export interface Settings {
  /** Speak each kilometre out loud. The buzz happens either way. */
  voice: boolean;
  /** Pause on its own when you stop moving, resume when you set off again. */
  autoPause: boolean;
}

const DEFAULTS: Settings = { voice: true, autoPause: true };

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
      autoPause: stored.autoPause ? stored.autoPause === "true" : DEFAULTS.autoPause,
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

/** Flip one setting, updating the cache first so the interface reacts at once. */
export async function toggleSetting(key: keyof Settings): Promise<void> {
  const next = { ...current, [key]: !current[key] };
  publish(next);
  try {
    await writeSetting(key, String(next[key]));
  } catch {
    /* the change still holds for this session */
  }
}
