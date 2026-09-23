import { File } from "expo-file-system";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { autoName } from "./format";
import { elevationGainM, fastestKmS, paceSecPerKm, segments, totalDistanceM, type TrackPoint } from "./geo";
import {
  normaliseDays, type Done, type Exertion, type Goal, type PerWeek, type PlannedSession,
} from "./plan";
import { bestEfforts, EFFORT_KEYS, parseEfforts, type BestEfforts } from "./efforts";
import { parseHeart, type Heart } from "./heart";
import { parseRoute, routeDistanceM, type Route, type StoredRoute } from "./route";
import {
  TRANSFER_FORMAT, TRANSFER_VERSION, type Restored, type Transfer, type TransferRun,
} from "./transfer";
import { parseWeather, type Weather } from "./weather";
import { currentEffort, currentSession, currentSessionId, type RanBlock } from "./workout";

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
  if (!instance) {
    instance = openDatabaseSync("running.db");
    // SQLite ignores foreign keys unless asked, per connection. Every
    // `ON DELETE CASCADE` in the schema was therefore decoration: deleting a
    // plan left its ticked-off sessions behind, and since `id` is an alias
    // for `rowid`, the next plan created into an empty table took the same
    // number and inherited them.
    try {
      instance.execSync("PRAGMA foreign_keys = ON");
    } catch {
      // An older runtime without the sync API still works: every delete that
      // matters is spelled out below rather than left to the cascade.
    }
  }
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
  /**
   * The weather this run was run in, taken once at the end, or null.
   *
   * Null on every run recorded before this existed, on every run imported
   * from a file, and on any run the network was not there to answer for.
   * Whatever shows it is written to look complete without it.
   */
  weather: Weather | null;
  /**
   * What this run's heart did, read back from Apple Health, or null.
   *
   * Null for everyone who runs without a watch, which is most runs: the app
   * measures nothing itself here, it only reads what the watch wrote.
   */
  heart: Heart | null;
  /** Fastest time over each classic distance inside this run, or null until worked out. */
  bestEfforts: BestEfforts | null;
  /** The drawn route this run covered, or null for a run that followed none. */
  routeId: number | null;
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
  weather: string | null;
  heart: string | null;
  best_efforts: string | null;
  route_id: number | null;
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
  // One json column, for the reason given above the blocks.
  weather: parseWeather(row.weather),
  heart: parseHeart(row.heart),
  bestEfforts: parseEfforts(row.best_efforts),
  routeId: row.route_id ?? null,
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

const SCHEMA_VERSION = 17;

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
/**
 * Routes are plans, so they are kept apart from runs entirely.
 *
 * Two json columns rather than a table of points: a route is only ever read
 * whole, and the taps have to be kept beside the drawn line so that a corner
 * can still be taken back a week later.
 */
const ROUTE_TABLE = `
  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    distance_m REAL NOT NULL,
    waypoints TEXT NOT NULL,
    legs TEXT NOT NULL,
    place TEXT,
    preview TEXT
  );
`;

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

/**
 * Rewrite the French identifiers stored before the code was in English.
 *
 * Efforts ("rapide", "récupération"…) and library session ids ("seuil",
 * "pyramide"…) live inside json in two places: every programme's sessions,
 * and every run's blocks and session id. They are rewritten here, once, so
 * that nothing past this point ever has to know the old spelling. Rows that
 * do not parse are left as they are: the readers already treat them as empty.
 */
