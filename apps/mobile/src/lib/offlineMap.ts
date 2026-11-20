import { Directory, File, Paths } from "expo-file-system";
import { useNetworkState } from "expo-network";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { defineStrings } from "@tread/core/i18n";
import {
  tilesOf, tilesOnlyIn, type Box, type Tile, type TileRange,
} from "@tread/core/tiles";
import { currentBuild } from "./build";

/**
 * The IGN map, and keeping it for the mountains.
 *
 * Apple Maps cannot be stored for offline use by an app, so the map that can
 * be is a layer of IGN tiles drawn over it. Those tiles live on disk in the
 * layout react-native-maps itself uses for its tile cache — `{z}/{x}/{y}`,
 * no extension, under one directory — so a tile fetched here ahead of time
 * and a tile the map fetched while somebody looked at it are the same file,
 * and the map finds both without being told which is which.
 */

/**
 * Plan IGN v2 from the Géoplateforme, open data under the Etalab Licence
 * Ouverte 2.0, no key. The full Plan IGN: paths at the larger scales and
 * shaded relief in the mountains. SCAN 25, the paper map, still needs a key.
 */
export const IGN_TILE_URL =
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0"
  + "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM"
  + "&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&FORMAT=image/png";

/** The deepest zoom Plan IGN serves. */
export const IGN_MAX_ZOOM = 19;

export type MapBackground = "apple" | "ign";

export const MAP_BACKGROUNDS: readonly MapBackground[] = ["apple", "ign"];

export function readMapBackground(raw: string | undefined): MapBackground {
  return raw === "ign" ? "ign" : "apple";
}

/** How each background is named, wherever it is shown. */
export const mapBackgroundWords = defineStrings({
  fr: {
    names: { apple: Platform.OS === "ios" ? "Plans d'Apple" : "Google Maps", ign: "Carte IGN" } as Record<MapBackground, string>,
    details: {
      apple: "Rues et commerces, partout dans le monde",
      ign: "Sentiers et relief, en France, et gardée hors ligne",
    } as Record<MapBackground, string>,
  },
  en: {
    names: { apple: Platform.OS === "ios" ? "Apple Maps" : "Google Maps", ign: "IGN map" },
    details: {
      apple: "Streets and shops, anywhere in the world",
      ign: "Trails and relief, in France, and kept offline",
    },
  },
});

const ROOT = new Directory(Paths.document, "maps");
/** Where every IGN tile lives, fetched ahead or on the way. */
const TILES = new Directory(ROOT, "ign");
const AREAS = new File(ROOT, "areas.json");

/**
 * The tile directory as a plain path, which is what the map wants.
 *
 * Plain rather than `file://`: on Android, the URL form is only stripped
 * when the path arrives before the map's tile provider exists, and passed
 * through as it is otherwise, which would cache into a directory named
 * after a URL.
 */
