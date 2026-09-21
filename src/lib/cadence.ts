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