async function englishIdentifiers(db: SQLiteDatabase): Promise<void> {
  const plans = await db.getAllAsync<{ id: number; sessions: string }>("SELECT id, sessions FROM plans");
  for (const plan of plans) {
    try {
      const sessions = (JSON.parse(plan.sessions) as PlannedSession[])
        .map((planned) => ({ ...planned, session: currentSession(planned.session) }));
      await db.runAsync("UPDATE plans SET sessions = ? WHERE id = ?", JSON.stringify(sessions), plan.id);
    } catch {
      /* unreadable before, unreadable after */
    }
  }

  const runs = await db.getAllAsync<{ id: number; session_id: string | null; session_blocks: string | null }>(
    "SELECT id, session_id, session_blocks FROM runs WHERE session_id IS NOT NULL OR session_blocks IS NOT NULL",
  );
  for (const run of runs) {
    let blocks = run.session_blocks;
    try {
      if (blocks) {
        blocks = JSON.stringify((JSON.parse(blocks) as RanBlock[])
          .map((block) => ({ ...block, effort: currentEffort(block.effort) })));
      }
    } catch {
      /* left as it was */
    }
    await db.runAsync(
      "UPDATE runs SET session_id = ?, session_blocks = ? WHERE id = ?",
      run.session_id === null ? null : currentSessionId(run.session_id), blocks, run.id,
    );
  }
}

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
        exertion INTEGER,
        weather TEXT,
        heart TEXT,
        best_efforts TEXT,
        route_id INTEGER
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
      ${ROUTE_TABLE}
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

  if (version < 11) {
    // Ticks left over from before the cascade was enforced: sessions marked
    // done against a run that no longer exists, or against a plan that was
    // replaced. They are why a freshly created programme could open already
    // half complete.
    await db.execAsync(`
      DELETE FROM plan_done WHERE plan_id NOT IN (SELECT id FROM plans);
      DELETE FROM plan_done WHERE run_id IS NOT NULL AND run_id NOT IN (SELECT id FROM runs);
    `);
    version = 11;
  }

  if (version < 12) {
    await db.execAsync("ALTER TABLE runs ADD COLUMN weather TEXT");
    version = 12;
  }

  if (version < 13) {
    await db.execAsync("ALTER TABLE runs ADD COLUMN heart TEXT");
    version = 13;
  }

  if (version < 14) {
    await db.execAsync(ROUTE_TABLE);
    version = 14;
  }

  if (version < 15) {
    // Created with both columns above, so this only has anything to do on a
    // device that drew a route under version 14.
    await db.execAsync("ALTER TABLE routes ADD COLUMN place TEXT").catch(() => undefined);
    await db.execAsync("ALTER TABLE routes ADD COLUMN preview TEXT").catch(() => undefined);
    version = 15;
  }

  if (version < 16) {
    await englishIdentifiers(db);
    version = 16;
  }

  if (version < 17) {
    // Filled in the background for runs already here: see backfillEfforts.
    await db.execAsync("ALTER TABLE runs ADD COLUMN best_efforts TEXT");
    await db.execAsync("ALTER TABLE runs ADD COLUMN route_id INTEGER");
    version = 17;
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
  bestEfforts?: BestEfforts;
  /** The route the run covered, when it covered enough of one to count. */
  routeId?: number | null;
}

export async function finishRun(id: number, totals: RunTotals): Promise<void> {
  await getDb().runAsync(
    "UPDATE runs SET ended_at = ?, distance_m = ?, duration_s = ?, avg_pace_s_km = ?, name = ?, elevation_gain_m = ?, fastest_km_s = ?, session_id = ?, session_blocks = ?, cadence_spm = ?, best_efforts = ?, route_id = ? WHERE id = ?",
    totals.endedAt, totals.distanceM, totals.durationS, totals.avgPaceSKm,
    totals.name, totals.elevationGainM, totals.fastestKmS,
    totals.sessionId ?? null,
    totals.blocks?.length ? JSON.stringify(totals.blocks) : null,
    totals.cadenceSpm ?? null,
    totals.bestEfforts ? JSON.stringify(totals.bestEfforts) : null,
    totals.routeId ?? null,
    id,
  );
}

/**
 * Work out the best efforts of every run that does not have them yet: runs
 * recorded before the app looked for them, imported from files, or brought
 * over from another phone.
 *
 * One run at a time, in the background, after launch: it reads every point
 * of every run once, which on a long history is too much to do in front of
 * anybody. A run with no efforts to find is stored with an empty set, so it
 * is not read again.
 */
