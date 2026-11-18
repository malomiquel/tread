/**
 * Laps: stretches of a run the runner marked by hand.
 *
 * A kilometre split is the app's idea of where a run divides; a lap is the
 * runner's. On a track, up a hill, round a block, the stretch that matters is
 * the one they chose, and only they know where it began.
 *
 * Only the marks are stored — where the run stood, in distance and active
 * time, at each press. The laps themselves are the gaps between them, worked
 * out when read, so the stored shape cannot disagree with itself.
 */

/** Where the run stood when the lap button was pressed. */
export interface LapMark {
  /** Distance covered by then, in metres. */
  distanceM: number;
  /** Active time by then, in seconds: pauses do not count. */
  durationS: number;
}

export interface Lap {
  /** From 1. */
  number: number;
  distanceM: number;
  durationS: number;
  /** Seconds per kilometre, or null for a lap too short to have one. */
  paceSKm: number | null;
  /** The stretch after the last mark, to the finish: not a lap anyone pressed. */
  partial: boolean;
}

/** Shorter than this, a lap has no meaningful pace: a double press, a stop. */
const PACED_FROM_M = 20;

/**
 * The laps of a run, from its marks and where it finished.
 *
 * The stretch after the last press is a lap as well, marked partial: on a
 * track it is the cool-down, and leaving it out would make the laps add up to
 * less than the run. None at all without a mark: a run nobody lapped is one
 * lap, and a table of one row says nothing the run does not.
 */
export function lapsOf(marks: readonly LapMark[], totalM: number, totalS: number): Lap[] {
  if (marks.length === 0) return [];
  const laps: Lap[] = [];
  let from: LapMark = { distanceM: 0, durationS: 0 };
  const ends = [...marks, { distanceM: totalM, durationS: totalS }];
  ends.forEach((end, i) => {
    const distanceM = Math.max(0, end.distanceM - from.distanceM);
    const durationS = Math.max(0, end.durationS - from.durationS);
    const partial = i === ends.length - 1;
    from = end;
    // A finish pressed straight after the last lap leaves nothing to show.
    if (partial && distanceM < 1 && durationS < 1) return;
    laps.push({
      number: i + 1,
      distanceM,
      durationS,
      paceSKm: distanceM >= PACED_FROM_M && durationS > 0 ? durationS / (distanceM / 1000) : null,
      partial,
    });
  });
  return laps;
}

/** A stored set of marks, or an empty one for anything unreadable. */
export function parseLaps(raw: string | null): LapMark[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((mark): mark is LapMark =>
      typeof mark === "object" && mark !== null
      && typeof (mark as LapMark).distanceM === "number"
      && typeof (mark as LapMark).durationS === "number");
  } catch {
    return [];
  }
}
