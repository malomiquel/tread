/**
 * Running shoes, and how far each pair has gone.
 *
 * A shoe's cushioning is spent by distance, not by age, and nobody keeps
 * count in their head. Every run is put against the pair it was run in, so
 * the count keeps itself; the runner only says which pair is on their feet
 * when it changes.
 */

export interface Shoe {
  id: number;
  name: string;
  addedAt: number;
  /** Distance already on the pair when it was added, in metres. */
  startM: number;
  /** Where it should be replaced, in metres. */
  limitM: number;
  /** Put away: kept for its history, no longer offered for new runs. */
  retired: boolean;
  /** The pair new runs are put against. */
  isDefault: boolean;
  /** Everything it has covered: its starting distance plus its runs. */
  distanceM: number;
  runs: number;
}

/**
 * Where a pair is usually replaced.
 *
 * CHOSEN from the range shoe makers and running shops quote, 500 to 800 km;
 * the middle of it, and the runner can move it either way.
 */
export const DEFAULT_LIMIT_M = 700_000;
export const MIN_LIMIT_M = 200_000;
export const MAX_LIMIT_M = 2_000_000;

/** Past this share of its limit, a pair is said to be nearly done. */
const SOON = 0.9;

export type Wear = "fresh" | "soon" | "worn";

export function wearOf(shoe: Pick<Shoe, "distanceM" | "limitM">): { share: number; wear: Wear } {
  const share = shoe.limitM > 0 ? shoe.distanceM / shoe.limitM : 0;
  return { share, wear: share >= 1 ? "worn" : share >= SOON ? "soon" : "fresh" };
}

/**
 * One step of a distance setting — a limit or a starting distance — in the
 * runner's unit: fifty at a time, whole kilometres or whole miles.
 */
export function nudgeDistance(metres: number, unitM: number, direction: 1 | -1, min: number, max: number): number {
  const step = 50 * unitM;
  // Snapped to the step first, so a limit set in kilometres moves in round
  // miles once the runner switches, rather than carrying the odd remainder.
  const steps = metres / step;
  const aligned = Math.abs(steps - Math.round(steps)) < 1e-6;
  const next = aligned
    ? (Math.round(steps) + direction) * step
    : (direction > 0 ? Math.ceil(steps) : Math.floor(steps)) * step;
  return Math.min(max, Math.max(min, Math.round(next)));
}

/** Pairs in the order worth showing: the default first, then by what they have left. */
export function shoeOrder(shoes: readonly Shoe[]): Shoe[] {
  return [...shoes].sort((a, b) =>
    Number(a.retired) - Number(b.retired)
    || Number(b.isDefault) - Number(a.isDefault)
    || b.addedAt - a.addedAt);
}
