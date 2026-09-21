/**
 * Active energy for a run, in kilocalories.
 *
 * Derived from the ACSM running equation rather than guessed. That equation
 * gives oxygen uptake as VO2 = 0.2 * speed + 3.5, in ml/kg/min, where the
 * constant is resting metabolism. Health wants *active* energy, so only the
 * 0.2 * speed term counts. Burning one litre of oxygen releases about 5 kcal:
 *
 *   kcal = 0.2 * speed(m/min) * weight(kg) * minutes * 5 / 1000
 *
 * and speed * minutes is simply the distance covered, so the pace cancels out
 * entirely, leaving one kilocalorie per kilogram per kilometre. A 70 kg runner
 * spends around 700 kcal over ten kilometres whether they take fifty minutes
 * or eighty — which matches what the equation says, and is why this function
 * never asks how fast the run was.
 *
 * The result is an estimate, and the app says so wherever it shows one.
 */
export function estimateActiveEnergyKcal(distanceM: number, weightKg: number): number | null {
  // Outside this range the number is someone else's data, or a broken scale,
  // and a wrong figure written into Health is worse than none at all.
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 250) return null;
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  return (weightKg * distanceM) / 1000;
}
