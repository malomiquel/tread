import { test } from "node:test";
import assert from "node:assert/strict";
import { setLanguage } from "./i18n.ts";
import {
  boxOf, DETAIL_ZOOM_BUDGET, estimateBytes, formatBytes, ignCovers, ignCoversBox, MAX_TILES_PER_AREA,
  OFFLINE_DETAIL_ZOOM, OFFLINE_MAX_ZOOM, OFFLINE_MIN_ZOOM, planDownload, rangesCover, tileBytes, tileCount,
  tileRange, tileRanges, tilesOf, tilesOnlyIn, tileX, tileY, withMargin,
} from "./tiles.ts";

test("tile numbers match the web mercator grid", () => {
  // Chamonix, checked against the tile IGN serves for it.
  assert.equal(tileX(6.87, 15), 17009);
  assert.equal(tileY(45.92, 15), 11668);
  // The world is one tile at zoom 0, and the corners stay on the grid.
  assert.equal(tileX(-180, 0), 0);
  assert.equal(tileX(180, 3), 7);
  assert.equal(tileY(89.9, 3), 0);
  assert.equal(tileY(-89.9, 3), 7);
  // North is the smaller row.
  assert.ok(tileY(48.9, 12) < tileY(45.9, 12));
});

test("a box's range runs north to south and west to east", () => {
  const box = { minLat: 45.9, maxLat: 45.95, minLng: 6.85, maxLng: 6.9 };
  const range = tileRange(box, 14);
  assert.ok(range.minX <= range.maxX);
  assert.ok(range.minY <= range.maxY);
  assert.equal(range.minY, tileY(45.95, 14));
  assert.equal(range.maxY, tileY(45.9, 14));
});

test("tilesOf lists exactly tileCount tiles, coarsest first", () => {
  const box = { minLat: 45.9, maxLat: 45.95, minLng: 6.85, maxLng: 6.9 };
  const ranges = tileRanges(box, 11, 14);
  const tiles = [...tilesOf(ranges)];
  assert.equal(tiles.length, tileCount(ranges));
  assert.equal(tiles[0].z, 11);
  assert.equal(tiles[tiles.length - 1].z, 14);
  assert.equal(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size, tiles.length);
});

test("the margin widens the box by about as many metres on every side", () => {
  const box = boxOf([{ lat: 45, lng: 6 }, { lat: 45.01, lng: 6.01 }])!;
  const wide = withMargin(box, 1000);
  assert.ok(Math.abs((box.minLat - wide.minLat) * 111_320 - 1000) < 1);
  // A degree of longitude is shorter at 45°, so more of them make a kilometre.
  assert.ok(box.minLng - wide.minLng > box.minLat - wide.minLat);
  assert.equal(boxOf([]), null);
});

test("a short trail gets zoom 16, a long one stops at 15, a huge one is refused", () => {
  // About 4 km across, in the Alps.
  const short = planDownload([{ lat: 45.9, lng: 6.85 }, { lat: 45.93, lng: 6.9 }]);
  assert.equal(short.kind, "ok");
  if (short.kind === "ok") {
    assert.equal(short.ranges[0].z, OFFLINE_MIN_ZOOM);
    assert.equal(short.ranges[short.ranges.length - 1].z, OFFLINE_DETAIL_ZOOM);
    assert.ok(short.tiles <= DETAIL_ZOOM_BUDGET);
    assert.equal(short.bytes, estimateBytes(short.ranges));
  }

  // About 40 km across: too many for zoom 16, fine without.
  const long = planDownload([{ lat: 45.7, lng: 6.6 }, { lat: 46.0, lng: 7.0 }]);
  assert.equal(long.kind, "ok");
  if (long.kind === "ok") {
    assert.equal(long.ranges[long.ranges.length - 1].z, OFFLINE_MAX_ZOOM);
    assert.ok(long.tiles > 0 && long.tiles <= MAX_TILES_PER_AREA);
  }

  // Paris to Lyon.
  const huge = planDownload([{ lat: 48.85, lng: 2.35 }, { lat: 45.76, lng: 4.84 }]);
  assert.equal(huge.kind, "tooLarge");
  if (huge.kind === "tooLarge") assert.ok(huge.tiles > MAX_TILES_PER_AREA);

  assert.equal(planDownload([]).kind, "empty");
});

