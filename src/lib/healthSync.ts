import { knownHealthUuids, listRuns, readSettings, saveImportedRun, writeSetting } from "./db";
import { readNewWorkouts, requestHealthAccess } from "./health";
import { alreadyHere, toImportedRun } from "./healthImport";
import { refreshHomeWidget } from "./homeWidget";
import { getSettings, setHealthImport } from "./settings";

/** Where the last read of Health stopped. */
const ANCHOR_KEY = "healthAnchor";

let running: Promise<number> | null = null;

/**
 * Bring in the runs a watch wrote to Health since the last time, and return
 * how many arrived.
 *
 * Called at launch and whenever the app comes back to the screen, when it is
 * switched on. One at a time: two overlapping reads would both see the same
 * new workouts before either had saved them.
 */
export function importFromHealth(): Promise<number> {
  if (!getSettings().healthImport) return Promise.resolve(0);
  running ??= (async () => {
    try {
      const anchor = (await readSettings())[ANCHOR_KEY];
      const answer = await readNewWorkouts(anchor);
      if (!answer) return 0;
      const known = await knownHealthUuids();
      const runs = await listRuns();
      let added = 0;
      for (const workout of answer.workouts) {
        if (known.has(workout.uuid) || alreadyHere(runs, workout)) continue;
        await saveImportedRun(toImportedRun(workout), workout.uuid, workout.sourceName);
        added += 1;
      }
      await writeSetting(ANCHOR_KEY, answer.anchor);
      if (added > 0) void refreshHomeWidget();
      return added;
    } catch {
      return 0;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Switch the import on — asking Health first — or off. */
export async function enableHealthImport(on: boolean): Promise<number> {
  if (!on) {
    await setHealthImport(false);
    return 0;
  }
  await requestHealthAccess();
  await setHealthImport(true);
  return importFromHealth();
}
