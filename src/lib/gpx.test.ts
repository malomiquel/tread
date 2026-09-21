import { test } from "node:test";
import assert from "node:assert/strict";
import { gpxFileName, toGpx } from "./gpx.ts";
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
