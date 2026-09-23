import { decimal, defineStrings, intlLocale } from "./i18n.ts";
import { toDistanceUnits, toElevationUnits, toPaceUnits, toSpeedUnits } from "./units.ts";

/** Display formatting, in whichever language the interface speaks. */

/** A distance in the chosen unit, without the unit: "8,42". */
export function formatDistance(metres: number): string {
  const units = toDistanceUnits(metres);
  const text = units >= 10 ? units.toFixed(1) : units.toFixed(2);
  return decimal(text);
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
/** A pace in the chosen unit, without the unit: 5'12". Stored per kilometre, always. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm > 60 * 30) return "–'––\"";
  // Rounded once, as a whole, so 4'59"6 becomes 5'00" rather than 4'00".
  const total = Math.round(toPaceUnits(secPerKm));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}'${String(s).padStart(2, "0")}"`;
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
  return decimal(toSpeedUnits(metresPerSecond).toFixed(1));
}

/** Kilocalories, rounded: a decimal on an estimate would be a pretence. */
export function formatEnergy(kcal: number): string {
  return String(Math.round(kcal));
}

export function formatElevation(metres: number): string {
  return String(Math.round(toElevationUnits(metres)));
}

/**
 * Default name for a run, derived from when it started. Strava does the same,
 * and it is what makes a list of runs readable: "Course matinale" sticks in the
 * mind far better than a timestamp.
 */
const runNames = defineStrings({
  fr: {
    night: "Course nocturne", morning: "Course matinale", lunch: "Sortie du midi",
    afternoon: "Course de l'après-midi", evening: "Course du soir",
  },
  en: {
    night: "Night run", morning: "Morning run", lunch: "Lunch run",
    afternoon: "Afternoon run", evening: "Evening run",
  },
});

export function autoName(ts: number): string {
  const hour = new Date(ts).getHours();
  const names = runNames();
  if (hour < 5) return names.night;
  if (hour < 11) return names.morning;
  if (hour < 14) return names.lunch;
  if (hour < 18) return names.afternoon;
  if (hour < 22) return names.evening;
  return names.night;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(intlLocale(), {
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
  return Math.round(value).toLocaleString(intlLocale()).replace(/\u202f|\u00a0/g, "\u202f");
}
