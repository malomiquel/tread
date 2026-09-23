import { useSyncExternalStore } from "react";
import { deleteSettings, readSettings, writeSetting } from "./db";
import { goalFromSettings, readGoalKind, type GoalKind, type WeeklyGoal } from "./goals";
import { applyLanguage, readLanguageChoice, type LanguageChoice } from "./language";
import { DEFAULT_PRIVACY_RADIUS, readPrivacyRadius, type PrivacyRadius } from "./privacy";
import { readRunnerProfile, type RunnerProfile } from "./runner";
import { applyUnits, readUnitChoice, type UnitChoice } from "./unitChoice";
import { readReminderWhen, type ReminderWhen } from "./reminders";

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
  /**
   * Kilometres to cover between monday and sunday, in metres, or null for no
   * target at all.
   *
   * A week rather than a month or a day, because a week is the unit training
   * is actually built in: a day is too short to mean anything and a month is
   * long enough to lose. Null is a real answer and the default one — a goal
   * nobody chose is a reproach nobody earned.
   */
  weeklyGoalM: number | null;
  /** What the weekly goal counts: distance, time or climb. */
  goalKind: GoalKind;
  /** The weekly goal in time, in seconds, when the goal counts time. */
  weeklyGoalS: number | null;
  /** The weekly goal in climb, in metres, when the goal counts climb. */
  weeklyGoalClimbM: number | null;
  /**
   * When a planned session is announced, or off.
   *
   * Off by default, and asked for rather than assumed: an app that starts
   * interrupting somebody the day it is installed is an app whose
   * notifications get turned off wholesale a week later.
   */
  reminder: ReminderWhen;
  /**
   * The route to follow, or null to run wherever the legs go.
   *
   * Kept here rather than on the tracker for the same reason the target pace
   * is: it is a decision about how you run, not part of what a run was, and
   * it should still be chosen tomorrow morning.
   */
  routeId: number | null;
  /**
   * The welcome has been seen, and the app may open straight onto itself.
   *
   * Remembered rather than inferred from there being runs: somebody who
   * imported a history or received one from an old phone still has never
   * been told what the app does or why it wants their position.
   */
  welcomed: boolean;
  /** The phone's language, or one of the two the app speaks. */
  language: LanguageChoice;
  /** Pause the run when the runner stops, and resume when they set off. Off by default. */
  autoPause: boolean;
  /** Kilometres or miles, or whatever the phone's region uses. */
  units: UnitChoice;
  /** How much of a shared track is hidden around its start and finish, in metres. */
  privacyRadiusM: PrivacyRadius;
  /** What the runner said about themselves in the welcome, or null if skipped. */
  runner: RunnerProfile | null;
  /**
   * The programme form has been put in front of a runner who came to
   * prepare a race. Once, straight after the welcome: after that the plan
   * tab opens on its usual page, and the form is a tap away like for anyone.
   */
  raceSetupOffered: boolean;
}

const DEFAULTS: Settings = {
  voice: true, targetPaceSKm: null, weeklyGoalM: null, goalKind: "distance", weeklyGoalS: null,
  weeklyGoalClimbM: null, reminder: "off", routeId: null,
  welcomed: false, language: "auto", runner: null, raceSetupOffered: false, autoPause: false, units: "auto", privacyRadiusM: DEFAULT_PRIVACY_RADIUS,
};

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
      weeklyGoalM: readGoal(stored.weeklyGoalM),
      goalKind: readGoalKind(stored.goalKind),
      weeklyGoalS: readTarget(stored.weeklyGoalS),
      weeklyGoalClimbM: readTarget(stored.weeklyGoalClimbM),
      reminder: readReminderWhen(stored.reminder),
      routeId: readId(stored.routeId),
      welcomed: stored.welcomed === "true",
      language: readLanguageChoice(stored.language),
      runner: readRunnerProfile(stored.runner),
      raceSetupOffered: stored.raceSetupOffered === "true",
      autoPause: stored.autoPause === "true",
      units: readUnitChoice(stored.units),
      privacyRadiusM: readPrivacyRadius(stored.privacyRadiusM),
    });
  } catch {
    // Unreadable settings are not worth failing a launch over.
    publish(DEFAULTS);
  }
  applyLanguage(current.language);
  applyUnits(current.units);
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

