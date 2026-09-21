import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useSyncExternalStore } from "react";
import { ajouterPoints, creerCourse, terminerCourse } from "./bd";
import { nomAutomatique } from "./format";
import { accepterPoint, allureSecParKm, denivelePositifM, distanceTotaleM, meilleurKmS, type Point } from "./geo";

export const NOM_TACHE = "tread-suivi-gps";

export type EtatSuivi = "inactif" | "en_cours" | "en_pause";

export interface Suivi {
  etat: EtatSuivi;
  courseId: number | null;
  points: Point[];
  /** Segment courant ; incremente a chaque reprise pour ne pas relier les pauses. */
  segment: number;
  debutTs: number | null;
  /** Temps actif deja ecoule avant le segment en cours, en secondes. */
  dureeAccumuleeS: number;
  /** Debut du segment actif, null en pause. */
  debutSegmentTs: number | null;
  /** Precision du dernier point recu, meme rejete : sert d'indicateur de signal. */
  precisionM: number | null;
  /** Vrai si la tache de fond est active, faux en repli premier plan (Expo Go). */
  modeFond: boolean;
  erreur: string | null;
}

const INITIAL: Suivi = {
  etat: "inactif", courseId: null, points: [], segment: 0, debutTs: null,
  dureeAccumuleeS: 0, debutSegmentTs: null, precisionM: null, modeFond: false, erreur: null,
};

let etat: Suivi = INITIAL;
const auditeurs = new Set<() => void>();
let abonnement: Location.LocationSubscription | null = null;
let pointsEnregistres = 0;
let ecritureEnCours: Promise<void> = Promise.resolve();

function publier(patch: Partial<Suivi>): void {
  etat = { ...etat, ...patch };
  for (const a of auditeurs) a();
}

export function souscrire(a: () => void): () => void {
  auditeurs.add(a);
  return () => { auditeurs.delete(a); };
}
export const lire = (): Suivi => etat;
export function useSuivi(): Suivi {
  return useSyncExternalStore(souscrire, lire, lire);
}

/** Temps actif total en secondes, a l'instant donne. */
export function dureeActiveS(s: Suivi, maintenantTs: number): number {
  return s.dureeAccumuleeS + (s.debutSegmentTs !== null ? (maintenantTs - s.debutSegmentTs) / 1000 : 0);
}

// La tache doit etre definie au chargement du module, hors de tout composant :
// le systeme peut reveiller l'app directement dessus, sans passer par l'interface.
// SDK 57 exige un executeur asynchrone, meme si le travail ici est synchrone.
TaskManager.defineTask(NOM_TACHE, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const l of locations) ajouterPosition(l);
});

function versPoint(l: Location.LocationObject): Point {
  return {
    ts: l.timestamp, lat: l.coords.latitude, lng: l.coords.longitude, alt: l.coords.altitude,
    precision: l.coords.accuracy, vitesse: l.coords.speed, segment: etat.segment,
  };
}

export function ajouterPosition(l: Location.LocationObject): void {
  const p = versPoint(l);
  if (etat.etat !== "en_cours") {
    publier({ precisionM: p.precision });
    return;
  }
  const dernier = etat.points.length ? etat.points[etat.points.length - 1] : null;
  const precedent = dernier && dernier.segment === p.segment ? dernier : null;
  if (!accepterPoint(precedent, p)) {
    publier({ precisionM: p.precision });
    return;
  }
  publier({ points: [...etat.points, p], precisionM: p.precision });
  if (etat.points.length - pointsEnregistres >= 20) void enregistrer();
}

/** Ecrit sur disque les points pas encore sauves, sans jamais chevaucher deux ecritures. */
function enregistrer(): Promise<void> {
  ecritureEnCours = ecritureEnCours.then(async () => {
    if (etat.courseId === null) return;
    const aEcrire = etat.points.slice(pointsEnregistres);
    if (!aEcrire.length) return;
    await ajouterPoints(etat.courseId, aEcrire);
    pointsEnregistres += aEcrire.length;
  }).catch(() => undefined);
  return ecritureEnCours;
}

