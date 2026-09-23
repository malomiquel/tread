import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { archiveFileName, buildArchive } from "./archive";
import { backfillEfforts, importRun, listRuns, readRun, saveRoute } from "./db";
import { defineStrings } from "./i18n";
import { parseGpx, parseGpxLine } from "./gpx";
import { placeName } from "./location";
import { autoRouteName, routeFromLine } from "./route";

/**
 * Files in and out: GPX runs, GPX routes, and the archive of everything.
 *
 * These used to be written inside the lists they fill, behind two unlabelled
 * icons in each header. Pulled out here so that the same doors can be offered
 * where people look for them — the settings, and the empty lists — without
 * two copies of the parsing drifting apart.
 *
 * Each function answers with the sentence to show, or null when the picker
 * was dismissed. What to do with the sentence belongs to the screen.
 */

/** Loose on purpose: a GPX arrives declared as XML, as plain text or as nothing at all. */
const GPX_TYPES = ["application/gpx+xml", "application/xml", "text/xml", "*/*"];

async function pickGpx(): Promise<DocumentPicker.DocumentPickerAsset[] | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: GPX_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
  });
  return picked.canceled ? null : picked.assets;
}

const fileWords = defineStrings({
  fr: {
    runsAdded: (n: number) => `${n} course${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}`,
    known: (n: number) => `${n} déjà connue${n > 1 ? "s" : ""}`,
    unreadable: (n: number) => `${n} illisible${n > 1 ? "s" : ""}`,
    noRuns: "Aucune course dans ces fichiers.",
    routesAdded: (n: number) => `${n} parcours ajouté${n > 1 ? "s" : ""}`,
    empty: (n: number) => `${n} fichier${n > 1 ? "s" : ""} sans tracé`,
    noRoutes: "Aucun tracé dans ces fichiers.",
    noShare: "Impossible d'ouvrir la feuille de partage sur cet appareil.",
    exported: (n: number) => `${n} course${n > 1 ? "s" : ""} exportée${n > 1 ? "s" : ""}`,
  },
  en: {
    runsAdded: (n: number) => `${n} run${n === 1 ? "" : "s"} added`,
    known: (n: number) => `${n} already here`,
    unreadable: (n: number) => `${n} unreadable`,
    noRuns: "No runs in these files.",
    routesAdded: (n: number) => `${n} route${n === 1 ? "" : "s"} added`,
    empty: (n: number) => `${n} file${n === 1 ? "" : "s"} without a track`,
    noRoutes: "No tracks in these files.",
    noShare: "The share sheet can't be opened on this device.",
    exported: (n: number) => `${n} run${n === 1 ? "" : "s"} exported`,
  },
});

/**
 * Runs from GPX files: an old app, a watch, or an archive this app wrote.
 * Runs already known are counted and skipped rather than refused.
 */
export async function importRunFiles(): Promise<string | null> {
  const assets = await pickGpx();
  if (!assets) return null;

  let added = 0;
  let known = 0;
  let unreadable = 0;
  for (const asset of assets) {
    try {
      const { name, points } = parseGpx(await new File(asset.uri).text());
      const id = await importRun(name, points);
      if (id === null) known += 1;
      else added += 1;
    } catch {
      unreadable += 1;
    }
  }

  // Their best efforts, so the records count them straight away.
  if (added > 0) await backfillEfforts().catch(() => 0);

  const words = fileWords();
  return [
    added > 0 ? words.runsAdded(added) : null,
    known > 0 ? words.known(known) : null,
    unreadable > 0 ? words.unreadable(unreadable) : null,
  ].filter(Boolean).join(" · ") || words.noRuns;
}

/**
 * Routes from GPX files.
 *
 * What arrives is a line with no decisions in it, so handles are invented
 * along it at even intervals: the geometry is kept exactly as the file has
 * it, and the handles are only somewhere to take hold. No picture is taken —
 * the map that would take one is not on screen — so the list draws the bare
 * shape until the route is opened and saved once.
 */
export async function importRouteFiles(): Promise<string | null> {
  const assets = await pickGpx();
  if (!assets) return null;

  let added = 0;
  let empty = 0;
  for (const asset of assets) {
    try {
      const { name, line } = parseGpxLine(await new File(asset.uri).text());
      if (line.length < 2) {
        empty += 1;
        continue;
      }
      const place = await placeName(line[0].lat, line[0].lng);
      await saveRoute(name?.trim() || autoRouteName(Date.now()), routeFromLine(line), {
        place,
        preview: null,
      });
      added += 1;
    } catch {
      empty += 1;
    }
  }

  const words = fileWords();
  return [
    added > 0 ? words.routesAdded(added) : null,
    empty > 0 ? words.empty(empty) : null,
  ].filter(Boolean).join(" · ") || words.noRoutes;
}

/**
 * Every run, as one zip of GPX files, handed to the share sheet.
 *
 * Readable by any other running app, which makes it the way out as much as a
 * backup. Answers null when there was nothing to export.
 */
export async function exportRunArchive(): Promise<string | null> {
  const runs = await listRuns();
  if (runs.length === 0) return null;

  const loaded = [];
  for (const run of runs) {
    const stored = await readRun(run.id);
    if (stored) loaded.push({ run: stored.run, points: stored.points });
  }

  const file = new File(Paths.cache, archiveFileName());
  file.create({ overwrite: true });
  file.write(await buildArchive(loaded), { encoding: "base64" });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(fileWords().noShare);
  }
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip", UTI: "public.zip-archive" });
  return fileWords().exported(loaded.length);
}
