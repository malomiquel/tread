/** An outing's outline in its tile, from the sampled [lat, lng] pairs. */
export function RunShape({ shape, size = 30 }: { shape: readonly (readonly [number, number])[]; size?: number }) {
  if (shape.length < 2) return null;
  const lats = shape.map(([lat]) => lat);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const xs = shape.map(([, lng]) => lng * Math.cos(midLat));
  const minX = Math.min(...xs);
  const maxY = Math.max(...lats);
  const spanX = Math.max(...xs) - minX;
  const spanY = maxY - Math.min(...lats);
  const span = Math.max(spanX, spanY) || 1;
  // Centred in its square, whichever way it is longer.
  const offX = ((span - spanX) / span) * size * 0.5;
  const offY = ((span - spanY) / span) * size * 0.5;
  const d = shape
    .map(([lat], index) => {
      const x = offX + ((xs[index] - minX) / span) * size;
      const y = offY + ((maxY - lat) / span) * size;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${size + 4} ${size + 4}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
