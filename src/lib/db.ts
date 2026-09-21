import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { autoName } from "./format";
import { elevationGainM, fastestKmS, paceSecPerKm, segments, totalDistanceM, type TrackPoint } from "./geo";
import {
  normaliseDays, type Done, type Exertion, type Goal, type PerWeek, type PlannedSession,
} from "./plan";
import type { RanBlock } from "./workout";

/**
 * A single connection, opened on first real use rather than at module load.
 * The tracker writes points from a background task, outside any React tree,
 * so it needs direct access rather than a context.
 *
 * Opening lazily matters for a precise reason: on web, expo-sqlite relies on a
 * WASM backend that requires SharedArrayBuffer, which is unavailable without
 * dedicated server headers. Calling openDatabaseSync() at module load would
 * throw before React mounts anything, and therefore before initDb()'s caller
 * could catch it. Deferring the call turns that crash into an ordinary
 * exception, already handled by the root layout's error screen.
 */
let instance: SQLiteDatabase | null = null;

function getDb(): SQLiteDatabase {
  if (Platform.OS === "web") {
    throw new Error(
      "Le suivi de course n'est pas disponible sur web : le GPS et le stockage local demandent l'app mobile (iOS ou Android).",
    );
  }
  // The file keeps its original name even though the app is now called Tread:
  // renaming it would hide runs already recorded on a device, for a purely
  // cosmetic gain nobody ever sees.
  if (!instance) instance = openDatabaseSync("running.db");
  return instance;
}

export interface Run {
  id: number;
  startedAt: number;
  endedAt: number | null;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  name: string | null;
  elevationGainM: number | null;
  /** Duration of this run's fastest kilometre, in seconds. */
  fastestKmS: number | null;
  /**
   * Identifier of this run's copy in Apple Health, or null while it has none.
   * Storing it keeps the mirror honest in both directions: the run is never
   * written twice, and deleting it here can delete it there too.
   */
  healthUuid: string | null;
  /** Steps per minute held over the run, or null when unmeasured. */
  cadenceSpm: number | null;
  /**
   * How hard it felt, said by the runner afterwards.
   *
   * The only thing in this table the app could not have measured, and the
   * only channel through which a programme learns that it asked too much.
   */
  exertion: Exertion | null;
  /** The structured session this run followed, or null for a free run. */
  sessionId: string | null;
  /** Each block as it was actually run. Empty for a free run. */
  blocks: RanBlock[];
}

/** Shape the SQL layer returns, before mapping to camelCase. */
interface RunRow {
  id: number;
  started_at: number;
  ended_at: number | null;
  distance_m: number;
  duration_s: number;
  avg_pace_s_km: number | null;
  name: string | null;
  elevation_gain_m: number | null;
  fastest_km_s: number | null;
  health_uuid: string | null;
  session_id: string | null;
  session_blocks: string | null;
  cadence_spm: number | null;
  exertion: number | null;
}

const toRun = (row: RunRow): Run => ({
  id: row.id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  distanceM: row.distance_m,
  durationS: row.duration_s,
  avgPaceSKm: row.avg_pace_s_km,
  name: row.name,
  elevationGainM: row.elevation_gain_m,
  fastestKmS: row.fastest_km_s,
  healthUuid: row.health_uuid,
  cadenceSpm: row.cadence_spm,
  exertion: ([1, 2, 3, 4, 5] as const).find((n) => n === row.exertion) ?? null,
  sessionId: row.session_id,
  // Stored as one json column rather than its own table: the blocks are only
  // ever read with the run they belong to, and never queried across runs.
  // A table would buy joins nobody needs and cost a migration nobody wants.
  blocks: parseBlocks(row.session_blocks),
});

function parseBlocks(raw: string | null): RanBlock[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RanBlock[]) : [];
  } catch {
    // Unreadable is the same as absent: a run is worth keeping even when the
    // detail of its session is not.
    return [];
  }
}

const SCHEMA_VERSION = 10;

/**
 * The plan's two tables, written once and used twice — by a fresh install and
 * by a device that already holds runs. They are worth stating together: the
 * generated sessions are stored rather than regenerated, for the same reason
 * a finished run keeps its own blocks. A programme that rewrote itself behind
 * a runner because the generator was improved mid-plan would be worse than no
 * programme at all.
 *
 * No date is stored anywhere here. Dates are laid out afresh on every read,
 * which is what lets a missed week slide.
 */