export function tileCachePath(): string {
  return decodeURI(TILES.uri.replace(/^file:\/\//, "")).replace(/\/$/, "");
}

const tileFile = (tile: Tile) => new File(TILES, String(tile.z), String(tile.x), String(tile.y));

/** Whether the phone can reach the internet now, as far as it knows. */
export function useOnline(): boolean {
  const state = useNetworkState();
  return !(state.isConnected === false || state.isInternetReachable === false);
}

// ---------------------------------------------------------------------------
// Downloaded areas

/** The map kept around one route. */
export interface OfflineArea {
  routeId: number;
  /** The route's box with its margin, as it was when the map was fetched. */
  box: Box;
  ranges: TileRange[];
  /** Tiles on disk for it once the download ended. */
  tiles: number;
  /** Bytes fetched or found on disk. */
  bytes: number;
  savedAt: number;
  /** Every tile arrived. False after a cancel or failed tiles. */
  complete: boolean;
}

let areas: OfflineArea[] = [];
let areasLoaded = false;
const areaListeners = new Set<() => void>();

function publishAreas(next: OfflineArea[]): void {
  areas = next;
  for (const listener of areaListeners) listener();
  try {
    ROOT.create({ intermediates: true, idempotent: true });
    AREAS.create({ overwrite: true });
    AREAS.writeSync(JSON.stringify(next));
  } catch {
    /* the list still holds until the app closes */
  }
}

function loadAreas(): void {
  if (areasLoaded) return;
  areasLoaded = true;
  try {
    if (!AREAS.exists) return;
    const parsed: unknown = JSON.parse(AREAS.textSync());
    if (Array.isArray(parsed)) {
      areas = parsed.filter((area): area is OfflineArea =>
        typeof area === "object" && area !== null
        && typeof (area as OfflineArea).routeId === "number"
        && Array.isArray((area as OfflineArea).ranges));
    }
  } catch {
    areas = [];
  }
}

function subscribeAreas(listener: () => void): () => void {
  areaListeners.add(listener);
  return () => {
    areaListeners.delete(listener);
  };
}

const getAreas = (): OfflineArea[] => {
  loadAreas();
  return areas;
};

export function useOfflineAreas(): OfflineArea[] {
  return useSyncExternalStore(subscribeAreas, getAreas, getAreas);
}

export const areaOf = (routeId: number): OfflineArea | null =>
  getAreas().find((area) => area.routeId === routeId) ?? null;

/** Yields now and then, so a long run of file operations never freezes the screen. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Throw away the map kept for a route.
 *
 * Only its own tiles: those another downloaded route also needs stay where
 * they are.
 */
export async function deleteArea(routeId: number): Promise<void> {
  if (download.routeId === routeId && download.status === "running") cancelDownload({ forget: true });
  const area = areaOf(routeId);
  if (!area) return;
  const others = getAreas().filter((other) => other.routeId !== routeId);
  publishAreas(others);

  let since = 0;
  for (const tile of tilesOnlyIn(area.ranges, others.map((other) => other.ranges))) {
    try {
      const file = tileFile(tile);
      if (file.exists) file.delete();
    } catch {
      /* a tile left behind is a few kilobytes, not worth failing over */
    }
    since += 1;
    if (since % 200 === 0) await breathe();
  }
}

/** Bytes the IGN map takes on this phone, kept areas and tiles seen on the way. */
export function tileCacheBytes(): number {
  try {
    return TILES.exists ? TILES.size ?? 0 : 0;
  } catch {
    return 0;
  }
}

/** Every IGN tile on the phone, and the list of kept areas with them. */
export function clearTileCache(): void {
  cancelDownload({ forget: true });
  try {
    if (TILES.exists) TILES.delete();
  } catch {
    /* nothing more to do */
  }
  publishAreas([]);
}

// ---------------------------------------------------------------------------
// The download

export type DownloadStatus = "idle" | "running" | "done" | "incomplete" | "cancelled";

export interface DownloadState {
  status: DownloadStatus;
  routeId: number | null;
  done: number;
  total: number;
  failed: number;
}

const IDLE: DownloadState = { status: "idle", routeId: null, done: 0, total: 0, failed: 0 };

let download: DownloadState = IDLE;
const downloadListeners = new Set<() => void>();
let abort: AbortController | null = null;
/** The download was stopped by a deletion: what it fetched is not to be listed. */
let forgetOnEnd = false;

function publishDownload(next: DownloadState): void {
  download = next;
  for (const listener of downloadListeners) listener();
}

function subscribeDownload(listener: () => void): () => void {
  downloadListeners.add(listener);
  return () => {
    downloadListeners.delete(listener);
  };
}

const getDownload = (): DownloadState => download;

/** The download under way, or the last one to end. One at a time, app-wide. */
export function useDownload(): DownloadState {
  return useSyncExternalStore(subscribeDownload, getDownload, getDownload);
}

/**
 * Four tiles in flight at most. The Géoplateforme publishes no figure for its
 * tiles, and limits its other services to between 5 and 30 requests a second
 * per address; four at a time with a pause between keeps well under all of
 * them.
 */
const CONCURRENCY = 4;
const PAUSE_MS = 60;

/** Who is asking, so IGN can tell this app's traffic from anybody else's. */
const userAgent = () => `Tread/${currentBuild().version} (offline map; ${Platform.OS})`;

type Fetched = { kind: "saved"; bytes: number } | { kind: "absent" } | { kind: "failed" };

async function fetchTile(tile: Tile, signal: AbortSignal): Promise<Fetched> {
  const url = IGN_TILE_URL
    .replace("{z}", String(tile.z))
    .replace("{x}", String(tile.x))
    .replace("{y}", String(tile.y));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": userAgent() }, signal });
      // Outside IGN's coverage the answer is a 404 with an XML body. Kept as a
      // tile, that body is what the map would then try to draw.
      if (response.status === 404) return { kind: "absent" };
      const type = response.headers.get("content-type") ?? "";
      if (response.ok && type.startsWith("image/")) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const file = tileFile(tile);
        file.create({ intermediates: true, overwrite: true });
        file.writeSync(bytes);
        return { kind: "saved", bytes: bytes.length };
      }
    } catch {
      if (signal.aborted) return { kind: "failed" };
    }
    // Once more, a little later: a busy server is usually busy for a moment.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (signal.aborted) return { kind: "failed" };
  }
  return { kind: "failed" };
}

