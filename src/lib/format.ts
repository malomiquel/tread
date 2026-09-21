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

/**
 * Speed in kilometres per hour, the other way of saying a pace.
 *
 * Both are shown because runners do not think in one or the other by habit
 * so much as by discipline: a pace answers "how long is this kilometre going
 * to take", a speed answers "how fast am I going", and the same run reads
 * differently through each.
 */
export function formatSpeed(metresPerSecond: number): string {
  if (!Number.isFinite(metresPerSecond) || metresPerSecond <= 0) return "–";
  return (metresPerSecond * 3.6).toFixed(1).replace(".", ",");
}

/** Kilocalories, rounded: a decimal on an estimate would be a pretence. */
export function formatEnergy(kcal: number): string {
  return String(Math.round(kcal));
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


/**
 * A count with its thousands set apart — "8 432".
 *
 * A narrow no-break space, which is what French typography uses and what
 * keeps the number from breaking across a line. Four figures side by side
 * with nothing between them read as a reference number rather than a
 * quantity.
 */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, "\u202f");
}
