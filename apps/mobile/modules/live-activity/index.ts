import { requireOptionalNativeModule } from "expo";

/** Mirrors RunActivityState in LiveActivityModule.swift. */
export interface RunActivityState {
  /**
   * When the clock should count from, in milliseconds, or null while paused.
   * Not an elapsed time: the system ticks on its own from this instant, which
   * is what lets the activity stay accurate without constant updates.
   */
  clockOriginMs: number | null;
  /** The elapsed time as text, shown while the clock is stopped. */
  elapsed: string;
  distance: string;
  /** "km" or "mi". */
  distanceUnit: string;
  pace: string;
  /** "/km" or "/mi". */
  paceUnit: string;
}

interface LiveActivityModule {
  isAvailable(): boolean;
  start(title: string, state: RunActivityState): Promise<string | null>;
  update(id: string, state: RunActivityState): Promise<void>;
  stop(): Promise<void>;
}

/**
 * null wherever the native side is absent: Android, web, and Expo Go, which
 * cannot host a widget extension. Asking for it optionally keeps that an
 * ordinary "unavailable" rather than a crash at import.
 */
export default requireOptionalNativeModule<LiveActivityModule>("LiveActivity");
