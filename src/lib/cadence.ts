/**
 * Steps per minute, from a count and the time it took.
 *
 * Both feet: a hundred and eighty is the figure coaches quote, and it counts
 * every footfall rather than every stride. Rounded, because no runner holds a
 * cadence to the decimal and showing one would claim a precision the sensor
 * does not have.
 */
export function cadenceSpm(steps: number, seconds: number): number | null {
  if (!Number.isFinite(steps) || !Number.isFinite(seconds)) return null;
  if (steps <= 0 || seconds <= 0) return null;
  const spm = Math.round((steps / seconds) * 60);
  // Beyond four hundred a minute nothing is running, and below sixty nothing
  // is either: a figure outside those is the sensor reporting something other
  // than a run, and a wrong cadence is worse than none.
  return spm >= 60 && spm <= 400 ? spm : null;
}


/**
 * Steps taken, read back out of the cadence that was stored instead of them.
 *
 * The pedometer is asked for a count at the end of a run and the count is
 * turned into a cadence, which is what a runner acts on; the raw figure was
 * never kept. It comes back exactly, because the one is only ever the other
 * divided by the minutes — give or take the rounding a cadence carries, which
 * is a handful of steps in several thousand and invisible at the size this is
 * read.
 *
 * Deriving it this way also means every run already recorded has a step count,
 * where storing it from now on would leave the whole history without one.
 */
export function stepsFrom(cadenceSpm: number | null, seconds: number): number | null {
  if (cadenceSpm === null) return null;
  if (!Number.isFinite(cadenceSpm) || !Number.isFinite(seconds)) return null;
  if (cadenceSpm <= 0 || seconds <= 0) return null;
  return Math.round((cadenceSpm * seconds) / 60);
}
