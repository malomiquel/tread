import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accepterPoint, allureInstantanee, allureSecParKm, denivelePositifM, distanceM, distanceTotaleM,
  fractionnes, meilleurKmS, type Point,
} from "./geo.ts";

const point = (ts: number, lat: number, lng: number, extra: Partial<Point> = {}): Point => ({
  ts, lat, lng, alt: null, precision: 5, vitesse: null, segment: 0, ...extra,
});

// Degres de latitude par metre, derives du meme rayon terrestre que geo.ts,
// sinon 3 km de test font 2 996 m et le test echoue pour une mauvaise raison.
const DEG_PAR_M = 180 / (Math.PI * 6371008.8);

test("haversine : Paris-Lyon a 1 % pres", () => {
  const d = distanceM({ lat: 48.8566, lng: 2.3522 }, { lat: 45.764, lng: 4.8357 });
  assert.ok(Math.abs(d - 392_000) < 4_000, `obtenu ${d}`);
});

test("haversine : 100 m plein nord", () => {
  const d = distanceM({ lat: 48, lng: 2 }, { lat: 48 + 100 * DEG_PAR_M, lng: 2 });
  assert.ok(Math.abs(d - 100) < 0.5);
});

test("filtre : precision trop faible, saut impossible, bruit a l'arret", () => {
  const a = point(0, 48, 2);
  assert.equal(accepterPoint(null, point(0, 48, 2, { precision: 80 })), false, "precision 80 m rejetee");
  assert.equal(accepterPoint(a, point(1000, 48 + 50 * DEG_PAR_M, 2)), false, "50 m en 1 s rejete");
  assert.equal(accepterPoint(a, point(1000, 48 + 0.5 * DEG_PAR_M, 2)), false, "0,5 m rejete comme bruit");
  assert.equal(accepterPoint(a, point(1000, 48 + 3 * DEG_PAR_M, 2)), true, "3 m en 1 s accepte");
  assert.equal(accepterPoint(a, point(0, 48 + 3 * DEG_PAR_M, 2)), false, "meme horodatage rejete");
});

/** Ligne droite vers le nord a 3 m/s exactement : 1 km toutes les 333,33 s. */
function ligneDroite(nbPoints: number, pasS = 1, vitesse = 3, segment = 0, tsDebut = 0): Point[] {
  return Array.from({ length: nbPoints }, (_, i) =>
    point(tsDebut + i * pasS * 1000, 48 + i * pasS * vitesse * DEG_PAR_M, 2, { segment }));
}

test("distance totale : 3 km a 3 m/s", () => {
  const d = distanceTotaleM(ligneDroite(1001));
  assert.ok(Math.abs(d - 3000) < 3, `obtenu ${d}`);
});

test("distance totale : une pause ne relie pas les segments", () => {
  const avant = ligneDroite(101, 1, 3, 0, 0);          // 300 m
  // pendant la pause on a marche 500 m plus loin, puis on repart sur un nouveau segment
  const apres = ligneDroite(101, 1, 3, 1, 600_000).map((p) => ({ ...p, lat: p.lat + 500 * DEG_PAR_M }));
  const d = distanceTotaleM([...avant, ...apres]);
  assert.ok(Math.abs(d - 600) < 3, `obtenu ${d}, la marche de 500 m ne doit pas compter`);
});

test("allure moyenne : 5 min/km", () => {
  assert.equal(allureSecParKm(2000, 600), 300);
  assert.equal(allureSecParKm(20, 600), null, "trop court");
});

test("allure instantanee sur 30 s", () => {
  const pts = ligneDroite(120);
  const a = allureInstantanee(pts, pts[pts.length - 1].ts);
  assert.ok(a !== null && Math.abs(a - 333.33) < 2, `obtenu ${a}`);
});

test("fractionnes : bornes interpolees, dernier morceau partiel", () => {
  // 2,5 km a 3 m/s : deux kilometres pleins de 333,3 s et un reste de 500 m
  const f = fractionnes(ligneDroite(834));
  assert.equal(f.length, 3);
  assert.ok(Math.abs(f[0].dureeS - 333.33) < 1, `km1 ${f[0].dureeS}`);
  assert.ok(Math.abs(f[1].dureeS - 333.33) < 1, `km2 ${f[1].dureeS}`);
  assert.equal(f[2].partiel, true);
  assert.ok(Math.abs(f[2].distanceM - 499) < 3, `reste ${f[2].distanceM}`);
});

test("fractionnes : la pause n'allonge pas le kilometre", () => {
  const avant = ligneDroite(201, 1, 3, 0, 0);            // 600 m en 200 s
  const apres = ligneDroite(201, 1, 3, 1, 900_000)       // reprise 15 min plus tard, 600 m en 200 s
    .map((p) => ({ ...p, lat: p.lat + 600 * DEG_PAR_M }));
  const f = fractionnes([...avant, ...apres]);
  assert.ok(Math.abs(f[0].dureeS - 333.33) < 1, `km1 ${f[0].dureeS} : la pause a ete comptee`);
});

test("denivele : le bruit d'altitude a l'arret ne compte pas", () => {
  // Oscillation de 4 m crete a crete, typique d'un GPS immobile.
  const pts = Array.from({ length: 60 }, (_, i) =>
    point(i * 1000, 48 + i * 3 * DEG_PAR_M, 2, { alt: 100 + (i % 2 ? 2 : -2) }));
  assert.equal(denivelePositifM(pts), 0, "un parcours plat ne doit produire aucun denivele");
});

test("denivele : une vraie montee est comptee, a 15 % pres", () => {
  // 100 m de montee reguliere. Le lissage rogne les extremites, d'ou la
  // tolerance : on verifie l'ordre de grandeur, pas une valeur exacte.
  const pts = Array.from({ length: 101 }, (_, i) =>
    point(i * 1000, 48 + i * 3 * DEG_PAR_M, 2, { alt: 100 + i }));
  const d = denivelePositifM(pts);
  assert.ok(d > 85 && d < 105, `obtenu ${d}, attendu autour de 100`);
});

test("denivele : une descente ne se soustrait pas au positif", () => {
  const monte = Array.from({ length: 51 }, (_, i) =>
    point(i * 1000, 48 + i * 3 * DEG_PAR_M, 2, { alt: 100 + i }));
  const descend = Array.from({ length: 51 }, (_, i) =>
    point((51 + i) * 1000, 48 + (51 + i) * 3 * DEG_PAR_M, 2, { alt: 150 - i }));
  const seul = denivelePositifM(monte);
  const allerRetour = denivelePositifM([...monte, ...descend]);
  assert.ok(Math.abs(allerRetour - seul) < 6, `montee seule ${seul}, aller-retour ${allerRetour}`);
});

test("meilleur kilometre : ignore le morceau partiel", () => {
  const pts = ligneDroite(834); // 2,5 km : deux km pleins puis un reste
  const m = meilleurKmS(pts);
  assert.ok(m !== null && Math.abs(m - 333.33) < 1, `obtenu ${m}`);
});