async function demarrerGps(): Promise<boolean> {
  const premierPlan = await Location.requestForegroundPermissionsAsync();
  if (premierPlan.status !== "granted") throw new Error("Sans autorisation de localisation, impossible de tracer la course.");

  // Arriere-plan si possible : indispensable ecran verrouille. Echoue proprement
  // dans Expo Go, qui ne le propose pas, et on retombe sur le premier plan.
  try {
    if (await Location.isBackgroundLocationAvailableAsync()) {
      const fond = await Location.requestBackgroundPermissionsAsync();
      if (fond.status === "granted") {
        await Location.startLocationUpdatesAsync(NOM_TACHE, {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3,
          timeInterval: 1000,
          activityType: Location.ActivityType.Fitness,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: "Course en cours",
            notificationBody: "Le suivi GPS continue, meme ecran verrouille.",
            notificationColor: "#c8ff3d",
          },
        });
        return true;
      }
    }
  } catch {
    /* pas de fond disponible : repli ci-dessous */
  }

  abonnement = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 1000 },
    ajouterPosition,
  );
  return false;
}

async function arreterGps(): Promise<void> {
  abonnement?.remove();
  abonnement = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(NOM_TACHE)) {
      await Location.stopLocationUpdatesAsync(NOM_TACHE);
    }
  } catch {
    /* deja arrete */
  }
}

export async function demarrer(): Promise<void> {
  if (etat.etat !== "inactif") return;
  publier({ erreur: null });
  try {
    const debut = Date.now();
    const courseId = await creerCourse(debut);
    pointsEnregistres = 0;
    publier({
      etat: "en_cours", courseId, points: [], segment: 0, debutTs: debut,
      dureeAccumuleeS: 0, debutSegmentTs: debut, modeFond: false,
    });
    const fond = await demarrerGps();
    publier({ modeFond: fond });
  } catch (e) {
    await arreterGps();
    publier({ ...INITIAL, erreur: e instanceof Error ? e.message : "Impossible de demarrer la course." });
  }
}

export function mettreEnPause(): void {
  if (etat.etat !== "en_cours" || etat.debutSegmentTs === null) return;
  const ecoule = (Date.now() - etat.debutSegmentTs) / 1000;
  publier({ etat: "en_pause", dureeAccumuleeS: etat.dureeAccumuleeS + ecoule, debutSegmentTs: null });
  void enregistrer();
}

export function reprendre(): void {
  if (etat.etat !== "en_pause") return;
  publier({ etat: "en_cours", segment: etat.segment + 1, debutSegmentTs: Date.now() });
}

/** Cloture la course et rend son identifiant, ou null si rien n'etait en cours. */
export async function terminer(): Promise<number | null> {
  if (etat.etat === "inactif" || etat.courseId === null) return null;
  const maintenant = Date.now();
  const duree = dureeActiveS(etat, maintenant);
  const courseId = etat.courseId;
  const points = etat.points;
  publier({ etat: "en_pause", debutSegmentTs: null, dureeAccumuleeS: duree });
  await arreterGps();
  await enregistrer();
  const distance = distanceTotaleM(points);
  await terminerCourse(courseId, {
    fin: maintenant,
    distance_m: distance,
    duree_s: Math.round(duree),
    allure_moy_s_km: allureSecParKm(distance, duree),
    nom: nomAutomatique(etat.debutTs ?? maintenant),
    denivele_m: denivelePositifM(points),
    meilleur_km_s: meilleurKmS(points),
  });
  etat = INITIAL;
  pointsEnregistres = 0;
  for (const a of auditeurs) a();
  return courseId;
}

export async function abandonner(): Promise<void> {
  if (etat.etat === "inactif") return;
  await arreterGps();
  etat = INITIAL;
  for (const a of auditeurs) a();
}
