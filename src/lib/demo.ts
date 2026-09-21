import { createRun, finishRun, insertPoints } from "./db";
import { buildDemoPoints, type DemoOptions } from "./demoTrack";
import { elevationGainM, fastestKmS, paceSecPerKm, segments, totalDistanceM } from "./geo";

/** Creates the run in the database and returns its id. */
export async function createDemoRun(options: DemoOptions = {}): Promise<number> {
  const startedAt = options.startedAt ?? Date.now() - 2 * 3600_000;
  const points = buildDemoPoints(options.targetM ?? 5000, startedAt);

  const id = await createRun(startedAt);
  await insertPoints(id, points);

  const distance = totalDistanceM(points);
  // Active time only, exactly as finishing a real run would compute it.
  const duration = segments(points)
    .reduce((total, s) => total + (s[s.length - 1].ts - s[0].ts) / 1000, 0);

  await finishRun(id, {
    endedAt: points[points.length - 1].ts,
    distanceM: distance,
    durationS: Math.round(duration),
    avgPaceSKm: paceSecPerKm(distance, duration),
    name: "Course de démonstration",
    elevationGainM: elevationGainM(points),
    fastestKmS: fastestKmS(points),
  });
  return id;
}
