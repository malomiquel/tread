import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { archiveFileName, buildArchive } from "./archive.ts";
import type { TrackPoint } from "./geo.ts";

const at = (ts: number, lat: number, lng: number): TrackPoint => ({
  ts, lat, lng, alt: 100, accuracy: 5, speed: 3, segment: 0,
});

const sample = (name: string | null, startedAt: number) => ({
  run: { name, startedAt },
  points: [at(startedAt, 48.85, 2.35), at(startedAt + 1000, 48.86, 2.35)],
});

test("archive: one entry per run, and it reads back", async () => {
  const base64 = await buildArchive([
    sample("Course matinale", Date.UTC(2026, 8, 21, 7, 30)),
    sample("Course du soir", Date.UTC(2026, 8, 22, 19, 0)),
  ]);
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const names = Object.keys(zip.files).sort();
  assert.equal(names.length, 2);
  assert.deepEqual(names, [
    "tread-2026-09-21-07-30-course-matinale.gpx",
    "tread-2026-09-22-19-00-course-du-soir.gpx",
  ]);
});

test("archive: each entry is the run's own valid GPX", async () => {
  const base64 = await buildArchive([sample("Course matinale", Date.UTC(2026, 8, 21, 7, 30))]);
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const xml = await zip.files["tread-2026-09-21-07-30-course-matinale.gpx"].async("string");
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes("<name>Course matinale</name>"));
  assert.equal(xml.match(/<trkpt /g)?.length, 2);
});

test("archive: two identical names on the same minute do not overwrite each other", async () => {
  const when = Date.UTC(2026, 8, 21, 7, 30);
  const base64 = await buildArchive([sample("Course", when), sample("Course", when)]);
  const zip = await JSZip.loadAsync(base64, { base64: true });
  assert.equal(Object.keys(zip.files).length, 2, "a zip silently keeps only the last of a duplicate path");
});

test("archive: an empty history still produces a readable archive", async () => {
  const zip = await JSZip.loadAsync(await buildArchive([]), { base64: true });
  assert.equal(Object.keys(zip.files).length, 0);
});

test("archive: compression is worth having on repetitive XML", async () => {
  const points = Array.from({ length: 400 }, (_, i) => at(i * 1000, 48.85 + i * 1e-5, 2.35));
  const base64 = await buildArchive([{ run: { name: "Longue", startedAt: 0 }, points }]);
  const raw = Buffer.from(base64, "base64").length;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const plain = (await zip.files[Object.keys(zip.files)[0]].async("string")).length;
  assert.ok(raw < plain / 3, `archive ${raw} o pour ${plain} o de GPX, compression insuffisante`);
});

test("archive file name is dated so backups sort", () => {
  assert.equal(archiveFileName(Date.UTC(2026, 8, 21, 12, 0)), "tread-courses-2026-09-21.zip");
});
