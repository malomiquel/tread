import type { TrackPoint } from "@tread/core/geo";

/** A run's outline in its tile: the track, flattened to fit, from a 60-point sample. */
export function RunShape({ points, size = 36 }: { points: TrackPoint[]; size?: number }) {
  const step = Math.max(1, Math.floor(points.length / 60));
  const sample = points.filter((_, index) => index % step === 0);
  const lats = sample.map((p) => p.lat);
  const lngs = sample.map((p) => p.lng);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const xs = lngs.map((lng) => lng * Math.cos(midLat));
  const minX = Math.min(...xs);
  const maxY = Math.max(...lats);
  const span = Math.max(Math.max(...xs) - minX, maxY - Math.min(...lats)) || 1;
  const d = sample
    .map((p, index) => {
      const x = ((xs[index] - minX) / span) * size;
      const y = ((maxY - p.lat) / span) * size;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${size + 4} ${size + 4}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
