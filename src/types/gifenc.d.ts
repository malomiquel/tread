/**
 * Hand-written because gifenc ships none.
 *
 * Only the three functions this app actually calls are declared, and they are
 * declared narrowly: a blanket `declare module` would type the whole library
 * as `any`, which is how a typo in an option name becomes a silent no-op in a
 * file nobody reads twice.
 */
declare module "gifenc" {
  /** Pixel packing gifenc reads the frame with. The app uses rgb565. */
  export type GifFormat = "rgb565" | "rgb444" | "rgba4444";

  /** A palette entry: red, green, blue, each nought to 255. */
  export type GifPalette = number[][];

  export function quantize(
    rgba: Uint8Array,
    colours: number,
    options?: { format?: GifFormat; oneBitAlpha?: boolean; clearAlpha?: boolean },
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array,
    palette: GifPalette,
    format?: GifFormat,
  ): Uint8Array;

  export interface GifEncoder {
    writeFrame(
      indexed: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: GifPalette;
        /** Milliseconds this frame is held. Rounded to hundredths by the format. */
        delay?: number;
        /** Zero repeats for ever, which is what an animation of a run wants. */
        repeat?: number;
        transparent?: boolean;
        dispose?: number;
        first?: boolean;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoder;

  /** The three functions this app uses, however they arrive. */
  export interface GifencModule {
    GIFEncoder: typeof GIFEncoder;
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
  }

  /**
   * Deliberately unknown.
   *
   * What the default export holds depends on which of the two bundles the
   * toolchain picked and how it interops: the whole module under node, and
   * `GIFEncoder` alone under Metro. Typing it as either would make one of the
   * two a lie the compiler enforces, so it is typed as neither and sorted out
   * at runtime.
   */
  const gifencDefault: unknown;
  export default gifencDefault;
}
