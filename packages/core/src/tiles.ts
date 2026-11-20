import { decimal, defineStrings } from "./i18n.ts";

/**
 * The arithmetic of a map kept for offline use: which tiles cover a place,
 * how many there are, roughly how heavy they are, and whether the IGN map has
 * anything to draw there at all.
 *
 * Tiles follow the usual web mercator grid ("PM" in IGN's words, the one every
 * slippy map uses): at zoom z the world is 2^z tiles across, x counted from
 * the antimeridian eastwards and y from the north downwards. That is also how
 * react-native-maps names the files it caches, `{z}/{x}/{y}`, which is why a
 * tile fetched here and a tile fetched by the map land on the same path.
 */

export interface Box {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface TileRange {
  z: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Tile {
  z: number;
  x: number;
  y: number;
}

/** Web mercator stops short of the poles; past this the maths diverges. */
const MAX_LAT = 85.05112878;

const clampLat = (lat: number): number => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

/** The tile column a longitude falls in at a zoom. */
export function tileX(lng: number, z: number): number {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  return Math.max(0, Math.min(n - 1, x));
}

/** The tile row a latitude falls in at a zoom, counted from the north. */
export function tileY(lat: number, z: number): number {
  const n = 2 ** z;
  const rad = (clampLat(lat) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n);
  return Math.max(0, Math.min(n - 1, y));
}

/** The smallest box holding every point, or null for no points at all. */
export function boxOf(points: readonly { lat: number; lng: number }[]): Box | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

const METRES_PER_DEGREE = 111_320;

/**
 * The box grown by a margin on every side, in metres.
 *
 * A runner off the line by a few hundred metres — a wrong turn, a detour
 * round a closed path — still has a map under them.
 */
export function withMargin(box: Box, metres: number): Box {
  const dLat = metres / METRES_PER_DEGREE;
  const midLat = (box.minLat + box.maxLat) / 2;
  const dLng = metres / (METRES_PER_DEGREE * Math.max(Math.cos((midLat * Math.PI) / 180), 0.01));
  return {
    minLat: clampLat(box.minLat - dLat),
    maxLat: clampLat(box.maxLat + dLat),
    minLng: Math.max(-180, box.minLng - dLng),
    maxLng: Math.min(180, box.maxLng + dLng),
  };
}

/** The tiles covering a box at one zoom, as a rectangle of columns and rows. */
export function tileRange(box: Box, z: number): TileRange {
  return {
    z,
    minX: tileX(box.minLng, z),
    maxX: tileX(box.maxLng, z),
    // North is the smaller row.
    minY: tileY(box.maxLat, z),
    maxY: tileY(box.minLat, z),
  };
}

export const rangeSize = (range: TileRange): number =>
  (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);

/** One range per zoom, from `minZoom` to `maxZoom` inclusive. */
export function tileRanges(box: Box, minZoom: number, maxZoom: number): TileRange[] {
  const ranges: TileRange[] = [];
  for (let z = minZoom; z <= maxZoom; z += 1) ranges.push(tileRange(box, z));
  return ranges;
}

export const tileCount = (ranges: readonly TileRange[]): number =>
  ranges.reduce((sum, range) => sum + rangeSize(range), 0);

/** Every tile of the ranges, coarsest zoom first, row by row. */
export function* tilesOf(ranges: readonly TileRange[]): Generator<Tile> {
  for (const range of ranges) {
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) yield { z: range.z, x, y };
    }
  }
}

export const inRange = (tile: Tile, range: TileRange): boolean =>
  tile.z === range.z
  && tile.x >= range.minX && tile.x <= range.maxX
  && tile.y >= range.minY && tile.y <= range.maxY;

/**
 * The tiles of an area that no other area also holds.
 *
 * What deleting one downloaded area may remove: two routes that share a
 * valley share its tiles, and throwing one route's map away must not leave
 * the other with a hole.
 */
export function* tilesOnlyIn(
  ranges: readonly TileRange[],
  others: readonly (readonly TileRange[])[],
): Generator<Tile> {
  for (const tile of tilesOf(ranges)) {
    if (!others.some((area) => area.some((range) => inRange(tile, range)))) yield tile;
  }
}

/** Whether every tile of `inner` is also in `outer`, zoom by zoom. */
export function rangesCover(outer: readonly TileRange[], inner: readonly TileRange[]): boolean {
  return inner.every((range) =>
    outer.some((held) =>
      held.z === range.z
      && held.minX <= range.minX && held.maxX >= range.maxX
      && held.minY <= range.minY && held.maxY >= range.maxY));
}

/**
 * What a Plan IGN tile weighs on average, by zoom, in bytes.
 *
 * Measured on 256-pixel PNGs over the Alps, the Vercors, a forest and a city
 * (November 2026): the coarse zooms are the heaviest, full of names and
 * shading; mountains weigh more than plains. Rounded up, so the estimate
 * errs towards more room than needed rather than less.
 */
const TILE_BYTES: Record<number, number> = {
  11: 85_000, 12: 85_000, 13: 80_000, 14: 70_000, 15: 60_000, 16: 50_000,
};
const DEFAULT_TILE_BYTES = 60_000;

export const tileBytes = (z: number): number => TILE_BYTES[z] ?? DEFAULT_TILE_BYTES;

/** Roughly how many bytes the ranges will take on disk. */
export const estimateBytes = (ranges: readonly TileRange[]): number =>
  ranges.reduce((sum, range) => sum + rangeSize(range) * tileBytes(range.z), 0);

