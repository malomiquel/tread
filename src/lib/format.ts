/** Display formatting. Strings are French, since the interface is. */

export function formatDistance(metres: number): string {
  const km = metres / 1000;
  const text = km >= 10 ? km.toFixed(1) : km.toFixed(2);
  return text.replace(".", ",");
}

export function formatDuration(totalS: number): string {
  const seconds = Math.max(0, Math.floor(totalS));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 312 s/km becomes 5'12". Null becomes a dash. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm > 60 * 30) return "–'––\"";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s === 60 ? 0 : s).padStart(2, "0")}"`;
}

export function formatElevation(metres: number): string {
  return String(Math.round(metres));
}

/**
 * Default name for a run, derived from when it started. Strava does the same,
 * and it is what makes a list of runs readable: "Course matinale" sticks in the
 * mind far better than a timestamp.
 */
export function autoName(ts: number): string {
  const hour = new Date(ts).getHours();
  if (hour < 5) return "Course nocturne";
  if (hour < 11) return "Course matinale";
  if (hour < 14) return "Sortie du midi";
  if (hour < 18) return "Course de l'après-midi";
  if (hour < 22) return "Course du soir";
  return "Course nocturne";
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
