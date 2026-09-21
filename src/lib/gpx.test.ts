import { test } from "node:test";
import assert from "node:assert/strict";
import { gpxFileName, parseGpx, toGpx } from "./gpx.ts";
import type { TrackPoint } from "./geo.ts";

const at = (ts: number, lat: number, lng: number, extra: Partial<TrackPoint> = {}): TrackPoint => ({
  ts, lat, lng, alt: null, accuracy: 5, speed: null, segment: 0, ...extra,
});

const run = { name: "Morning run", startedAt: Date.UTC(2026, 8, 21, 7, 30) };

test("gpx: well formed envelope with the expected namespace", () => {
  const xml = toGpx(run, [at(0, 48.85, 2.35)]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('xmlns="http://www.topografix.com/GPX/1/1"'));
  assert.ok(xml.includes('creator="Tread"'));
  assert.ok(xml.trimEnd().endsWith("</gpx>"));
});

test("gpx: one segment becomes one trkseg, a pause becomes two", () => {
  const single = toGpx(run, [at(0, 48.85, 2.35), at(1000, 48.86, 2.35)]);
  assert.equal(single.match(/<trkseg>/g)?.length, 1);

  const paused = toGpx(run, [
    at(0, 48.85, 2.35), at(1000, 48.86, 2.35),
    at(600_000, 48.90, 2.35, { segment: 1 }), at(601_000, 48.91, 2.35, { segment: 1 }),
  ]);
  assert.equal(paused.match(/<trkseg>/g)?.length, 2, "a pause must not join the two halves");
});

test("gpx: altitude included only when known", () => {
  assert.ok(toGpx(run, [at(0, 48.85, 2.35, { alt: 102.4 })]).includes("<ele>102.4</ele>"));
  assert.ok(!toGpx(run, [at(0, 48.85, 2.35)]).includes("<ele>"));
});

test("gpx: coordinates and timestamps in the format readers expect", () => {
  const xml = toGpx(run, [at(Date.UTC(2026, 8, 21, 7, 30, 15), 48.8566123456, 2.3522)]);
  assert.ok(xml.includes('lat="48.8566123"'), "seven decimals, about a centimetre");
  assert.ok(xml.includes("<time>2026-09-21T07:30:15.000Z</time>"));
});

test("gpx: a hostile name cannot break the document", () => {
  const xml = toGpx({ name: 'Run <b>"5" & co</b>', startedAt: 0 }, [at(0, 48, 2)]);
  assert.ok(xml.includes("&lt;b&gt;&quot;5&quot; &amp; co"));
  assert.ok(!xml.includes("<b>"), "no raw markup must survive");
});

test("file name: sortable, lowercase, no awkward characters", () => {
  assert.equal(gpxFileName(run), "tread-2026-09-21-07-30-morning-run.gpx");
  assert.equal(gpxFileName({ name: null, startedAt: 0 }), "tread-1970-01-01-00-00-run.gpx");
  assert.equal(gpxFileName({ name: "Côte d'Azur !!", startedAt: 0 }), "tread-1970-01-01-00-00-c-te-d-azur.gpx");
});

test("parseGpx reads back what toGpx wrote", () => {
  const original: TrackPoint[] = [
    at(0, 48.85, 2.34, { alt: 35 }),
    at(1000, 48.851, 2.341, { alt: 36 }),
    at(9000, 48.853, 2.343, { alt: 38, segment: 1 }),
  ];
  const { name, points } = parseGpx(toGpx({ name: "Sortie du midi", startedAt: 0 }, original));

  assert.equal(name, "Sortie du midi");
  assert.equal(points.length, 3, "tous les points reviennent");
  assert.ok(Math.abs(points[0].lat - 48.85) < 1e-6, "latitude conservée");
  assert.equal(points[0].alt, 35, "altitude conservée");
  assert.equal(points[2].segment, 1, "la pause reste une coupure");
});

test("parseGpx accepts a file from somewhere else", () => {
  // Pas de métadonnées, une balise auto-fermante, pas d'altitude : ce qu'une
  // montre d'un autre fabricant produit couramment.
  const { name, points } = parseGpx(`<?xml version="1.0"?>
<gpx version="1.1" creator="Garmin Connect">
  <trk><name>Morning Run</name><trkseg>
    <trkpt lat="45.7640" lon="4.8357"><time>2024-03-02T07:11:00Z</time></trkpt>
    <trkpt lat="45.7641" lon="4.8359"/>
  </trkseg></trk>
</gpx>`);

  assert.equal(name, "Morning Run");
  assert.equal(points.length, 2);
  assert.equal(points[0].alt, null, "altitude absente admise");
  assert.ok(points[1].ts > points[0].ts, "un point sans heure en reçoit une");
});

test("parseGpx returns nothing rather than throwing on rubbish", () => {
  assert.deepEqual(parseGpx("bonjour").points, []);
  assert.deepEqual(parseGpx("<gpx></gpx>").points, []);
});
