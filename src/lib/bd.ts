import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { allureSecParKm, distanceTotaleM, segments, type Point } from "./geo";

/**
 * Connexion unique, ouverte a la premiere utilisation reelle plutot qu'au
 * chargement du module. Le traqueur ecrit des points depuis une tache de
 * fond, hors de tout arbre React : il lui faut un acces direct, pas un
 * contexte.
 *
 * L'ouverture est paresseuse pour une raison precise : sur web, expo-sqlite
 * s'appuie sur un backend WASM qui exige SharedArrayBuffer, absent sans
 * en-tetes serveur speciaux. Appeler openDatabaseSync() au chargement du
 * module (comme le faisait la version precedente) plante avant meme que
 * React ne monte quoi que ce soit, donc avant que le try/catch de
 * initialiserBd() puisse l'attraper. En repoussant l'appel a l'interieur
 * d'une fonction, le crash devient une exception normale, deja geree par
 * l'ecran d'erreur de _layout.tsx.
 */
let instance: SQLiteDatabase | null = null;

function obtenirBd(): SQLiteDatabase {
  if (Platform.OS === "web") {
    throw new Error(
      "Le suivi de course n'est pas disponible sur web : le GPS et le stockage local demandent l'app mobile (iOS ou Android).",
    );
  }
  if (!instance) instance = openDatabaseSync("running.db");
  return instance;
}

export interface Course {
  id: number;
  debut: number;
  fin: number | null;
  distance_m: number;
  duree_s: number;
  allure_moy_s_km: number | null;
}

const VERSION = 1;

export async function initialiserBd(): Promise<void> {
  const db = obtenirBd();
  const ligne = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = ligne?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY,
        debut INTEGER NOT NULL,
        fin INTEGER,
        distance_m REAL NOT NULL DEFAULT 0,
        duree_s INTEGER NOT NULL DEFAULT 0,
        allure_moy_s_km REAL
      );
      CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        ts INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        alt REAL,
        precision_m REAL,
        vitesse REAL,
        segment INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_points_course ON points(course_id, ts);
    `);
    version = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${VERSION}`);
  await finaliserCoursesInterrompues();
}

export async function creerCourse(debut: number): Promise<number> {
  const r = await obtenirBd().runAsync("INSERT INTO courses (debut) VALUES (?)", debut);
  return Number(r.lastInsertRowId);
}

export async function ajouterPoints(courseId: number, points: Point[]): Promise<void> {
  if (!points.length) return;
  const db = obtenirBd();
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        "INSERT INTO points (course_id, ts, lat, lng, alt, precision_m, vitesse, segment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        courseId, p.ts, p.lat, p.lng, p.alt, p.precision, p.vitesse, p.segment,
      );
    }
  });
}

export async function terminerCourse(
  id: number,
  totaux: { fin: number; distance_m: number; duree_s: number; allure_moy_s_km: number | null },
): Promise<void> {
  await obtenirBd().runAsync(
    "UPDATE courses SET fin = ?, distance_m = ?, duree_s = ?, allure_moy_s_km = ? WHERE id = ?",
    totaux.fin, totaux.distance_m, totaux.duree_s, totaux.allure_moy_s_km, id,
  );
}

export async function listerCourses(): Promise<Course[]> {
  return obtenirBd().getAllAsync<Course>("SELECT * FROM courses WHERE fin IS NOT NULL ORDER BY debut DESC");
}

export async function lireCourse(id: number): Promise<{ course: Course; points: Point[] } | null> {
  const db = obtenirBd();
  const course = await db.getFirstAsync<Course>("SELECT * FROM courses WHERE id = ?", id);
  if (!course) return null;
  const lignes = await db.getAllAsync<{
    ts: number; lat: number; lng: number; alt: number | null; precision_m: number | null; vitesse: number | null; segment: number;
  }>("SELECT ts, lat, lng, alt, precision_m, vitesse, segment FROM points WHERE course_id = ? ORDER BY ts", id);
  const points: Point[] = lignes.map((l) => ({
    ts: l.ts, lat: l.lat, lng: l.lng, alt: l.alt, precision: l.precision_m, vitesse: l.vitesse, segment: l.segment,
  }));
  return { course, points };
}

export async function supprimerCourse(id: number): Promise<void> {
  const db = obtenirBd();
  await db.runAsync("DELETE FROM points WHERE course_id = ?", id);
  await db.runAsync("DELETE FROM courses WHERE id = ?", id);
}

/**
 * Une course sans fin est une course que l'app n'a pas pu clore : batterie a
 * plat, plantage, systeme qui a tue le processus. Ses points sont sur disque,
 * on reconstitue les totaux a partir d'eux. Sans point, on l'efface.
 */
async function finaliserCoursesInterrompues(): Promise<void> {
  const orphelines = await obtenirBd().getAllAsync<Course>("SELECT * FROM courses WHERE fin IS NULL");
  for (const c of orphelines) {
    const lu = await lireCourse(c.id);
    if (!lu || lu.points.length < 2) {
      await supprimerCourse(c.id);
      continue;
    }
    const distance = distanceTotaleM(lu.points);
    const duree = segments(lu.points).reduce((t, s) => t + (s[s.length - 1].ts - s[0].ts) / 1000, 0);
    await terminerCourse(c.id, {
      fin: lu.points[lu.points.length - 1].ts,
      distance_m: distance,
      duree_s: Math.round(duree),
      allure_moy_s_km: allureSecParKm(distance, duree),
    });
  }
}