/** The zooms an offline map is kept at, and the limits that keep it polite. */
export const OFFLINE_MIN_ZOOM = 11;
/** Paths and their names appear from here on Plan IGN. */
export const OFFLINE_MAX_ZOOM = 15;
/** The extra zoom, kept only for small areas. */
export const OFFLINE_DETAIL_ZOOM = 16;
/** Up to this many tiles in all, the extra zoom is worth its weight. */
export const DETAIL_ZOOM_BUDGET = 1500;
/** No single area fetches more than this: a ultra's worth of valleys at most. */
export const MAX_TILES_PER_AREA = 3000;
/** Room around the route, in metres. */
export const OFFLINE_MARGIN_M = 1000;

export type DownloadPlan =
  | { kind: "ok"; box: Box; ranges: TileRange[]; tiles: number; bytes: number }
  | { kind: "tooLarge"; tiles: number }
  | { kind: "empty" };

/**
 * What downloading the map around a line would mean.
 *
 * Zooms 11 to 16 when that stays under the detail budget, 11 to 15
 * otherwise; and nothing at all past the hard cap, rather than a map
 * quietly missing its last zoom over half the route.
 */
export function planDownload(
  points: readonly { lat: number; lng: number }[],
  marginM: number = OFFLINE_MARGIN_M,
): DownloadPlan {
  const line = boxOf(points);
  if (!line) return { kind: "empty" };
  const box = withMargin(line, marginM);

  const detailed = tileRanges(box, OFFLINE_MIN_ZOOM, OFFLINE_DETAIL_ZOOM);
  const detailedCount = tileCount(detailed);
  if (detailedCount <= DETAIL_ZOOM_BUDGET) {
    return { kind: "ok", box, ranges: detailed, tiles: detailedCount, bytes: estimateBytes(detailed) };
  }

  const ranges = tileRanges(box, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM);
  const tiles = tileCount(ranges);
  if (tiles > MAX_TILES_PER_AREA) return { kind: "tooLarge", tiles };
  return { kind: "ok", box, ranges, tiles, bytes: estimateBytes(ranges) };
}

/**
 * Where Plan IGN has something to draw: metropolitan France, Corsica and the
 * overseas departments.
 *
 * Coarse on purpose and drawn a little wide: the border regions of the
 * neighbours are mapped by IGN too, and the cost of a false "yes" is a few
 * empty tiles, where a false "no" would hide the map from somebody standing
 * in France.
 */
const MAINLAND: readonly (readonly [number, number])[] = [
  // [lat, lng], clockwise from the Channel coast at Calais.
  [51.15, 1.45], [51.25, 2.45], [50.85, 3.25], [50.4, 4.15], [50.25, 4.95], [49.6, 5.95],
  [49.25, 6.85], [49.1, 8.3], [48.55, 7.95], [47.65, 7.75], [47.35, 6.95], [46.45, 6.0],
  [46.5, 6.9], [45.95, 7.15], [45.1, 7.25], [44.2, 7.8], [43.75, 7.65], [42.9, 6.45],
  [43.1, 4.6], [43.15, 3.35], [42.35, 3.35], [42.35, 1.9], [42.6, 0.6], [42.75, -0.4],
  [43.25, -1.9], [43.7, -1.7], [46.15, -1.95], [47.05, -2.6], [47.5, -3.6], [47.7, -4.9],
  [48.45, -5.3], [48.95, -3.0], [48.75, -1.7], [49.8, -2.05], [49.45, 0.0], [50.15, 1.4],
];

/** Corsica, then the overseas departments, as plain boxes. */
const ISLANDS: readonly Box[] = [
  { minLat: 41.3, maxLat: 43.1, minLng: 8.45, maxLng: 9.65 },
  { minLat: 15.8, maxLat: 16.55, minLng: -61.85, maxLng: -60.95 }, // Guadeloupe
  { minLat: 14.35, maxLat: 14.9, minLng: -61.3, maxLng: -60.75 }, // Martinique
  { minLat: 2.1, maxLat: 5.85, minLng: -54.65, maxLng: -51.55 }, // Guyane
  { minLat: -21.45, maxLat: -20.85, minLng: 55.15, maxLng: 55.9 }, // La Réunion
  { minLat: -13.05, maxLat: -12.6, minLng: 44.95, maxLng: 45.35 }, // Mayotte
];

function insidePolygon(lat: number, lng: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const crosses = (latI > lat) !== (latJ > lat)
      && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Whether the IGN map covers this point. */
export function ignCovers(lat: number, lng: number): boolean {
  if (insidePolygon(lat, lng, MAINLAND)) return true;
  return ISLANDS.some((box) => lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng);
}

/** Whether any part of the box is covered: its centre or one of its corners. */
export function ignCoversBox(box: Box): boolean {
  const midLat = (box.minLat + box.maxLat) / 2;
  const midLng = (box.minLng + box.maxLng) / 2;
  return [
    [midLat, midLng], [box.minLat, box.minLng], [box.minLat, box.maxLng],
    [box.maxLat, box.minLng], [box.maxLat, box.maxLng],
  ].some(([lat, lng]) => ignCovers(lat, lng));
}

const sizeWords = defineStrings({
  fr: { mb: "Mo", kb: "Ko" },
  en: { mb: "MB", kb: "KB" },
});

/**
 * A size in bytes as the interface writes it: "38 Mo", "4,2 Mo", "640 Ko".
 * Decimal megabytes, as the phone's own storage page counts them.
 */
export function formatBytes(bytes: number): string {
  const words = sizeWords();
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} ${words.kb}`;
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? decimal(mb.toFixed(1)) : Math.round(mb)} ${words.mb}`;
}
