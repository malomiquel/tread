/**
 * Every run on one map, and where to look at it from.
 *
 * Drawn as translucent lines laid over one another, so the streets run most
 * often darken by themselves: no density grid to compute, the overlap is the
 * heat.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** The value at a share of the way through a sorted list. */
function quantile(sorted: readonly number[], share: number): number {
  const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * share)));
  return sorted[at];
}

/**
 * The region where most of the running happened: the middle nine tenths of
 * every point, with a margin, rather than the box around all of them.
 *
 * One run on holiday three hundred kilometres away would otherwise open the
 * map at the scale of a country, with home a smudge in one corner.
 */
export function denseRegion(tracks: readonly (readonly LatLng[])[], margin = 1.3): {
  latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number;
} | null {
  const lats = tracks.flat().map((point) => point.lat).sort((a, b) => a - b);
  const lngs = tracks.flat().map((point) => point.lng).sort((a, b) => a - b);
  if (lats.length === 0) return null;
  const south = quantile(lats, 0.05);
  const north = quantile(lats, 0.95);
  const west = quantile(lngs, 0.05);
  const east = quantile(lngs, 0.95);
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.max(0.01, (north - south) * margin),
    longitudeDelta: Math.max(0.01, (east - west) * margin),
  };
}

/** Rows of (run, point) in run order, gathered into one track per run. */
export function tracksOf(rows: readonly { run_id: number; lat: number; lng: number }[]): LatLng[][] {
  const tracks = new Map<number, LatLng[]>();
  for (const row of rows) {
    const track = tracks.get(row.run_id) ?? [];
    track.push({ lat: row.lat, lng: row.lng });
    tracks.set(row.run_id, track);
  }
  return [...tracks.values()].filter((track) => track.length > 1);
}