export async function backfillEfforts(): Promise<number> {
  const db = getDb();
  const pending = await db.getAllAsync<{ id: number }>(
    "SELECT id FROM runs WHERE ended_at IS NOT NULL AND best_efforts IS NULL",
  );
  for (const { id } of pending) {
    const points = await db.getAllAsync<{
      ts: number; lat: number; lng: number; alt: number | null;
      accuracy_m: number | null; speed: number | null; segment: number;
    }>("SELECT ts, lat, lng, alt, accuracy_m, speed, segment FROM points WHERE run_id = ? ORDER BY ts", id);
    const efforts = bestEfforts(points.map((point) => ({
      ts: point.ts, lat: point.lat, lng: point.lng, alt: point.alt,
      accuracy: point.accuracy_m, speed: point.speed, segment: point.segment,
    })));
    await db.runAsync("UPDATE runs SET best_efforts = ? WHERE id = ?", JSON.stringify(efforts), id);
  }
  return pending.length;
}

/** How a route has been run: its fastest time, and how often. */
export interface RouteRecord {
  routeId: number;
  best: Run;
  runs: number;
}

/**
 * The record on every route that has one.
 *
 * Only routes that still exist: a deleted route's runs keep its id but no
 * longer have anything to be a record of.
 */
export async function routeRecords(): Promise<Map<number, RouteRecord>> {
  const rows = await getDb().getAllAsync<RunRow>(
    "SELECT runs.* FROM runs JOIN routes ON routes.id = runs.route_id"
    + " WHERE runs.ended_at IS NOT NULL ORDER BY runs.duration_s ASC",
  );
  const records = new Map<number, RouteRecord>();
  for (const row of rows) {
    const run = toRun(row);
    if (run.routeId === null) continue;
    const held = records.get(run.routeId);
    if (held) held.runs += 1;
    else records.set(run.routeId, { routeId: run.routeId, best: run, runs: 1 });
  }
  return records;
}

/** The fastest time on record over one distance, and the run it was set in. */
export interface EffortRecord {
  key: string;
  seconds: number;
  run: Run;
}

/**
 * The best effort over each distance, across every run.
 *
 * Worked out from the runs themselves rather than kept in a table of its
 * own: deleting a run then takes its records with it, and the next best one
 * stands, without anything having to be told.
 */
export async function effortRecords(): Promise<EffortRecord[]> {
  const best = new Map<string, EffortRecord>();
  for (const run of await listRuns()) {
    for (const [key, seconds] of Object.entries(run.bestEfforts ?? {})) {
      const held = best.get(key);
      if (!held || seconds < held.seconds) best.set(key, { key, seconds, run });
    }
  }
  return EFFORT_KEYS.map((key) => best.get(key)).filter((record): record is EffortRecord => Boolean(record));
}

/**
 * Everything this phone holds, ready to travel to another one.
 *
 * Read run by run rather than as one join: the points of a long history run
 * into the hundreds of thousands, and a single query returning them all in
 * one array is the one shape of this that a phone cannot hold in memory.
 */
export async function everythingForTransfer(): Promise<Transfer> {
  const db = getDb();
  const runs = await listRuns();
  const carried: TransferRun[] = [];

  for (const run of runs) {
    const rows = await db.getAllAsync<{
      ts: number; lat: number; lng: number; alt: number | null;
      accuracy_m: number | null; speed: number | null; segment: number;
    }>("SELECT ts, lat, lng, alt, accuracy_m, speed, segment FROM points WHERE run_id = ? ORDER BY ts", run.id);

    carried.push({
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      distanceM: run.distanceM,
      durationS: run.durationS,
      avgPaceSKm: run.avgPaceSKm,
      name: run.name,
      elevationGainM: run.elevationGainM,
      fastestKmS: run.fastestKmS,
      cadenceSpm: run.cadenceSpm,
      exertion: run.exertion,
      sessionId: run.sessionId,
      blocks: run.blocks,
      weather: run.weather,
      heart: run.heart,
      points: rows.map((point) => ({
        ts: point.ts, lat: point.lat, lng: point.lng, alt: point.alt,
        accuracy: point.accuracy_m, speed: point.speed, segment: point.segment,
      })),
    });
  }

  const plan = await activePlan();
  const done = plan ? await planDone(plan.id) : new Map<number, Done>();

  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: Date.now(),
    runs: carried,
    routes: (await listRoutes()).map((route) => ({
      name: route.name,
      createdAt: route.createdAt,
      waypoints: route.waypoints,
      legs: route.legs,
      place: route.place,
    })),
    plan: plan === null ? null : {
      goal: plan.goal,
      raceAt: plan.raceAt,
      weeks: plan.weeks,
      perWeek: plan.perWeek,
      targetTimeS: plan.targetTimeS,
      createdAt: plan.createdAt,
      days: plan.days,
      sessions: plan.sessions,
      done: [...done.entries()].map(([order, tick]) => ({ order, runId: tick.runId, at: tick.at })),
    },
    settings: await readSettings(),
  };
}

