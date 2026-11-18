/**
 * Drawing a line into pixels, by hand.
 *
 * The share animation used to be made by photographing the screen once per
 * frame and decoding each photograph back into pixels — the two slowest
 * things a phone can be asked to do, forty times over, and visibly so. The
 * card is now photographed once and everything that moves is drawn straight
 * into that buffer here, which is the same work a graphics library would do
 * except that nothing has to cross into native code and back.
 *
 * No canvas, no context, no platform: pixels in, pixels out, testable.
 */

export interface Canvas {
  /** Four bytes a pixel, red first. Written in place. */
  rgba: Uint8Array;
  width: number;
  height: number;
}

export type Colour = readonly [number, number, number];

export interface Point {
  x: number;
  y: number;
}

/**
 * One straight stroke, with soft edges.
 *
 * Walked half a pixel at a time and stamped with a disc rather than drawn
 * with Bresenham: a route is all diagonals and shallow curves, and a
 * single-pixel staircase down a diagonal reads as a fax of a run rather than
 * as a run. The coverage falls off across the last pixel of the radius, which
 * is what antialiasing is when nobody is looking.
 */
export function stroke(
  canvas: Canvas,
  from: Point,
  to: Point,
  colour: Colour,
  radius: number,
  /** Optional per-row dimming, for the part of the card under the gradient. */
  fade: (y: number) => number = () => 1,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(length * 2));

  for (let step = 0; step <= steps; step += 1) {
    const along = step / steps;
    disc(canvas, from.x + dx * along, from.y + dy * along, colour, radius, fade);
  }
}

/** One round dab of colour, blended by how much of each pixel it covers. */
export function disc(
  canvas: Canvas,
  cx: number,
  cy: number,
  colour: Colour,
  radius: number,
  fade: (y: number) => number = () => 1,
): void {
  const reach = Math.ceil(radius + 1);
  const left = Math.max(0, Math.floor(cx) - reach);
  const right = Math.min(canvas.width - 1, Math.ceil(cx) + reach);
  const top = Math.max(0, Math.floor(cy) - reach);
  const bottom = Math.min(canvas.height - 1, Math.ceil(cy) + reach);

  for (let y = top; y <= bottom; y += 1) {
    const dimmed = fade(y);
    if (dimmed <= 0) continue;
    for (let x = left; x <= right; x += 1) {
      const away = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      // Full inside, nothing outside, and one pixel of ramp in between.
      const covered = Math.min(1, Math.max(0, radius + 0.5 - away)) * dimmed;
      if (covered <= 0) continue;

      const at = (y * canvas.width + x) * 4;
      canvas.rgba[at] += (colour[0] - canvas.rgba[at]) * covered;
      canvas.rgba[at + 1] += (colour[1] - canvas.rgba[at + 1]) * covered;
      canvas.rgba[at + 2] += (colour[2] - canvas.rgba[at + 2]) * covered;
    }
  }
}

/**
 * A colour written as "#rrggbb", as three numbers.
 *
 * The theme states its colours the way a stylesheet does, and this file works
 * in bytes.
 */
export function readColour(hex: string): Colour {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * How much of the drawn line survives at each row of the card.
 *
 * The still draws its line under the gradient that darkens the bottom of the
 * picture; this one draws over a photograph that already has the gradient
 * baked in, so a route reaching down into the text would cross it at full
 * strength. Dimming it across the same band is what makes the two versions
 * of the card look like the same card.
 */
export function veil(height: number, band: number, floor = 0.3): (y: number) => number {
  const from = height - band;
  return (y) => {
    if (y <= from) return 1;
    const into = (y - from) / band;
    return 1 - into * (1 - floor);
  };
}