/**
 * A stored weekly goal, or null. Anything unreadable, or so large it could
 * only be a mistake, reads as no goal: a target nobody can reach is worse
 * than none.
 */
function readGoal(raw: string | undefined): number | null {
  if (!raw || raw === "null") return null;
  const metres = Number(raw);
  return Number.isFinite(metres) && metres > 0 && metres <= 500_000 ? metres : null;
}

/** A stored row id, or null. A route that has been deleted reads as none. */
function readId(raw: string | undefined): number | null {
  if (!raw || raw === "null") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Hide this much of a shared track around its start and finish. */
export async function setPrivacyRadius(radius: PrivacyRadius): Promise<void> {
  await store({ ...current, privacyRadiusM: radius }, "privacyRadiusM", String(radius));
}

/** Show kilometres or miles, or follow the phone. Takes effect at once. */
export async function setUnitChoice(choice: UnitChoice): Promise<void> {
  applyUnits(choice);
  await store({ ...current, units: choice }, "units", choice);
}

/** Pause by itself at a stop, or only when asked. */
export async function toggleAutoPause(): Promise<void> {
  await store({ ...current, autoPause: !current.autoPause }, "autoPause", String(!current.autoPause));
}

/** Speak the kilometres, or stop speaking them. */
export async function toggleVoice(): Promise<void> {
  await store({ ...current, voice: !current.voice }, "voice", String(!current.voice));
}

/** Set the pace to hold, or null to run free. */
export async function setTargetPace(seconds: number | null): Promise<void> {
  await store({ ...current, targetPaceSKm: seconds }, "targetPaceSKm", String(seconds));
}

/** Set the week's distance to aim for, in metres, or null to drop the goal. */
export async function setWeeklyGoal(metres: number | null): Promise<void> {
  await store({ ...current, weeklyGoalM: metres }, "weeklyGoalM", String(metres));
}

/**
 * Set the weekly goal in any measure, or null to drop it. Each measure keeps
 * its own figure, so switching back finds the old one where it was left.
 */
export async function setGoal(kind: GoalKind, value: number | null): Promise<void> {
  const key = kind === "time" ? "weeklyGoalS" : kind === "climb" ? "weeklyGoalClimbM" : "weeklyGoalM";
  await store({ ...current, [key]: value, goalKind: kind }, key, String(value));
  await store({ ...current, goalKind: kind }, "goalKind", kind);
}

/** The weekly goal in force, or null. */
export const weeklyGoal = (settings: Settings = current): WeeklyGoal | null => goalFromSettings(settings);

/** Say when planned sessions are announced, or "off" to stop announcing them. */
export async function setReminder(when: ReminderWhen): Promise<void> {
  await store({ ...current, reminder: when }, "reminder", when);
}

/** Follow a drawn route, or null to run free. */
export async function setRoute(id: number | null): Promise<void> {
  await store({ ...current, routeId: id }, "routeId", String(id));
}

/** The welcome is behind us: the app opens on its tabs from now on. */
export async function markWelcomed(): Promise<void> {
  await store({ ...current, welcomed: true }, "welcomed", "true");
}

/**
 * Development only: forget the welcome and everything it asked, so the next
 * frame shows it again from the first page.
 *
 * The rows are deleted rather than set to false, so the app is in exactly the
 * state a fresh install leaves it in — which is the state being tested.
 */
export async function forgetWelcome(): Promise<void> {
  publish({ ...current, welcomed: false, runner: null, raceSetupOffered: false });
  await deleteSettings(["welcomed", "runner", "raceSetupOffered"]).catch(() => undefined);
}

/** Remember what the runner said about themselves. */
export async function setRunner(profile: RunnerProfile): Promise<void> {
  await store({ ...current, runner: profile }, "runner", JSON.stringify(profile));
}

/** The programme form has been offered once after the welcome. */
export async function markRaceSetupOffered(): Promise<void> {
  await store({ ...current, raceSetupOffered: true }, "raceSetupOffered", "true");
}

/** Speak the phone's language, or one chosen here. Takes effect at once. */
export async function setLanguageChoice(choice: LanguageChoice): Promise<void> {
  applyLanguage(choice);
  await store({ ...current, language: choice }, "language", choice);
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