/**
 * Take a transfer in, without ever taking anything away.
 *
 * Idempotent by design: a run is recognised by the moment it started, which
 * is the same rule the GPX import has always used, so the same file read
 * twice adds nothing the second time. Nothing already here is overwritten or
 * deleted — the worst an unwanted import can do is add runs, and those can be
 * deleted one by one.
 *
 * The programme is the one exception to "add only", and it declines rather
 * than replaces: a phone already following a plan keeps it, because a
 * programme is a commitment in progress and the app has no way to merge two.
 */
export async function restoreTransfer(transfer: Transfer): Promise<Restored> {
  const db = getDb();
  let added = 0;
  let known = 0;

  for (const run of transfer.runs) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM runs WHERE started_at = ?", run.startedAt,
    );
    if (existing) {
      known += 1;
      continue;
    }

    const id = await createRun(run.startedAt);
    await insertPoints(id, run.points);
    await db.runAsync(
      "UPDATE runs SET ended_at = ?, distance_m = ?, duration_s = ?, avg_pace_s_km = ?, name = ?,"
      + " elevation_gain_m = ?, fastest_km_s = ?, cadence_spm = ?, exertion = ?, session_id = ?,"
      + " session_blocks = ?, weather = ?, heart = ? WHERE id = ?",
      run.endedAt, run.distanceM, run.durationS, run.avgPaceSKm, run.name,
      run.elevationGainM, run.fastestKmS, run.cadenceSpm, run.exertion, run.sessionId,
      run.blocks?.length ? JSON.stringify(run.blocks) : null,
      run.weather ? JSON.stringify(run.weather) : null,
      run.heart ? JSON.stringify(run.heart) : null,
      id,
    );
    added += 1;
  }

  // A route is recognised by its name and the moment it was drawn, so the
  // same file read twice adds it once. Its creation date is kept: the list is
  // ordered by it, and a route drawn last spring is not new.
  let routes = 0;
  for (const route of transfer.routes) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM routes WHERE created_at = ? AND name = ?", route.createdAt, route.name,
    );
    if (existing) continue;
    const shape = { waypoints: route.waypoints, legs: route.legs };
    await db.runAsync(
      "INSERT INTO routes (name, created_at, distance_m, waypoints, legs, place, preview)"
      + " VALUES (?, ?, ?, ?, ?, ?, NULL)",
      route.name, route.createdAt, routeDistanceM(shape),
      JSON.stringify(route.waypoints), JSON.stringify(route.legs), route.place,
    );
    routes += 1;
  }

  const plan = transfer.plan;
  const hasPlan = (await activePlan()) !== null;
  if (plan && !hasPlan) {
    const planId = await createPlan({
      goal: plan.goal, raceAt: plan.raceAt, weeks: plan.weeks, perWeek: plan.perWeek,
      targetTimeS: plan.targetTimeS, days: plan.days, sessions: plan.sessions,
    });
    for (const tick of plan.done) {
      // The run ids in the file name rows on the old phone. The tick itself
      // is what matters — a session done stays done — so it is kept without
      // the link rather than pointed at a run that is not the same one here.
      await db.runAsync(
        "INSERT OR IGNORE INTO plan_done (plan_id, session_order, run_id, at) VALUES (?, ?, ?, ?)",
        planId, tick.order, null, tick.at,
      );
    }
  }

  const settings = Object.entries(transfer.settings);
  for (const [key, value] of settings) await writeSetting(key, value);

  // Best efforts do not travel: they are worked out again here from the points.
  if (added > 0) await backfillEfforts().catch(() => 0);

  return { added, known, routes, plan: Boolean(plan) && !hasPlan, settings: settings.length > 0 };
}

/**
 * Remember that this run now exists in Apple Health. Passing null forgets it,
 * which is what a failed or undone sync means.
 */
