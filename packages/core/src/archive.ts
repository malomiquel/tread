import JSZip from "jszip";
import { gpxFileName, toGpx, type GpxRun } from "./gpx.ts";
import type { TrackPoint } from "./geo.ts";

export interface ArchivedRun {
  run: GpxRun;
  points: TrackPoint[];
}

/**
 * Packs every run into one zip of GPX files, base64 encoded so it can be
 * handed straight to the file system.
 *
 * One file per run rather than a single multi-track GPX: the format allows
 * several tracks in one document, but most tools import only the first, which
 * would make the archive useless for the one job it exists to do.
 *
 * Deflate rather than stored: GPX is verbose XML and compresses to roughly a
 * tenth, which is the difference between an archive that fits in a message and
 * one that does not.
 */
export async function buildArchive(runs: ArchivedRun[]): Promise<string> {
  const zip = new JSZip();
  const used = new Set<string>();

  for (const { run, points } of runs) {
    // Two runs on the same day with the same name would collide, and a zip
    // silently keeps only the last entry of a duplicated path.
    let name = gpxFileName(run);
    let suffix = 2;
    while (used.has(name)) {
      name = gpxFileName(run).replace(/\.gpx$/, `-${suffix}.gpx`);
      suffix += 1;
    }
    used.add(name);
    zip.file(name, toGpx(run, points));
  }

  return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
}

/** File name for the archive itself, dated so successive backups sort. */
export function archiveFileName(now = Date.now()): string {
  return `tread-courses-${new Date(now).toISOString().slice(0, 10)}.zip`;
}
