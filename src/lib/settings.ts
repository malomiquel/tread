import { useSyncExternalStore } from "react";
import { readSettings, writeSetting } from "./db";

export interface Settings {
  /** Speak each kilometre out loud. The buzz happens either way. */
  voice: boolean;
  /** Pause on its own when you stop moving, resume when you set off again. */
  autoPause: boolean;
  /**
   * Copy each finished run into Apple Health. Off until asked for: it sends
   * data out of the app, so it is the user's call rather than a default.
   */
  healthSync: boolean;
}

const DEFAULTS: Settings = { voice: true, autoPause: true, healthSync: false };

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
      healthSync: stored.healthSync ? stored.healthSync === "true" : DEFAULTS.healthSync,
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
  await setSetting(key, !current[key]);
}

/** Set one setting outright, for the cases where the new value is not a flip. */
export async function setSetting(key: keyof Settings, value: boolean): Promise<void> {
  const next = { ...current, [key]: value };
  publish(next);
  try {
    await writeSetting(key, String(value));
  } catch {
    /* the change still holds for this session */
  }
}
