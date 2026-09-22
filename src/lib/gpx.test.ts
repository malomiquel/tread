import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gpxFileName, parseGpx, parseGpxLine, routeGpxFileName, routeToGpx, toGpx,
} from "./gpx.ts";
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
  assert.equal(points.length, 3, "every point comes back");
  assert.ok(Math.abs(points[0].lat - 48.85) < 1e-6, "latitude kept");
  assert.equal(points[0].alt, 35, "elevation kept");
  assert.equal(points[2].segment, 1, "the pause stays a break");
});

test("parseGpx accepts a file from somewhere else", () => {
  // No metadata, a self-closing tag, no elevation: what a watch from another
  // maker commonly produces.
  const { name, points } = parseGpx(`<?xml version="1.0"?>
<gpx version="1.1" creator="Garmin Connect">
  <trk><name>Morning Run</name><trkseg>
    <trkpt lat="45.7640" lon="4.8357"><time>2024-03-02T07:11:00Z</time></trkpt>
    <trkpt lat="45.7641" lon="4.8359"/>
  </trkseg></trk>
</gpx>`);

  assert.equal(name, "Morning Run");
  assert.equal(points.length, 2);
  assert.equal(points[0].alt, null, "missing elevation accepted");
  assert.ok(points[1].ts > points[0].ts, "a point with no time is given one");
});

test("parseGpx returns nothing rather than throwing on rubbish", () => {
  assert.deepEqual(parseGpx("bonjour").points, []);
  assert.deepEqual(parseGpx("<gpx></gpx>").points, []);
});

test("a route file is read whether it holds a track or a route", () => {
  const track = `<?xml version="1.0"?><gpx><trk><name>Boucle du canal</name><trkseg>
    <trkpt lat="48.4470" lon="1.4890"/><trkpt lat="48.4480" lon="1.4900"/>
  </trkseg></trk></gpx>`;
  assert.deepEqual(parseGpxLine(track), {
    name: "Boucle du canal",
    line: [{ lat: 48.447, lng: 1.489 }, { lat: 48.448, lng: 1.49 }],
  });

  // What a route planner writes instead.
  const planned = `<?xml version="1.0"?><gpx><rte><name>Sortie du dimanche</name>
    <rtept lat="48.4470" lon="1.4890"><ele>128</ele></rtept>
    <rtept lat="48.4480" lon="1.4900"></rtept>
  </rte></gpx>`;
  assert.deepEqual(parseGpxLine(planned), {
    name: "Sortie du dimanche",
    line: [{ lat: 48.447, lng: 1.489 }, { lat: 48.448, lng: 1.49 }],
  });
});

test("the points come back in the order the file puts them", () => {
  // No times to sort by, and none needed: a route is run in the order it was
  // written, which is the one thing the document does say.
  const xml = `<gpx><rte>
    <rtept lat="48.4490" lon="1.4890"/><rtept lat="48.4470" lon="1.4890"/>
    <rtept lat="48.4480" lon="1.4890"/></rte></gpx>`;
  assert.deepEqual(parseGpxLine(xml).line.map((p) => p.lat), [48.449, 48.447, 48.448]);
});

test("a point repeated in place is one point", () => {
  const xml = `<gpx><rte>
    <rtept lat="48.4470" lon="1.4890"/><rtept lat="48.4470" lon="1.4890"/>
    <rtept lat="48.4480" lon="1.4900"/></rte></gpx>`;
  assert.equal(parseGpxLine(xml).line.length, 2);
});

test("a file with no name and no points is read without complaint", () => {
  assert.deepEqual(parseGpxLine("<gpx></gpx>"), { name: null, line: [] });
  assert.deepEqual(parseGpxLine("pas du xml du tout"), { name: null, line: [] });
  // Coordinates that are not coordinates are skipped rather than kept as NaN.
  assert.deepEqual(parseGpxLine('<gpx><rtept lat="nord" lon="1.0"/></gpx>').line, []);
});

test("a route written out and read back is the same route", () => {
  const line = [
    { lat: 48.447044, lng: 1.489076 },
    { lat: 48.448, lng: 1.4901 },
    { lat: 48.4495, lng: 1.4920 },
  ];
  const back = parseGpxLine(routeToGpx("Boucle du canal", line));

  assert.equal(back.name, "Boucle du canal");
  assert.equal(back.line.length, 3);
  back.line.forEach((point, index) => {
    assert.ok(Math.abs(point.lat - line[index].lat) < 1e-6, `lat ${index}`);
    assert.ok(Math.abs(point.lng - line[index].lng) < 1e-6, `lng ${index}`);
  });
});

test("a written route carries no times, which is what makes it a route", () => {
  const xml = routeToGpx("Sortie", [{ lat: 48.45, lng: 1.49 }, { lat: 48.46, lng: 1.49 }]);
  assert.equal(/<time>/i.test(xml), false);
  assert.match(xml, /<trkseg>/);
});

test("a name with anything in it still writes a valid file", () => {
  const xml = routeToGpx('Boucle "Saint-Jean" & <co>', [{ lat: 48.45, lng: 1.49 }, { lat: 48.46, lng: 1.49 }]);
  assert.equal(xml.includes("<co>"), false);
  assert.equal(parseGpxLine(xml).name, 'Boucle "Saint-Jean" & <co>');
});

test("a route's file is named after it, and survives any file system", () => {
  assert.equal(routeGpxFileName("Boucle du canal"), "boucle-du-canal.gpx");
  assert.equal(routeGpxFileName("Sortie d'été · 10 km"), "sortie-d-ete-10-km.gpx");
  assert.equal(routeGpxFileName("···"), "parcours.gpx");
});
