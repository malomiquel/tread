import assert from "node:assert/strict";
import { test } from "node:test";
import { disc, readColour, stroke, veil, type Canvas } from "./raster.ts";

const WHITE = 255;
const RED = [220, 30, 30] as const;

function blank(width: number, height: number): Canvas {
  return { width, height, rgba: new Uint8Array(width * height * 4).fill(WHITE) };
}

const pixel = (canvas: Canvas, x: number, y: number) => {
  const at = (y * canvas.width + x) * 4;
  return [canvas.rgba[at], canvas.rgba[at + 1], canvas.rgba[at + 2]];
};

test("a stroke lands where it was asked for and nowhere else", () => {
  const canvas = blank(40, 40);
  stroke(canvas, { x: 5, y: 20 }, { x: 35, y: 20 }, RED, 1.5);

  // On the line, the colour is the line's.
  for (const x of [6, 20, 34]) {
    assert.ok(pixel(canvas, x, 20)[0] > 200, `x ${x}`);
    assert.ok(pixel(canvas, x, 20)[2] < 80, `x ${x}`);
  }
  // Four pixels away, nothing was touched at all.
  assert.deepEqual(pixel(canvas, 20, 26), [WHITE, WHITE, WHITE]);
  assert.deepEqual(pixel(canvas, 20, 14), [WHITE, WHITE, WHITE]);
});

test("a diagonal is drawn as a line, not as a staircase", () => {
  const canvas = blank(40, 40);
  stroke(canvas, { x: 5, y: 5 }, { x: 35, y: 35 }, RED, 1.5);
  // Every step along the diagonal is covered: a gap would be a staircase.
  for (let i = 8; i < 32; i += 1) {
    assert.ok(pixel(canvas, i, i)[0] > 190, `nothing at ${i},${i}`);
  }
});

test("the edge of a stroke is softened rather than cut", () => {
  const canvas = blank(40, 40);
  stroke(canvas, { x: 5, y: 20.3 }, { x: 35, y: 20.3 }, RED, 1.4);

  // Down one column: full colour in the middle, untouched white outside, and
  // at least one row in between that took only part of it. That partial row
  // is the whole difference between a line and a staircase.
  const column = Array.from({ length: 40 }, (_, y) => pixel(canvas, 20, y)[2]);
  assert.ok(column.some((blue) => blue < 60), "no row took the full colour");
  assert.ok(column.some((blue) => blue === WHITE), "no row was left alone");
  assert.ok(
    column.some((blue) => blue > 60 && blue < WHITE),
    `no row took part of it: ${column.filter((b) => b !== WHITE).join(", ")}`,
  );
});

test("nothing is drawn outside the canvas, whatever it is asked", () => {
  const canvas = blank(20, 20);
  assert.doesNotThrow(() => {
    stroke(canvas, { x: -50, y: -50 }, { x: 70, y: 70 }, RED, 2);
    disc(canvas, 19.5, 19.5, RED, 4);
    disc(canvas, -10, -10, RED, 4);
  });
  assert.equal(canvas.rgba.length, 20 * 20 * 4);
});

test("the line is dimmed where the card's gradient would have covered it", () => {
  const canvas = blank(20, 100);
  const fade = veil(100, 40, 0.3);
  stroke(canvas, { x: 10, y: 10 }, { x: 10, y: 95 }, RED, 1.5, fade);

  const clear = pixel(canvas, 10, 20)[0] - pixel(canvas, 10, 20)[2];
  const under = pixel(canvas, 10, 95)[0] - pixel(canvas, 10, 95)[2];
  assert.ok(under < clear, `${under} < ${clear}`);
  // Dimmed, never erased: a route that ends behind the text still ends there.
  assert.ok(under > 0);
});

test("the veil leaves the top of the card alone", () => {
  const fade = veil(512, 272, 0.3);
  assert.equal(fade(0), 1);
  assert.equal(fade(240), 1);
  assert.ok(fade(400) < 1 && fade(400) > 0.3);
  assert.ok(Math.abs(fade(512) - 0.3) < 1e-9);
});

test("a colour is read the way the theme writes it", () => {
  assert.deepEqual(readColour("#00348f"), [0, 52, 143]);
  assert.deepEqual(readColour("6fa8ff"), [111, 168, 255]);
  assert.deepEqual(readColour("#ffffff"), [255, 255, 255]);
});