export async function setHealthUuid(id: number, uuid: string | null): Promise<void> {
  await getDb().runAsync("UPDATE runs SET health_uuid = ? WHERE id = ?", uuid, id);
}

interface RouteRow {
  id: number;
  name: string;
  created_at: number;
  distance_m: number;
  waypoints: string;
  legs: string;
  place: string | null;
  preview: string | null;
}

const toRoute = (row: RouteRow): StoredRoute => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  distanceM: row.distance_m,
  place: row.place,
  preview: row.preview,
  ...parseRoute(row.waypoints, row.legs),
});

/** What a route is shown with: where it is, and a picture of it on its map. */
export interface RouteLook {
  place: string | null;
  preview: string | null;
}

/** Keep a drawn route, and hand back the id it was given. */
export async function saveRoute(name: string, route: Route, look: RouteLook): Promise<number> {
  const result = await getDb().runAsync(
    "INSERT INTO routes (name, created_at, distance_m, waypoints, legs, place, preview)"
    + " VALUES (?, ?, ?, ?, ?, ?, ?)",
    name, Date.now(), routeDistanceM(route),
    JSON.stringify(route.waypoints), JSON.stringify(route.legs), look.place, look.preview,
  );
  return Number(result.lastInsertRowId);
}

/** Every route, newest first. */
export async function listRoutes(): Promise<StoredRoute[]> {
  const rows = await getDb().getAllAsync<RouteRow>(
    "SELECT * FROM routes ORDER BY created_at DESC",
  );
  return rows.map(toRoute);
}

export async function readRoute(id: number): Promise<StoredRoute | null> {
  const row = await getDb().getFirstAsync<RouteRow>("SELECT * FROM routes WHERE id = ?", id);
  return row ? toRoute(row) : null;
}

/**
 * Write a drawn route over the one that was there.
 *
 * The day it was created is left alone: editing a route is changing where it
 * goes, not making a different one. Somebody who wants a variant keeps the
 * original and draws another.
 */
export async function updateRoute(
  id: number, name: string, route: Route, look: RouteLook,
): Promise<void> {
  // The picture it had is about to stop being the picture it has. Left alone,
  // every edit would leave one behind in a folder nothing ever reads.
  const before = await readRoute(id);
  if (before?.preview && before.preview !== look.preview) forgetPicture(before.preview);

  await getDb().runAsync(
    "UPDATE routes SET name = ?, distance_m = ?, waypoints = ?, legs = ?, place = ?, preview = ?"
    + " WHERE id = ?",
    name, routeDistanceM(route), JSON.stringify(route.waypoints), JSON.stringify(route.legs),
    look.place, look.preview, id,
  );
}

/**
 * Remember the picture taken of a route.
 *
 * Its own writer because a picture can arrive long after the route did: one
 * imported from a file has never been on a map, so the list photographs it
 * the first time it shows it.
 */
export async function setRoutePreview(id: number, preview: string): Promise<void> {
  const before = await readRoute(id);
  if (before?.preview && before.preview !== preview) forgetPicture(before.preview);
  await getDb().runAsync("UPDATE routes SET preview = ? WHERE id = ?", preview, id);
}

export async function renameRoute(id: number, name: string): Promise<void> {
  await getDb().runAsync("UPDATE routes SET name = ? WHERE id = ?", name.trim(), id);
}

export async function deleteRoute(id: number): Promise<void> {
  const route = await readRoute(id);
  await getDb().runAsync("DELETE FROM routes WHERE id = ?", id);
  if (route?.preview) forgetPicture(route.preview);
}

/**
 * Throw away a route's picture.
 *
 * Silent, and deliberately after the row is gone rather than before: a file
 * that refuses to be deleted must not stop a route being deleted. The worst
 * that can happen here is one orphaned picture; the worst the other way round
 * is a route nobody can get rid of.
 */
function forgetPicture(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* the row is what mattered */
  }
}

/**
 * Remember the weather a run was run in.
 *
 * Written after the run is already closed rather than as part of closing it:
 * the reading comes off the network, and a run must never wait on a server
 * to be saved.
 */
