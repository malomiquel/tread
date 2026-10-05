import * as gifencModule from "gifenc";
import UPNG from "upng-js";
import type { GifencModule } from "gifenc";
import { getLanguage } from "./i18n.ts";

/**
 * gifenc, whichever shape this toolchain hands it over in.
 *
 * It ships two bundles. Metro takes the CommonJS one, which esbuild marks
 * with `__esModule`, so Babel's interop hands back `module.exports.default` —
 * and that default is `GIFEncoder` itself, a function with no `quantize` on
 * it. Node ignores the marking and hands back the whole module instead. The
 * same import therefore yields a working object under the test runner and an
 * empty destructure on a phone, which is a bug no test on this side can see:
 * the symptom is "undefined is not a function", raised on the device only.
 *
 * So the shape is established by asking rather than assumed, and a failure
 * says what failed instead of dying on a call to undefined.
 */
export function pickGifenc(module: unknown): GifencModule {
  for (const shape of [module, (module as { default?: unknown } | null)?.default]) {
    const found = shape as Partial<GifencModule> | undefined;
    if (found
      && typeof found.GIFEncoder === "function"
      && typeof found.quantize === "function"
      && typeof found.applyPalette === "function"
      && typeof found.nearestColorIndex === "function") {
      return found as GifencModule;
    }
  }
  throw new Error(getLanguage() === "fr"
    ? "L'encodeur GIF n'a pas pu être chargé."
    : "The GIF encoder couldn't be loaded.");
}

const gifenc = (): GifencModule => pickGifenc(gifencModule);

/**
 * Turning a sequence of captured frames into one animated GIF.
 *
 * A GIF rather than a video because a GIF plays by itself, inline, everywhere
 * somebody might paste it — a message, a feed, a forum — with nothing to tap
 * and no player to wait for. That is the whole reason to prefer a format from
 * 1989 over one that would be a tenth the size.
 *
 * Nothing here touches the platform: frames go in as raw pixels and bytes
 * come out, which is what lets the whole encoder be tested by plain node.
 */

/**
 * How many colours the animation is reduced to.
 *
 * A GIF holds 256 at most, and the frames are mostly a map: greys, a green or
 * two, water, and one saturated line over the top. A hundred and twenty-seven
 * leaves the line and the type clean while nearly halving what each frame
 * costs against the full table — and the hundred and twenty-eighth slot of a
 * table of 128 is kept for "unchanged", below.
 */
const COLOURS = 127;

/**
 * The palette every frame shares, read off one of them.
 *
 * Built once, from the last frame rather than the first, and that is the
 * whole trick: the last frame is the only one that holds every colour the
 * animation will ever show — the map, the finished line, the head of it, and
 * the type laid over the bottom. Quantising each frame on its own would cost
 * the same work forty times over and make the palette shift under the
 * animation, which reads as the map flickering between colours.
 */
export function paletteFor(rgba: Uint8Array): number[][] {
  return gifenc().quantize(rgba, COLOURS, { format: "rgb565" });
}

export interface GifWriter {
  /** Adds one frame, shown for `delayMs` before the next. */
  add: (rgba: Uint8Array, delayMs: number) => void;
  /** Closes the file and hands over its bytes. */
  finish: () => Uint8Array;
}

/**
 * An encoder that takes frames one at a time.
 *
 * One at a time on purpose: a run's replay is forty frames of nearly six
 * hundred thousand bytes each, and holding them all to encode at the end
 * would be twenty-three megabytes of pixels alive at once on a phone. Written
 * as they arrive, only the frame in hand and the one before it are kept.
 *
 * Only the first frame is written whole. Each one after it holds just the
 * pixels that changed; every other pixel is the palette's spare index, which
 * the file declares transparent, and each frame is left in place under the
 * next — so what shows through is the frame before. A replay changes a few
 * hundred pixels a frame out of a hundred and fifty thousand: matching those
 * few to the palette, instead of all of them, is most of the time saved, and
 * a frame that is one index repeated compresses to almost nothing.
 */
export function startGif(width: number, height: number, palette: number[][]): GifWriter {
  const { applyPalette, GIFEncoder, nearestColorIndex } = gifenc();
  const encoder = GIFEncoder();
  // Indexed against the colours alone, so the spare slot is never chosen
  // for a real one; the file's table carries the spare as well.
  const keep = palette.length;
  const table = [...palette, [0, 0, 0]];
  const pixels = width * height;
  let previous: Uint32Array | null = null;
  /** Colours already matched, by their packed value: a line is one colour. */
  const matched = new Map<number, number>();

  return {
    add: (rgba, delayMs) => {
      // Read four bytes at a time, which needs the pixels on a four-byte boundary.
      const whole = rgba.byteOffset % 4 === 0 ? rgba : rgba.slice();
      const current = new Uint32Array(whole.buffer, whole.byteOffset, pixels);
      if (previous === null) {
        encoder.writeFrame(applyPalette(rgba, palette, "rgb565"), width, height, {
          palette: table, delay: delayMs, dispose: 1,
        });
      } else {
        const indexed = new Uint8Array(pixels).fill(keep);
        for (let i = 0; i < pixels; i += 1) {
          const colour = current[i];
          if (colour === previous[i]) continue;
          let index = matched.get(colour);
          if (index === undefined) {
            const at = i * 4;
            index = nearestColorIndex(palette, [rgba[at], rgba[at + 1], rgba[at + 2]]);
            matched.set(colour, index);
          }
          indexed[i] = index;
        }
        encoder.writeFrame(indexed, width, height, {
          delay: delayMs, transparent: true, transparentIndex: keep, dispose: 1,
        });
      }
      // Copied: the caller goes on drawing into the same buffer.
      previous = current.slice();
    },
    finish: () => {
      encoder.finish();
      return encoder.bytes();
    },
  };
}

export interface Pixels {
  width: number;
  height: number;
  /** Four bytes a pixel, red first. */
  rgba: Uint8Array;
}

/**
 * A captured PNG, as pixels.
 *
 * The screenshot library hands back a PNG file and the encoder wants raw
 * bytes, so somebody has to do this. It is the slowest step of the whole
 * export, which is why the frames are captured at the card's own size rather
 * than at the three times that a phone screen would otherwise give.
 */
export function pngToPixels(bytes: Uint8Array): Pixels | null {
  try {
    // Copied into its own buffer: a view onto a larger one decodes as
    // whatever happens to sit around it.
    const image = UPNG.decode(bytes.slice().buffer as ArrayBuffer);
    const [frame] = UPNG.toRGBA8(image);
    return { width: image.width, height: image.height, rgba: new Uint8Array(frame) };
  } catch {
    return null;
  }
}

/** File name for the animation, dated like every other thing the app exports. */
export function gifFileName(name: string | null, at: number): string {
  const day = new Date(at).toISOString().slice(0, 10);
  const called = (name ?? "course")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${day}-${called || "course"}.gif`;
}