/**
 * Fetch every tile of the ranges onto the phone, for this route.
 *
 * Tiles already on disk, from an earlier download or from having looked at
 * the place online, are counted and not fetched again — which also makes
 * "try again" after a cut connection cheap. Ends with the area recorded,
 * marked incomplete if anything is missing.
 */
export async function downloadArea(routeId: number, box: Box, ranges: TileRange[]): Promise<void> {
  if (download.status === "running") return;
  const controller = new AbortController();
  abort = controller;
  forgetOnEnd = false;

  const tiles = [...tilesOf(ranges)];
  let done = 0;
  let failed = 0;
  let bytes = 0;
  let next = 0;
  publishDownload({ status: "running", routeId, done, total: tiles.length, failed });

  try {
    TILES.create({ intermediates: true, idempotent: true });
  } catch {
    /* the first tile will say whether the disk is usable */
  }

  let lastPublished = 0;
  const report = () => {
    const now = Date.now();
    // A few times a second is enough for a progress bar.
    if (now - lastPublished < 150 && done < tiles.length) return;
    lastPublished = now;
    publishDownload({ status: "running", routeId, done, total: tiles.length, failed });
  };

  const worker = async () => {
    while (!controller.signal.aborted) {
      const index = next;
      next += 1;
      if (index >= tiles.length) return;
      const tile = tiles[index];

      const existing = tileFile(tile);
      if (existing.exists) {
        bytes += existing.size ?? 0;
      } else {
        const result = await fetchTile(tile, controller.signal);
        if (result.kind === "saved") bytes += result.bytes;
        if (result.kind === "failed" && !controller.signal.aborted) failed += 1;
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
      if (controller.signal.aborted) return;
      done += 1;
      report();
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const cancelled = controller.signal.aborted;
  if (abort === controller) abort = null;
  const complete = !cancelled && failed === 0;

  // Whatever arrived is kept and listed, even after a cancel: it is on the
  // phone either way, and listed it can be found and deleted.
  if (done > 0 && !(cancelled && forgetOnEnd)) {
    const kept: OfflineArea = {
      routeId, box, ranges, tiles: done - failed, bytes, savedAt: Date.now(), complete,
    };
    publishAreas([...getAreas().filter((area) => area.routeId !== routeId), kept]);
  }
  publishDownload({
    status: cancelled ? "cancelled" : complete ? "done" : "incomplete",
    routeId, done, total: tiles.length, failed,
  });
}

/** Stop the download under way. The tiles already fetched stay. */
export function cancelDownload(options: { forget?: boolean } = {}): void {
  if (!abort) return;
  forgetOnEnd = options.forget ?? false;
  abort.abort();
}

/** Forget how the last download ended, once it has been seen. */
export function dismissDownload(): void {
  if (download.status !== "running") publishDownload(IDLE);
}