test("the estimate weighs every tile by its zoom", () => {
  const box = { minLat: 45.9, maxLat: 45.95, minLng: 6.85, maxLng: 6.9 };
  const ranges = tileRanges(box, 15, 15);
  assert.equal(estimateBytes(ranges), tileCount(ranges) * tileBytes(15));
  assert.ok(tileBytes(11) > tileBytes(16));
});

test("deleting an area keeps the tiles another area still needs", () => {
  const a = tileRanges({ minLat: 45.9, maxLat: 45.95, minLng: 6.85, maxLng: 6.9 }, 14, 15);
  const b = tileRanges({ minLat: 45.93, maxLat: 45.98, minLng: 6.88, maxLng: 6.95 }, 14, 15);
  const alone = [...tilesOnlyIn(a, [b])];
  assert.ok(alone.length > 0 && alone.length < tileCount(a));
  for (const tile of alone) {
    assert.ok(!b.some((range) => range.z === tile.z
      && tile.x >= range.minX && tile.x <= range.maxX && tile.y >= range.minY && tile.y <= range.maxY));
  }
  assert.equal([...tilesOnlyIn(a, [])].length, tileCount(a));
  assert.equal([...tilesOnlyIn(a, [a])].length, 0);
});

test("an area covers a smaller one inside it, not one that sticks out", () => {
  const big = tileRanges({ minLat: 45.8, maxLat: 46.0, minLng: 6.7, maxLng: 7.0 }, 11, 15);
  const small = tileRanges({ minLat: 45.9, maxLat: 45.95, minLng: 6.85, maxLng: 6.9 }, 11, 15);
  assert.ok(rangesCover(big, small));
  assert.ok(!rangesCover(small, big));
  // A zoom the area never had is not covered.
  assert.ok(!rangesCover(small, tileRanges({ minLat: 45.9, maxLat: 45.95, minLng: 6.85, maxLng: 6.9 }, 16, 16)));
});

test("the IGN map covers France, Corsica and overseas, not its neighbours", () => {
  for (const [lat, lng] of [
    [48.8566, 2.3522], [45.92, 6.87], [43.3, 5.37], [48.39, -4.49], [50.63, 3.06], [48.58, 7.75],
    [42.7, 2.9], [43.48, -1.56], [42.15, 9.05], [-21.1, 55.5], [16.2, -61.6], [4.9, -52.3],
  ]) assert.ok(ignCovers(lat, lng), `${lat}, ${lng}`);

  for (const [lat, lng] of [
    [40.42, -3.7], [41.39, 2.17], [45.07, 7.69], [50.85, 4.35], [52.52, 13.4], [51.5, -0.12],
    [47.37, 8.54], [40.71, -74.0],
  ]) assert.ok(!ignCovers(lat, lng), `${lat}, ${lng}`);
});

test("a box straddling the border counts as covered", () => {
  assert.ok(ignCoversBox({ minLat: 45.8, maxLat: 46.1, minLng: 6.9, maxLng: 7.6 }));
  assert.ok(!ignCoversBox({ minLat: 40.3, maxLat: 40.5, minLng: -3.8, maxLng: -3.6 }));
});

test("sizes read in the interface's language", () => {
  setLanguage("fr");
  assert.equal(formatBytes(38_400_000), "38 Mo");
  assert.equal(formatBytes(4_230_000), "4,2 Mo");
  assert.equal(formatBytes(640_000), "640 Ko");
  setLanguage("en");
  assert.equal(formatBytes(4_230_000), "4.2 MB");
  setLanguage("fr");
});
