/** Formatage a la francaise : virgule decimale, allure en minutes et secondes. */

export function formaterDistance(m: number): string {
  const km = m / 1000;
  const texte = km >= 10 ? km.toFixed(1) : km.toFixed(2);
  return texte.replace(".", ",");
}

export function formaterDuree(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const deux = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${deux(m)}:${deux(sec)}` : `${deux(m)}:${deux(sec)}`;
}

/** 312 s/km devient 5'12". Null devient un tiret. */
export function formaterAllure(secParKm: number | null): string {
  if (secParKm === null || !Number.isFinite(secParKm) || secParKm > 60 * 30) return "–'––\"";
  const m = Math.floor(secParKm / 60);
  const s = Math.round(secParKm % 60);
  return `${m}'${String(s === 60 ? 0 : s).padStart(2, "0")}"`;
}

export function formaterDenivele(m: number): string {
  return String(Math.round(m));
}

/**
 * Nom donne par defaut a une sortie, d'apres son heure de depart.
 * Strava fait de meme, et c'est ce qui rend une liste de courses lisible :
 * « Course matinale » se retient mieux qu'une date.
 */
export function nomAutomatique(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 5) return "Course nocturne";
  if (h < 11) return "Course matinale";
  if (h < 14) return "Sortie du midi";
  if (h < 18) return "Course de l'après-midi";
  if (h < 22) return "Course du soir";
  return "Course nocturne";
}

export function formaterDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
