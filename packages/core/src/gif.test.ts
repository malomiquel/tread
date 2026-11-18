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
  nearestColorIndex: () => 0,
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

/**
 * Plays a GIF back as a viewer would: each frame's pixels laid over what the
 * last one left, its transparent index showing through. Only what this
 * encoder writes is understood: one global table, frames the full size.
 */
function play(bytes: Uint8Array): { table: number[][]; frames: Uint8Array[]; sizes: number[] } {
  let at = 6;
  const word = () => { const value = bytes[at] | (bytes[at + 1] << 8); at += 2; return value; };
  const width = word();
  const height = word();
  const packed = bytes[at];
  at += 3;
  const tableSize = 1 << ((packed & 7) + 1);
  const table = Array.from({ length: tableSize }, (_, i) => [bytes[at + i * 3], bytes[at + i * 3 + 1], bytes[at + i * 3 + 2]]);
  at += tableSize * 3;

  const screen = new Uint8Array(width * height);
  const frames: Uint8Array[] = [];
  const sizes: number[] = [];
  let transparent: number | null = null;
  while (at < bytes.length && bytes[at] !== 0x3b) {
    if (bytes[at] === 0x21) {
      const label = bytes[at + 1];
      at += 2;
      if (label === 0xf9) transparent = bytes[at + 1] & 1 ? bytes[at + 4] : null;
      while (bytes[at] !== 0) at += bytes[at] + 1;
      at += 1;
      continue;
    }
    // Image descriptor, then the LZW data in sub-blocks.
    at += 10;
    const minCode = bytes[at];
    at += 1;
    const start = at;
    const data: number[] = [];
    while (bytes[at] !== 0) {
      data.push(...bytes.slice(at + 1, at + 1 + bytes[at]));
      at += bytes[at] + 1;
    }
    at += 1;
    sizes.push(at - start);
    const indices = lzw(data, minCode, width * height);
    indices.forEach((index, i) => {
      if (index !== transparent) screen[i] = index;
    });
    frames.push(screen.slice());
  }
  return { table, frames, sizes };
}

function lzw(data: number[], minCode: number, length: number): number[] {
  const clear = 1 << minCode;
  const end = clear + 1;
  let size = minCode + 1;
  let dictionary: number[][] = [];
  const reset = () => {
    dictionary = Array.from({ length: clear }, (_, i) => [i]);
    dictionary.push([], []);
    size = minCode + 1;
  };
  reset();
  const out: number[] = [];
  let bit = 0;
  let prior: number[] | null = null;
  while (out.length < length) {
    let code = 0;
    for (let i = 0; i < size; i += 1, bit += 1) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    if (code === clear) { reset(); prior = null; continue; }
    if (code === end) break;
    const entry: number[] = code < dictionary.length ? dictionary[code] : [...prior!, prior![0]];
    out.push(...entry);
    if (prior) dictionary.push([...prior, entry[0]]);
    prior = entry;
    if (dictionary.length === 1 << size && size < 12) size += 1;
  }
  return out;
}

test("played back, every frame is the frame that was added", () => {
  const added = [0, 5, 60, 61, 61, WIDTH * HEIGHT].map(frame);
  const palette = paletteFor(frame(WIDTH * HEIGHT / 2));
  const gif = startGif(WIDTH, HEIGHT, palette);
  for (const rgba of added) gif.add(rgba, 80);
  const { table, frames } = play(gif.finish());

  assert.equal(frames.length, added.length);
  frames.forEach((shown, n) => {
    for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
      const [r, g, b] = table[shown[i]];
      const want = added[n].slice(i * 4, i * 4 + 3);
      const off = Math.abs(r - want[0]) + Math.abs(g - want[1]) + Math.abs(b - want[2]);
      assert.ok(off < 24, `frame ${n}, pixel ${i}: got ${r},${g},${b} for ${[...want]}`);
    }
  });
});

test("after the first, a frame weighs what changed in it", () => {
  // Big enough, and varied enough, that the first frame costs something:
  // a map is never one flat colour.
  const side = 160;
  const map = (grown: number) => {
    const rgba = new Uint8Array(side * side * 4);
    for (let i = 0; i < side * side; i += 1) {
      const drawn = i < grown;
      rgba[i * 4] = drawn ? 220 : (i * 7) % 200;
      rgba[i * 4 + 1] = drawn ? 40 : (i * 13) % 200;
      rgba[i * 4 + 2] = drawn ? 40 : 200;
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  };
  const gif = startGif(side, side, paletteFor(map(side * side / 2)));
  gif.add(map(0), 80);
  gif.add(map(40), 80);
  gif.add(map(40), 80);
  const { sizes } = play(gif.finish());
  assert.ok(sizes[1] < sizes[0] / 10, `${sizes[1]} against ${sizes[0]}`);
  assert.ok(sizes[2] <= sizes[1], "a frame with nothing new is the smallest");
});

test("the spare index is never a colour of the picture", () => {
  const palette = paletteFor(frame(WIDTH * HEIGHT / 2));
  assert.ok(palette.length <= 127);
  const gif = startGif(WIDTH, HEIGHT, palette);
  gif.add(frame(WIDTH * HEIGHT / 2), 80);
  const { frames } = play(gif.finish());
  assert.ok(frames[0].every((index) => index < palette.length));
});
