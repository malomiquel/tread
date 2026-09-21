// Explicit extension, unlike the rest of the code: this module is exercised
// by tests running under Node alone, whose ESM resolver adds no extension.
// Metro accepts either form.
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

/**
 * Read a GPX file back into points.
 *
 * Deliberately forgiving. A GPX file written by Garmin, Coros or a watch from
 * a decade ago is only loosely the same document as the one this app writes:
 * namespaces differ, elevation may be absent, times may be missing from every
 * point but the first. So this reads what it recognises and ignores the rest,
 * rather than refusing a file over a detail nobody but a validator cares
 * about.
 *
 * Each <trkseg> becomes a segment, which is how a pause survives the round
 * trip out of the app and back in.
 */
export function parseGpx(xml: string): { name: string | null; points: TrackPoint[] } {
  const points: TrackPoint[] = [];
  let segment = 0;

  for (const chunk of xml.split(/<trkseg[^>]*>/i).slice(1)) {
    const inner = chunk.split(/<\/trkseg>/i)[0];
    let seen = 0;

    for (const m of inner.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/gi)) {
      const attributes = m[1] ?? m[3] ?? "";
      const body = m[2] ?? "";
      const lat = Number(/\blat\s*=\s*"([^"]+)"/i.exec(attributes)?.[1]);
      const lng = Number(/\blon\s*=\s*"([^"]+)"/i.exec(attributes)?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const stamp = /<time>([^<]+)<\/time>/i.exec(body)?.[1];
      const ts = stamp ? Date.parse(stamp) : Number.NaN;
      const altitude = Number(/<ele>([^<]+)<\/ele>/i.exec(body)?.[1]);

      points.push({
        ts: Number.isFinite(ts) ? ts : Number.NaN,
        lat,
        lng,
        alt: Number.isFinite(altitude) ? altitude : null,
        // Nothing is known about how good these fixes were, and pretending
        // otherwise would let the import filter throw away a real run.
        accuracy: null,
        speed: null,
        segment,
      });
      seen += 1;
    }
    if (seen) segment += 1;
  }

  // A file whose points carry no time is still a route worth keeping; it is
  // given one second apart so the run has a shape, and its duration will read
  // as the number of points, which is visibly wrong rather than quietly so.
  const first = points.find((p) => Number.isFinite(p.ts))?.ts ?? Date.now();
  points.forEach((p, i) => {
    if (!Number.isFinite(p.ts)) p.ts = first + i * 1000;
  });
  points.sort((a, b) => a.ts - b.ts);

  const raw = /<metadata>[\s\S]*?<name>([^<]+)<\/name>/i.exec(xml)?.[1]
    ?? /<trk>[\s\S]*?<name>([^<]+)<\/name>/i.exec(xml)?.[1]
    ?? null;
  const name = raw
    ? raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim() || null
    : null;

  return { name, points };
}

/** File name for an exported run: sortable, and safe on every file system. */
export function gpxFileName(run: GpxRun): string {
  const date = new Date(run.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const slug = (run.name ?? "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `tread-${date}-${slug || "run"}.gpx`;
}