const PLAN_TABLES = `
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY,
    goal TEXT NOT NULL,
    race_at INTEGER NOT NULL,
    weeks INTEGER NOT NULL,
    per_week INTEGER NOT NULL,
    target_time_s REAL NOT NULL,
    created_at INTEGER NOT NULL,
    sessions TEXT NOT NULL,
    days TEXT
  );
  CREATE TABLE IF NOT EXISTS plan_done (
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    session_order INTEGER NOT NULL,
    run_id INTEGER,
    at INTEGER NOT NULL,
    PRIMARY KEY (plan_id, session_order)
  );
`;

export async function initDb(): Promise<void> {
  const db = getDb();
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;

  if (version === 0) {
    // Fresh install: create today's schema outright and skip the history.
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        distance_m REAL NOT NULL DEFAULT 0,
        duration_s INTEGER NOT NULL DEFAULT 0,
        avg_pace_s_km REAL,
        name TEXT,
        elevation_gain_m REAL,
        fastest_km_s REAL,
        health_uuid TEXT,
        session_id TEXT,
        session_blocks TEXT,
        cadence_spm REAL,
        exertion INTEGER
      );
      CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        ts INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        alt REAL,
        accuracy_m REAL,
        speed REAL,
        segment INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_points_run ON points(run_id, ts);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      ${PLAN_TABLES}
    `);
    version = SCHEMA_VERSION;
  }

  // The two migrations below still name the old French schema, and must: they
  // rename what is actually on disk in an existing install. Renaming them here
  // would make them target tables that never existed.
  if (version < 2) {
    await db.execAsync(`
      ALTER TABLE courses ADD COLUMN nom TEXT;
      ALTER TABLE courses ADD COLUMN denivele_m REAL;
      ALTER TABLE courses ADD COLUMN meilleur_km_s REAL;
    `);
    version = 2;
  }

  if (version < 3) {
    // Schema renamed to English. RENAME keeps the rows in place and lets
    // SQLite rewrite the foreign key on its own, so nothing is copied.
    await db.execAsync(`
      ALTER TABLE courses RENAME TO runs;
      ALTER TABLE runs RENAME COLUMN debut TO started_at;
      ALTER TABLE runs RENAME COLUMN fin TO ended_at;
      ALTER TABLE runs RENAME COLUMN duree_s TO duration_s;
      ALTER TABLE runs RENAME COLUMN allure_moy_s_km TO avg_pace_s_km;
      ALTER TABLE runs RENAME COLUMN nom TO name;
      ALTER TABLE runs RENAME COLUMN denivele_m TO elevation_gain_m;
      ALTER TABLE runs RENAME COLUMN meilleur_km_s TO fastest_km_s;
      ALTER TABLE points RENAME COLUMN course_id TO run_id;
      ALTER TABLE points RENAME COLUMN precision_m TO accuracy_m;
      ALTER TABLE points RENAME COLUMN vitesse TO speed;
      DROP INDEX IF EXISTS idx_points_course;
      CREATE INDEX IF NOT EXISTS idx_points_run ON points(run_id, ts);
    `);
    version = 3;
  }

  if (version < 4) {
    await db.execAsync("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    version = 4;
  }

  if (version < 5) {
    await db.execAsync("ALTER TABLE runs ADD COLUMN health_uuid TEXT");
    version = 5;
  }

  if (version < 6) {
    await db.execAsync(`
      ALTER TABLE runs ADD COLUMN session_id TEXT;
      ALTER TABLE runs ADD COLUMN session_blocks TEXT;
    `);
    version = 6;
  }

  if (version < 7) {
    await db.execAsync("ALTER TABLE runs ADD COLUMN cadence_spm REAL");
    version = 7;
  }

  if (version < 8) {
    await db.execAsync(PLAN_TABLES);
    version = 8;
  }

  if (version < 9) {
    // The tables are created above with the column already present, so this
    // only has anything to do on a device that ran version 8.
    await db.execAsync("ALTER TABLE plans ADD COLUMN days TEXT").catch(() => undefined);
    version = 9;
  }

  if (version < 10) {
    await db.execAsync("ALTER TABLE runs ADD COLUMN exertion INTEGER");
    version = 10;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  await recoverInterruptedRuns();
}

export async function createRun(startedAt: number): Promise<number> {
  const result = await getDb().runAsync("INSERT INTO runs (started_at) VALUES (?)", startedAt);
  return Number(result.lastInsertRowId);
}

export async function insertPoints(runId: number, points: TrackPoint[]): Promise<void> {
  if (!points.length) return;
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        "INSERT INTO points (run_id, ts, lat, lng, alt, accuracy_m, speed, segment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        runId, p.ts, p.lat, p.lng, p.alt, p.accuracy, p.speed, p.segment,
      );
    }
  });
}

export interface RunTotals {
  endedAt: number;
  sessionId?: string | null;
  blocks?: RanBlock[];
  cadenceSpm?: number | null;
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  name: string;
  elevationGainM: number;
  fastestKmS: number | null;
}

export async function finishRun(id: number, totals: RunTotals): Promise<void> {
  await getDb().runAsync(
    "UPDATE runs SET ended_at = ?, distance_m = ?, duration_s = ?, avg_pace_s_km = ?, name = ?, elevation_gain_m = ?, fastest_km_s = ?, session_id = ?, session_blocks = ?, cadence_spm = ? WHERE id = ?",
    totals.endedAt, totals.distanceM, totals.durationS, totals.avgPaceSKm,
    totals.name, totals.elevationGainM, totals.fastestKmS,
    totals.sessionId ?? null,
    totals.blocks?.length ? JSON.stringify(totals.blocks) : null,
    totals.cadenceSpm ?? null,
    id,
  );
}

/**
 * Remember that this run now exists in Apple Health. Passing null forgets it,
 * which is what a failed or undone sync means.
 */
export async function setHealthUuid(id: number, uuid: string | null): Promise<void> {
  await getDb().runAsync("UPDATE runs SET health_uuid = ? WHERE id = ?", uuid, id);
}

/**
 * Bring a run in from a GPX file.
 *
 * Returns the new run's id, or null when there was nothing to import or the
 * run was already on file. Refusing a duplicate matters more than it sounds:
 * re-importing last month's archive would otherwise double a month of
 * training, and nothing in the app would show it had happened.
 *
 * Totals are recomputed here rather than trusted from the file, because a
 * file written elsewhere states its own figures and they are rarely measured
 * the same way. The run then sits alongside the others on equal terms.
 */
export async function importRun(name: string | null, points: TrackPoint[]): Promise<number | null> {
  if (points.length < 2) return null;
  const startedAt = points[0].ts;

  const existing = await getDb().getFirstAsync<{ id: number }>(
    "SELECT id FROM runs WHERE started_at = ?", startedAt,
  );
  if (existing) return null;

  const id = await createRun(startedAt);
  await insertPoints(id, points);

  const distance = totalDistanceM(points);
  const duration = segments(points)
    .reduce((total, s) => total + (s[s.length - 1].ts - s[0].ts) / 1000, 0);

  await finishRun(id, {
    endedAt: points[points.length - 1].ts,
    distanceM: distance,
    durationS: Math.round(duration),
    avgPaceSKm: paceSecPerKm(distance, duration),
    name: name ?? autoName(startedAt),
    elevationGainM: elevationGainM(points),
    fastestKmS: fastestKmS(points),
  });
  return id;
}

export async function renameRun(id: number, name: string): Promise<void> {
  await getDb().runAsync("UPDATE runs SET name = ? WHERE id = ?", name.trim() || null, id);
}

export async function listRuns(): Promise<Run[]> {
  const rows = await getDb().getAllAsync<RunRow>(
    "SELECT * FROM runs WHERE ended_at IS NOT NULL ORDER BY started_at DESC",
  );
  return rows.map(toRun);
}

export async function readRun(id: number): Promise<{ run: Run; points: TrackPoint[] } | null> {
  const db = getDb();
  const row = await db.getFirstAsync<RunRow>("SELECT * FROM runs WHERE id = ?", id);
  if (!row) return null;
  const pointRows = await db.getAllAsync<{
    ts: number; lat: number; lng: number; alt: number | null;
    accuracy_m: number | null; speed: number | null; segment: number;
  }>("SELECT ts, lat, lng, alt, accuracy_m, speed, segment FROM points WHERE run_id = ? ORDER BY ts", id);

  const points: TrackPoint[] = pointRows.map((p) => ({
    ts: p.ts, lat: p.lat, lng: p.lng, alt: p.alt,
    accuracy: p.accuracy_m, speed: p.speed, segment: p.segment,
  }));
  return { run: toRun(row), points };
}

export async function deleteRun(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM points WHERE run_id = ?", id);
  // The programme has to let go of it too. `plan_done` points at a run
  // without a foreign key to enforce it, so a deleted run used to leave the
  // session ticked off against nothing — the one thing a runner cannot undo
  // from the outside, since the tick is what hides the session from them.
  await db.runAsync("DELETE FROM plan_done WHERE run_id = ?", id);
  await db.runAsync("DELETE FROM runs WHERE id = ?", id);
}

/**
 * The programme session a run was recorded for, if any.
 *
 * Asked before deleting, so the warning can say what else is about to change.
 */
export async function planSessionOfRun(runId: number): Promise<{ order: number } | null> {
  const row = await getDb().getFirstAsync<{ session_order: number }>(
    "SELECT session_order FROM plan_done WHERE run_id = ? LIMIT 1",
    runId,
  );
  return row ? { order: row.session_order } : null;
}

export interface PersonalRecords {
  totalRuns: number;
  totalDistanceM: number;
  totalDurationS: number;
  totalElevationM: number;
  longest: Run | null;
  fastestKm: Run | null;
  bestAvgPace: Run | null;
  mostElevation: Run | null;
}

/**
 * Records are read in SQL because every run already stores its own totals.
 * There is no need to replay millions of GPS points to answer a ranking
 * question.
 */
export async function personalRecords(): Promise<PersonalRecords> {
  const db = getDb();
  const totals = await db.getFirstAsync<{
    n: number; distance: number | null; duration: number | null; elevation: number | null;
  }>(
    "SELECT COUNT(*) AS n, SUM(distance_m) AS distance, SUM(duration_s) AS duration, SUM(elevation_gain_m) AS elevation FROM runs WHERE ended_at IS NOT NULL",
  );

  const best = async (sql: string): Promise<Run | null> => {
    const row = await db.getFirstAsync<RunRow>(sql);
    return row ? toRun(row) : null;
  };

  return {
    totalRuns: totals?.n ?? 0,
    totalDistanceM: totals?.distance ?? 0,
    totalDurationS: totals?.duration ?? 0,
    totalElevationM: totals?.elevation ?? 0,
    longest: await best("SELECT * FROM runs WHERE ended_at IS NOT NULL ORDER BY distance_m DESC LIMIT 1"),
    fastestKm: await best("SELECT * FROM runs WHERE ended_at IS NOT NULL AND fastest_km_s IS NOT NULL ORDER BY fastest_km_s ASC LIMIT 1"),
    // A pace record over 400 m means nothing, so 2 km is the entry ticket.
    bestAvgPace: await best("SELECT * FROM runs WHERE ended_at IS NOT NULL AND distance_m >= 2000 AND avg_pace_s_km IS NOT NULL ORDER BY avg_pace_s_km ASC LIMIT 1"),
    mostElevation: await best("SELECT * FROM runs WHERE ended_at IS NOT NULL AND elevation_gain_m IS NOT NULL ORDER BY elevation_gain_m DESC LIMIT 1"),
  };
}

/** Every stored setting, as a plain map. Small enough to read in one go. */
export async function readSettings(): Promise<Record<string, string>> {
  const rows = await getDb().getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function writeSetting(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key, value,
  );
}

/**
 * A run with no end is a run the app could not close: flat battery, crash, or
 * the system killing the process. Its points are on disk, so the totals are
 * rebuilt from them. With no points, it is dropped.
 */
async function recoverInterruptedRuns(): Promise<void> {
  const rows = await getDb().getAllAsync<RunRow>("SELECT * FROM runs WHERE ended_at IS NULL");
  for (const row of rows) {
    const run = toRun(row);
    const stored = await readRun(run.id);
    if (!stored || stored.points.length < 2) {
      await deleteRun(run.id);
      continue;
    }
    const distance = totalDistanceM(stored.points);
    const duration = segments(stored.points)
      .reduce((total, s) => total + (s[s.length - 1].ts - s[0].ts) / 1000, 0);

    await finishRun(run.id, {
      endedAt: stored.points[stored.points.length - 1].ts,
      distanceM: distance,
      durationS: Math.round(duration),
      avgPaceSKm: paceSecPerKm(distance, duration),
      name: autoName(run.startedAt),
      elevationGainM: elevationGainM(stored.points),
      fastestKmS: fastestKmS(stored.points),
    });
  }
}


/** A programme as it was generated, with the race it is aimed at. */
export interface StoredPlan {
  id: number;
  goal: Goal;
  raceAt: number;
  weeks: number;
  perWeek: PerWeek;
  targetTimeS: number;
  createdAt: number;
  /** Weekdays the runner picked, as `Date.getDay` numbers. */
  days: number[];
  sessions: PlannedSession[];
}

interface PlanRow {
  id: number;
  goal: string;
  race_at: number;
  weeks: number;
  per_week: number;
  target_time_s: number;
  created_at: number;
  sessions: string;
  days: string | null;
}

/** Stored json that may predate the column, or have been written by hand. */
function safeDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is number => typeof d === "number") : [];
  } catch {
    return [];
  }
}

/**
 * The programme in progress, or null.
 *
 * One at a time, deliberately. Two overlapping plans would each tell you what
 * to run today, and a runner with two coaches has none.
 */
export async function activePlan(): Promise<StoredPlan | null> {
  const row = await getDb().getFirstAsync<PlanRow>(
    "SELECT * FROM plans ORDER BY created_at DESC LIMIT 1",
  );
  if (!row) return null;
  // Narrowed once, because both the days and their count depend on it.
  const perWeek = ([1, 2, 3, 4] as const).find((n) => n === row.per_week) ?? 3;
  return {
    id: row.id,
    goal: row.goal as Goal,
    raceAt: row.race_at,
    weeks: row.weeks,
    perWeek,
    targetTimeS: row.target_time_s,
    createdAt: row.created_at,
    // Checked on the way out rather than trusted: a plan written before the
    // days were choosable has none, and falls back to the suggestion.
    days: normaliseDays(safeDays(row.days), perWeek),
    sessions: JSON.parse(row.sessions) as PlannedSession[],
  };
}

export interface NewPlan {
  goal: Goal;
  raceAt: number;
  weeks: number;
  perWeek: PerWeek;
  targetTimeS: number;
  days: number[];
  sessions: PlannedSession[];
}

/** Store a programme, replacing whatever it succeeds. */
export async function createPlan(plan: NewPlan): Promise<number> {
  const db = getDb();
  // The runs themselves are never touched: what a plan replaces is the
  // intention, not the training that was actually done.
  await db.runAsync("DELETE FROM plans");
  const result = await db.runAsync(
    "INSERT INTO plans (goal, race_at, weeks, per_week, target_time_s, created_at, sessions, days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    plan.goal, plan.raceAt, plan.weeks, plan.perWeek, plan.targetTimeS,
    Date.now(), JSON.stringify(plan.sessions), JSON.stringify(plan.days),
  );
  return Number(result.lastInsertRowId);
}

export async function deletePlan(): Promise<void> {
  await getDb().runAsync("DELETE FROM plans");
}

/** Which sessions of a plan are behind you, by their order in it. */
export async function planDone(planId: number): Promise<Map<number, Done>> {
  const rows = await getDb().getAllAsync<{ session_order: number; run_id: number | null; at: number }>(
    "SELECT session_order, run_id, at FROM plan_done WHERE plan_id = ?",
    planId,
  );
  return new Map(rows.map((row) => [row.session_order, { runId: row.run_id ?? 0, at: row.at }]));
}

/**
 * Tie a finished run to the session of the plan it was run for.
 *
 * The plan is looked up here rather than carried through the tracker, which
 * has enough to hold during a run and no business knowing about programmes.
 */
export async function markPlanSessionDone(order: number, runId: number | null, at: number): Promise<void> {
  const plan = await activePlan();
  if (!plan) return;
  await getDb().runAsync(
    "INSERT OR REPLACE INTO plan_done (plan_id, session_order, run_id, at) VALUES (?, ?, ?, ?)",
    plan.id, order, runId, at,
  );
}

/** Undo that, for a session ticked off by mistake. */
export async function unmarkPlanSessionDone(planId: number, order: number): Promise<void> {
  await getDb().runAsync(
    "DELETE FROM plan_done WHERE plan_id = ? AND session_order = ?",
    planId, order,
  );
}


/**
 * Record how a run felt, or clear it.
 *
 * Kept on the run rather than on the plan session, because it is true of the
 * run whether or not a programme asked for it — and a runner who abandons a
 * plan should not lose what they said about the running they did.
 */
export async function setRunExertion(id: number, exertion: Exertion | null): Promise<void> {
  await getDb().runAsync("UPDATE runs SET exertion = ? WHERE id = ?", exertion, id);
}

/**
 * The last few answers, newest first.
 *
 * Only runs that were actually rated: a silence is not an easy day, and
 * treating it as one would let a programme keep climbing through exactly the
 * weeks a runner was too flattened to answer.
 */
export async function recentExertions(limit = 4): Promise<Exertion[]> {
  const rows = await getDb().getAllAsync<{ exertion: number }>(
    "SELECT exertion FROM runs WHERE exertion IS NOT NULL AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?",
    limit,
  );
  return rows
    .map((row) => ([1, 2, 3, 4, 5] as const).find((n) => n === row.exertion))
    .filter((n): n is Exertion => n !== undefined);
}
