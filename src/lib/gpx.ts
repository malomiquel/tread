// Extension explicite, contrairement au reste du code : ce module est
// exerce par des tests qui tournent sous Node seul, dont le resolveur ESM
// n'ajoute pas d'extension. Metro accepte les deux formes.
import { segments, type TrackPoint } from "./geo.ts";

/** Minimal subset of a run needed to describe it in a GPX file. */
export interface GpxRun {
  name: string | null;
  startedAt: number;
}

const escapeXml = (text: string): string =>
  text.replace(/[<>&'"]/g, (char) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);

const iso = (ts: number): string => new Date(ts).toISOString();

/**
 * Serialise a run as GPX 1.1, the interchange format every other running tool
 * reads. This is what keeps the app honest: your runs are never locked in, and
 * you can take them to Strava, Garmin or anywhere else whenever you like.
 *
 * One <trkseg> per segment, so a pause stays a genuine gap rather than a
 * straight line drawn through wherever you happened to walk.
 */
export function toGpx(run: GpxRun, points: TrackPoint[]): string {
  const name = escapeXml(run.name ?? "Run");
  const tracks = segments(points)
    .map((track) => {
      const fixes = track
        .map((p) => {
          const elevation = p.alt !== null ? `<ele>${p.alt.toFixed(1)}</ele>` : "";
          return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${elevation}<time>${iso(p.ts)}</time></trkpt>`;
        })
        .join("\n");
      return `    <trkseg>\n${fixes}\n    </trkseg>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Tread" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${iso(run.startedAt)}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>running</type>
${tracks}
  </trk>
</gpx>
`;
}

/** File name for an exported run: sortable, and safe on every file system. */
export function gpxFileName(run: GpxRun): string {
  const date = new Date(run.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const slug = (run.name ?? "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `tread-${date}-${slug || "run"}.gpx`;
}
