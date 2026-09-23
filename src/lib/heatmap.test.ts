import { test } from "node:test";
import assert from "node:assert/strict";
import { denseRegion, tracksOf } from "./heatmap.ts";

test("the region holds where most runs are, not the one far away", () => {
  const home = Array.from({ length: 40 }, (_, i) => [
    { lat: 48.85 + i * 0.0005, lng: 2.35 }, { lat: 48.85 + i * 0.0005, lng: 2.36 },
  ]);
  const holiday = [[{ lat: 43.3, lng: 5.4 }, { lat: 43.31, lng: 5.41 }]];
  const region = denseRegion([...home, ...holiday]);
  assert.ok(region);
  assert.ok(Math.abs(region.latitude - 48.86) < 0.02);
  assert.ok(region.latitudeDelta < 0.1);
  assert.equal(denseRegion([]), null);
});

test("rows are gathered into one track per run, single points dropped", () => {
  const tracks = tracksOf([
    { run_id: 1, lat: 1, lng: 1 }, { run_id: 1, lat: 2, lng: 2 },
    { run_id: 2, lat: 3, lng: 3 },
  ]);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].length, 2);
});