export async function setRunWeather(id: number, weather: Weather): Promise<void> {
  await getDb().runAsync("UPDATE runs SET weather = ? WHERE id = ?", JSON.stringify(weather), id);
}

/**
 * Remember what a run's heart did.
 *
 * Written whenever the app manages to read it, which may be long after the
 * run: permission can be granted later, and a watch can sync later still.
 */
export async function setRunHeart(id: number, heart: Heart): Promise<void> {
  await getDb().runAsync("UPDATE runs SET heart = ? WHERE id = ?", JSON.stringify(heart), id);
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

/**
 * The shape of a run, light enough to draw in a list row.
 *
 * Evenly sampled down to about sixty points by SQLite itself, so a list of a
 * hundred runs reads a few thousand rows rather than every fix of every run.
 * A shape is recognisable long before it is accurate.
 */
export async function runShape(id: number, points = 60): Promise<{ lat: number; lng: number }[]> {
  return getDb().getAllAsync<{ lat: number; lng: number }>(
    `SELECT lat, lng FROM (
       SELECT lat, lng, ts,
              ROW_NUMBER() OVER (ORDER BY ts) AS position,
              COUNT(*) OVER () AS total
       FROM points WHERE run_id = ?
     )
     WHERE (position - 1) % MAX(1, total / ?) = 0 OR position = total
     ORDER BY ts`,
    id, points,
  );
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

/** Remove settings outright, so they read as never having been set. */
export async function deleteSettings(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  await getDb().runAsync(
    `DELETE FROM settings WHERE key IN (${keys.map(() => "?").join(", ")})`,
    ...keys,
  );
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
  // intention, not the training that was actually done. Its ticks are another
  // matter, and they are deleted by hand rather than trusted to the cascade —
  // a pragma is per connection, and this is not a thing to be wrong about
  // twice.
  await db.runAsync("DELETE FROM plan_done");
  await db.runAsync("DELETE FROM plans");
  const result = await db.runAsync(
    "INSERT INTO plans (goal, race_at, weeks, per_week, target_time_s, created_at, sessions, days) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    plan.goal, plan.raceAt, plan.weeks, plan.perWeek, plan.targetTimeS,
    Date.now(), JSON.stringify(plan.sessions), JSON.stringify(plan.days),
  );
  return Number(result.lastInsertRowId);
}

export async function deletePlan(): Promise<void> {
  const db = getDb();
  await db.runAsync("DELETE FROM plan_done");
  await db.runAsync("DELETE FROM plans");
}

/** Which sessions of a plan are behind you, by their order in it. */
export async function planDone(planId: number): Promise<Map<number, Done>> {
  const rows = await getDb().getAllAsync<{ session_order: number; run_id: number | null; at: number }>(
    "SELECT session_order, run_id, at FROM plan_done WHERE plan_id = ?",
    planId,
  );
  return new Map(rows.map((row) => [row.session_order, { runId: row.run_id, at: row.at }]));
}

/**
 * Tie a finished run to the session of the plan it was run for.
 *
 * The plan is looked up here rather than carried through the tracker, which
 * has enough to hold during a run and no business knowing about programmes.
 */
export async function markPlanSessionDone(
  order: number,
  runId: number | null,
  // Defaulted here rather than asked of every caller. Only the tracker has a
  // moment worth naming — the instant the run ended — and a screen settling a
  // session by hand means now, which it should not have to say, still less
  // read the clock inside a render to do so.
  at: number = Date.now(),
): Promise<void> {
  const plan = await activePlan();
  if (!plan) return;
  const db = getDb();
  // One session per run. The primary key already stops a session being
  // settled twice; nothing stopped a run settling two of them, which is how
  // a single outing could have ticked off a week.
  if (runId !== null) await db.runAsync("DELETE FROM plan_done WHERE run_id = ?", runId);
  await db.runAsync(
    "INSERT OR REPLACE INTO plan_done (plan_id, session_order, run_id, at) VALUES (?, ?, ?, ?)",
    plan.id, order, runId, at,
  );
}

/** Undo a link, leaving the run alone and the session to be done again. */
export async function detachRunFromPlan(runId: number): Promise<void> {
  await getDb().runAsync("DELETE FROM plan_done WHERE run_id = ?", runId);
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
