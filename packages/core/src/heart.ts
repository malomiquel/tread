import { defineStrings } from "./i18n.ts";
/**
 * Heart rate, as a run leaves it behind in Apple Health.
 *
 * Nothing here talks to HealthKit: this is the arithmetic, so it can be
 * tested without a phone. The samples come from health.ts, which is the only
 * file that knows Apple exists.
 *
 * The app measures nothing itself. A phone in a pocket has no idea what a
 * heart is doing, and the watch that does already writes it down — so this
 * reads what was recorded rather than pretending to a sensor the app has not
 * got.
 */

/** One reading: a moment, and a rate in beats per minute. */
export interface Beat {
  ts: number;
  bpm: number;
}

/** What is kept of a run's heart rate, once the samples have been weighed. */
export interface Heart {
  /** Average over the run, weighted by how long each reading stood. */
  avgBpm: number;
  maxBpm: number;
  /** Seconds spent in each zone, hardest last. Empty when there is no ceiling to cut against. */
  zonesS: number[];
  /**
   * The maximum the zones were cut against, or null when the app could not
   * work one out — in which case there are no zones, only an average and a
   * peak.
   */
  maxHeartRate: number | null;
}

/** How many zones a heart rate is cut into. */
export const ZONE_COUNT = 5;

/** The five zones, named for what they are for rather than by number alone. */
const zoneNames = defineStrings({
  fr: ["Récupération", "Endurance", "Tempo", "Seuil", "Maximal"],
  en: ["Recovery", "Endurance", "Tempo", "Threshold", "Maximum"],
});

/** A zone's name, from 0 for the easiest. */
export const zoneName = (zone: number): string => zoneNames()[zone] ?? `Z${zone + 1}`;

/**
 * Where each zone ends, as a share of the maximum heart rate.
 *
 * The five-zone split every coach and every watch uses: under sixty percent
 * is recovery, over ninety is a place nobody spends long. The boundaries are
 * conventions rather than measurements — a real threshold is found in a lab
 * or in a hard twenty minutes — and the app says so where it shows them.
 */
const ZONE_CEILINGS = [0.6, 0.7, 0.8, 0.9] as const;

/**
 * A rate the app is willing to believe.
 *
 * A watch losing contact with a wrist reports figures that are not heart
 * rates, and one of them inside a maximum would rewrite a whole run.
 */
const PLAUSIBLE = { min: 30, max: 240 } as const;

/**
 * The longest a single reading is allowed to stand for.
 *
 * A watch samples every few seconds while a workout is running. A gap wider
 * than this means it stopped reporting — a pause, a wrist scratched, a lost
 * connection — and carrying the last figure across the hole would credit a
 * zone with time nobody spent in it.
 */
const MAX_GAP_S = 30;

/**
 * The classic maximum heart rate: two hundred and twenty, less your age.
 *
 * It is a rule of thumb and a poor one for any given person — the spread
 * around it is something like ten beats either way — but it is the rule every
 * watch on the market uses, and being wrong in the same direction as everyone
 * else is what makes the zones comparable at all. Null rather than a guess
 * when Health has no date of birth on file.
 */
export function maxHeartRateFor(bornAt: number | null, at: number): number | null {
  if (bornAt === null || !Number.isFinite(bornAt)) return null;
  const years = (at - bornAt) / (365.2425 * 24 * 60 * 60 * 1000);
  if (years < 5 || years > 110) return null;
  return Math.round(220 - years);
}

/** Which zone a rate falls in, from 0 for the easiest to 4 for the hardest. */
export function zoneOf(bpm: number, maxHeartRate: number): number {
  const share = bpm / maxHeartRate;
  const found = ZONE_CEILINGS.findIndex((ceiling) => share < ceiling);
  return found === -1 ? ZONE_CEILINGS.length : found;
}

/**
 * Weigh a run's readings into an average, a peak and time per zone.
 *
 * Every figure is weighted by how long it stood rather than counted once,
 * because the samples do not arrive evenly: a watch reports every five
 * seconds during a workout and every few minutes outside one, and an
 * unweighted average of the two would let a quiet minute count as much as a
 * hard interval.
 */
export function summarise(beats: Beat[], maxHeartRate: number | null): Heart | null {
  const usable = beats
    .filter((beat) => Number.isFinite(beat.ts)
      && beat.bpm >= PLAUSIBLE.min && beat.bpm <= PLAUSIBLE.max)
    .sort((a, b) => a.ts - b.ts);
  if (usable.length === 0) return null;

  const zonesS = maxHeartRate === null ? [] : Array.from({ length: ZONE_COUNT }, () => 0);
  let weighted = 0;
  let total = 0;
  let peak = 0;

  usable.forEach((beat, index) => {
    const next = usable[index + 1];
    // The last reading stands for as long as the one before it did, since
    // there is no gap left to measure it against.
    const gapS = next
      ? Math.min((next.ts - beat.ts) / 1000, MAX_GAP_S)
      : Math.min(total > 0 ? total / index : 1, MAX_GAP_S);
    const seconds = Math.max(gapS, 0.001);

    weighted += beat.bpm * seconds;
    total += seconds;
    peak = Math.max(peak, beat.bpm);
    if (maxHeartRate !== null) zonesS[zoneOf(beat.bpm, maxHeartRate)] += seconds;
  });

  return {
    avgBpm: Math.round(weighted / total),
    maxBpm: Math.round(peak),
    zonesS: zonesS.map((seconds) => Math.round(seconds)),
    maxHeartRate,
  };
}

/** Beats per minute, whole: a heart rate with a decimal is a graph, not a figure. */
export function formatBpm(bpm: number): string {
  return String(Math.round(bpm));
}

/**
 * A summary back out of the database, where it is kept as one json column.
 *
 * Unreadable is the same as absent, as it is everywhere else in this schema:
 * a run is worth keeping without knowing what its heart did.
 */
export function parseHeart(raw: string | null): Heart | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const fields = parsed as Record<string, unknown>;
    const avgBpm = fields.avgBpm;
    const maxBpm = fields.maxBpm;
    if (typeof avgBpm !== "number" || !Number.isFinite(avgBpm)) return null;
    if (typeof maxBpm !== "number" || !Number.isFinite(maxBpm)) return null;
    const zones = fields.zonesS;
    return {
      avgBpm,
      maxBpm,
      zonesS: Array.isArray(zones)
        ? zones.map((seconds) => (typeof seconds === "number" && seconds > 0 ? seconds : 0))
        : [],
      maxHeartRate: typeof fields.maxHeartRate === "number" ? fields.maxHeartRate : null,
    };
  } catch {
    return null;
  }
}
