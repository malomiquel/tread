import assert from "node:assert/strict";
import { test } from "node:test";
import UPNG from "upng-js";
import { gifFileName, paletteFor, pickGifenc, pngToPixels, startGif } from "./gif.ts";

const WIDTH = 24;
const HEIGHT = 32;

/** A frame: a blue ground with a red line drawn `grown` pixels along the top. */
function frame(grown: number): Uint8Array {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
    const drawn = i < grown;
    rgba[i * 4] = drawn ? 220 : 30;
    rgba[i * 4 + 1] = drawn ? 40 : 60;
    rgba[i * 4 + 2] = drawn ? 40 : 200;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

test("what comes out is a GIF, header and trailer", () => {
  const gif = startGif(WIDTH, HEIGHT, paletteFor(frame(WIDTH * HEIGHT)));
  gif.add(frame(0), 80);
  const bytes = gif.finish();

  assert.equal(String.fromCharCode(...bytes.slice(0, 6)), "GIF89a");
  assert.equal(bytes[bytes.length - 1], 0x3b);
});

test("the size is written into the file, little-endian", () => {
  const gif = startGif(WIDTH, HEIGHT, paletteFor(frame(0)));
  gif.add(frame(0), 80);
  const bytes = gif.finish();
  assert.equal(bytes[6] | (bytes[7] << 8), WIDTH);
  assert.equal(bytes[8] | (bytes[9] << 8), HEIGHT);
});

test("every frame added lands in the file", () => {
  const palette = paletteFor(frame(WIDTH * HEIGHT));
  const sizes = [1, 10, 40].map((count) => {
    const gif = startGif(WIDTH, HEIGHT, palette);
    for (let i = 0; i < count; i += 1) gif.add(frame(i * 10), 80);
    return gif.finish().length;
  });
  assert.ok(sizes[0] < sizes[1] && sizes[1] < sizes[2], sizes.join(" < "));
});

test("the palette is read off the frame that holds every colour", () => {
  // The last frame carries both the ground and the line; the first only the
  // ground. A palette built on the first would have no red in it at all.
  const full = paletteFor(frame(WIDTH * HEIGHT / 2));
  const reds = full.filter(([r, g, b]) => r > 150 && g < 100 && b < 100);
  assert.ok(reds.length > 0, "the line's colour survived quantising");

  const empty = paletteFor(frame(0));
  assert.equal(empty.filter(([r, g, b]) => r > 150 && g < 100 && b < 100).length, 0);
});

test("a captured png comes back as pixels", () => {
  const original = frame(WIDTH * HEIGHT / 3);
  const png = new Uint8Array(
    UPNG.encode([original.buffer as ArrayBuffer], WIDTH, HEIGHT, 0),
  );
  const pixels = pngToPixels(png);

  assert.equal(pixels?.width, WIDTH);
  assert.equal(pixels?.height, HEIGHT);
  assert.deepEqual(pixels?.rgba, original);
});

test("anything that is not a png is not pixels", () => {
  assert.equal(pngToPixels(new Uint8Array([1, 2, 3, 4])), null);
  assert.equal(pngToPixels(new Uint8Array(0)), null);
});

test("the file is named after the run and the day", () => {
  const at = new Date(2026, 8, 24, 7, 30).getTime();
  assert.equal(gifFileName("Course matinale", at), "2026-09-24-course-matinale.gif");
  // Accents and punctuation do not travel well between phones and computers.
  assert.equal(gifFileName("Sortie d'été · 10 km", at), "2026-09-24-sortie-d-ete-10-km.gif");
  assert.equal(gifFileName(null, at), "2026-09-24-course.gif");
  assert.equal(gifFileName("···", at), "2026-09-24-course.gif");
});

/** The three shapes a bundler can hand the same library over in. */
const three = {
  GIFEncoder: () => undefined,
  quantize: () => [],
  applyPalette: () => new Uint8Array(),
};

test("the encoder is found whether it arrives whole or behind a default", () => {
  // What Metro gives: the module's own exports, named.
  assert.equal(pickGifenc(three), three);
  // What node gives: everything one level down, under `default`.
  assert.equal(pickGifenc({ default: three }), three);
  // And the CommonJS bundle itself, which carries both: the names are taken
  // from the outside, where they are all three, rather than from the default,
  // where there is only one.
  const both = pickGifenc({ ...three, default: three.GIFEncoder });
  assert.equal(both.quantize, three.quantize);
  assert.equal(both.applyPalette, three.applyPalette);
});

test("a shape with no encoder in it says so, rather than failing at the call", () => {
  // The bug this guards: a default export that is GIFEncoder alone, with no
  // quantize on it. Destructured blindly it becomes "undefined is not a
  // function", raised on a phone, in the middle of an export.
  assert.throws(() => pickGifenc({ default: three.GIFEncoder }), /encodeur GIF/);
  assert.throws(() => pickGifenc({}), /encodeur GIF/);
  assert.throws(() => pickGifenc(null), /encodeur GIF/);
  assert.throws(() => pickGifenc({ GIFEncoder: three.GIFEncoder }), /encodeur GIF/);
});
