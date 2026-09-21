/**
 * Calculs geographiques purs, sans dependance a React Native.
 * Tout ce qui touche a la distance, a l'allure et aux fractionnes vit ici,
 * pour etre teste avec Node sans appareil.
 */

export interface Point {
  /** Horodatage en millisecondes depuis l'epoque. */
  ts: number;
  lat: number;
  lng: number;
  alt: number | null;
  /** Rayon d'incertitude en metres, tel que rapporte par le GPS. */
  precision: number | null;
  /** Vitesse rapportee par le GPS en m/s, quand elle existe. */
  vitesse: number | null;
  /** Numero de segment : change a chaque reprise apres une pause. */
  segment: number;
}

const RAYON_TERRE_M = 6371008.8;

/** Au-dela, le point est trop flou pour compter : typique d'un depart en interieur. */
export const PRECISION_MAX_M = 30;
/** 12 m/s, soit 43 km/h : aucun coureur, mais un saut GPS classique. */
export const VITESSE_MAX_MS = 12;
/** En dessous, c'est du bruit GPS a l'arret, pas du deplacement. */
export const DEPLACEMENT_MIN_M = 1.5;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance a vol d'oiseau entre deux points, en metres (formule de haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Decide si un point GPS merite d'entrer dans la trace.
 * Le point precedent est celui du meme segment, ou null en debut de segment.
 */
export function accepterPoint(precedent: Point | null, p: Point): boolean {
  if (p.precision !== null && p.precision > PRECISION_MAX_M) return false;
  if (!precedent) return true;
  const dt = (p.ts - precedent.ts) / 1000;
  if (dt <= 0) return false;
  const d = distanceM(precedent, p);
  if (d < DEPLACEMENT_MIN_M) return false;
  if (d / dt > VITESSE_MAX_MS) return false;
  return true;
}

/** Regroupe les points par segment, dans l'ordre. */
export function segments(points: Point[]): Point[][] {
  const groupes: Point[][] = [];
  let courant: Point[] = [];
  let numero: number | null = null;
  for (const p of points) {
    if (numero !== null && p.segment !== numero) {
      if (courant.length) groupes.push(courant);
      courant = [];
    }
    numero = p.segment;
    courant.push(p);
  }
  if (courant.length) groupes.push(courant);
  return groupes;
}

/** Distance cumulee en metres, sans jamais relier deux segments entre eux. */
export function distanceTotaleM(points: Point[]): number {
  let total = 0;
  for (const seg of segments(points)) {
    for (let i = 1; i < seg.length; i++) total += distanceM(seg[i - 1], seg[i]);
  }
  return total;
}

/** Allure moyenne en secondes par kilometre, ou null si trop court pour etre parlant. */
export function allureSecParKm(distanceMetres: number, dureeS: number): number | null {
  if (distanceMetres < 50 || dureeS <= 0) return null;
  return dureeS / (distanceMetres / 1000);
}

/**
 * Allure sur les dernieres secondes, calculee sur le segment en cours.
 * Une fenetre de 30 s lisse le bruit GPS sans masquer un changement de rythme.
 */
export function allureInstantanee(points: Point[], maintenantTs: number, fenetreS = 30): number | null {
  const segs = segments(points);
  const seg = segs[segs.length - 1];
  if (!seg || seg.length < 2) return null;
  const depuis = maintenantTs - fenetreS * 1000;
  const recents = seg.filter((p) => p.ts >= depuis);
  if (recents.length < 2) return null;
  let d = 0;
  for (let i = 1; i < recents.length; i++) d += distanceM(recents[i - 1], recents[i]);
  const dureeS = (recents[recents.length - 1].ts - recents[0].ts) / 1000;
  if (d < 20 || dureeS <= 0) return null;
  return dureeS / (d / 1000);
}

export interface Fractionne {
  /** 1 pour le premier kilometre, etc. */
  km: number;
  /** Duree de ce kilometre en secondes. */
  dureeS: number;
  /** Vrai pour le dernier morceau quand il fait moins d'un kilometre. */
  partiel: boolean;
  /** Distance reelle du morceau en metres, utile surtout pour le partiel. */
  distanceM: number;
}

/**
 * Temps au kilometre. Le passage de chaque borne est interpole a l'interieur
 * du segment qui la franchit, plutot qu'arrondi au point GPS le plus proche.
 * Les pauses ne comptent pas : on travaille segment par segment, en temps actif.
 */
export function fractionnes(points: Point[]): Fractionne[] {
  const resultat: Fractionne[] = [];
  let cumul = 0;
  let borne = 1000;
  let tempsActif = 0; // secondes actives ecoulees au debut du segment courant
  let tempsDerniereBorne = 0;

  for (const seg of segments(points)) {
    const debutSeg = seg[0].ts;
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1];
      const b = seg[i];
      const d = distanceM(a, b);
      const tA = tempsActif + (a.ts - debutSeg) / 1000;
      const tB = tempsActif + (b.ts - debutSeg) / 1000;
      let deja = cumul;
      cumul += d;
      while (cumul >= borne) {
        const fraction = d > 0 ? (borne - deja) / d : 1;
        const tBorne = tA + fraction * (tB - tA);
        resultat.push({ km: borne / 1000, dureeS: tBorne - tempsDerniereBorne, partiel: false, distanceM: 1000 });
        tempsDerniereBorne = tBorne;
        deja = borne;
        borne += 1000;
      }
    }
    tempsActif += (seg[seg.length - 1].ts - debutSeg) / 1000;
  }

  const reste = cumul - (borne - 1000);
  if (reste > 50) {
    resultat.push({ km: borne / 1000, dureeS: tempsActif - tempsDerniereBorne, partiel: true, distanceM: reste });
  }
  return resultat;
}

/** Rectangle englobant, pour cadrer la carte. */
export function bornes(points: Point[]) {
  if (!points.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}
