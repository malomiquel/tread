import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { autoName } from "./format";
import { elevationGainM, fastestKmS, paceSecPerKm, segments, totalDistanceM, type TrackPoint } from "./geo";

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
});

const SCHEMA_VERSION = 3;

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
        fastest_km_s REAL
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
  distanceM: number;
  durationS: number;
  avgPaceSKm: number | null;
  name: string;
  elevationGainM: number;
  fastestKmS: number | null;
}

export async function finishRun(id: number, totals: RunTotals): Promise<void> {
  await getDb().runAsync(
    "UPDATE runs SET ended_at = ?, distance_m = ?, duration_s = ?, avg_pace_s_km = ?, name = ?, elevation_gain_m = ?, fastest_km_s = ? WHERE id = ?",
    totals.endedAt, totals.distanceM, totals.durationS, totals.avgPaceSKm,
    totals.name, totals.elevationGainM, totals.fastestKmS, id,
  );
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
  await db.runAsync("DELETE FROM runs WHERE id = ?", id);
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
