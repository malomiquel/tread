import type { Rarity } from "./card.ts";
import { palette } from "./palette.ts";

/**
 * How a card is printed: its paper, its metal edge, the light on it, the
 * lines engraved in it and the holographic sheen of the rarer ones.
 *
 * A card is a picture, made to leave the app, so none of this follows the
 * appearance of the phone or the browser. Paper, metal and sheen exist on
 * the cards alone, the one place made to look printed, so they live here
 * rather than in the palette. The phone (`CardSurface.tsx`) and the web
 * (`apps/web/src/components/CardSurface.tsx`) both print from these.
 */

/** A card's proportions, a playing card's: five wide for seven high. */
export const CARD_RATIO = 7 / 5;

const light = (token: keyof typeof palette) => palette[token].light;

/**
 * How a card of one tier is printed.
 *
 * `frame` and `frameWidth` stay for what draws a plain border rather than
 * the metal edge.
 */
export interface Look {
  /** The ground the card is printed on. */
  page: string;
  /** The metal edge, as the stops of a polished strip. */
  metal: readonly [string, string, ...string[]];
  /** A flat colour standing for the edge, where no gradient is drawn. */
  frame: string;
  frameWidth: number;
  /** The light falling on the ground from the top right, or none. */
  glow: readonly [string, string] | null;
  /** The contour lines engraved in the ground. */
  contour: string;
  /** The holographic sheen laid over the card, from 0 (none) to 1. */
  foil: number;
  /** A second frame inside the edge. */
  innerFrame: string | null;
  tile: string;
  line: string;
  ink: string;
  strong: string;
  soft: string;
  rule: string;
  /** A unit beside a figure, and the traits: the light colour of the tier. */
  lit: string;
}

const IVORY = "#f7f5f0";
const IVORY_SOFT = "#8a8780";
const IVORY_STRONG = "#5f5c56";
const NIGHT = "#0b0b0c";
const MATTE_SILVER = ["#cfcbc2", "#f1eee8", "#b6b1a7", "#e4e1da"] as const;
const COOL_PAPER = "#f1f4fa";
const BLUE_STEEL = ["#c9d6f2", "#7f97c9", "#eef3ff", "#6f86b8", "#c9d6f2"] as const;
const POLISHED_SILVER = ["#eef1f6", "#9aa3b2", "#ffffff", "#8d96a6", "#e6e9ef"] as const;
const PLATINUM = ["#f4f4f4", "#8f8f8f", "#ffffff", "#b9c8ff", "#7a7a7a", "#ededed"] as const;
const ON_DARK_SOFT = "rgba(255, 255, 255, 0.66)";
const ON_DARK_RULE = "rgba(255, 255, 255, 0.2)";
const CLEAR = "rgba(0, 52, 143, 0)";

const paper: Look = {
  page: IVORY, metal: MATTE_SILVER, frame: "#cfcbc2", frameWidth: 1,
  glow: null, contour: "rgba(16, 16, 16, 0.07)", foil: 0, innerFrame: null,
  tile: "rgba(16, 16, 16, 0.04)", line: light("accent"),
  ink: light("text"), strong: IVORY_STRONG, soft: IVORY_SOFT, rule: "rgba(16, 16, 16, 0.12)", lit: light("accent"),
};

const night = (glow: readonly [string, string], foil: number, innerFrame: string | null): Look => ({
  page: NIGHT, metal: PLATINUM, frame: "#b9c8ff", frameWidth: 2,
  glow, contour: "rgba(255, 255, 255, 0.09)", foil, innerFrame,
  tile: "rgba(255, 255, 255, 0.06)", line: light("stageGlow"),
  ink: "#ffffff", strong: "#ffffff", soft: ON_DARK_SOFT, rule: ON_DARK_RULE, lit: light("stageGlow"),
});

const LOOKS: Record<Rarity | "legendary", Look> = {
  common: paper,
  notable: {
    ...paper,
    page: COOL_PAPER, metal: BLUE_STEEL, frame: light("accent"), frameWidth: 1.5,
    glow: ["rgba(111, 168, 255, 0.28)", "rgba(111, 168, 255, 0)"], contour: "rgba(0, 52, 143, 0.1)",
    innerFrame: "rgba(0, 52, 143, 0.28)", tile: "rgba(0, 52, 143, 0.05)", strong: light("accent"),
  },
  rare: {
    page: light("stage"), metal: POLISHED_SILVER, frame: light("accent"), frameWidth: 2,
    glow: ["rgba(111, 168, 255, 0.6)", "rgba(111, 168, 255, 0)"], contour: "rgba(255, 255, 255, 0.1)", foil: 0.7,
    innerFrame: null,
    tile: "rgba(255, 255, 255, 0.08)", line: "#ffffff",
    ink: "#ffffff", strong: "#ffffff", soft: ON_DARK_SOFT, rule: ON_DARK_RULE, lit: light("stageGlow"),
  },
  exceptional: night(["rgba(0, 52, 143, 0.95)", CLEAR], 0.85, null),
  legendary: night(["rgba(111, 168, 255, 0.7)", CLEAR], 1, "rgba(255, 255, 255, 0.34)"),
};

/** How a card of each rarity is printed, for every card that wears one. */
export const cardLook = (rarity: Rarity | "legendary"): Look => LOOKS[rarity];

/** The back every card shares: the stage under silver, finely engraved. */
export const BACK_LOOK: Look = {
  ...LOOKS.rare, foil: 0.35, innerFrame: "rgba(255, 255, 255, 0.3)",
};

/** The text on the back of a card, whatever its tier. */
export const BACK_INK = { brand: light("onStage"), number: ON_DARK_SOFT } as const;

/** The diamonds that say a rarity in shape as well as in a word. */
export function rarityPips(rarity: Rarity | "legendary"): string {
  const filled = { common: 1, notable: 2, rare: 3, exceptional: 4, legendary: 5 }[rarity];
  const of = rarity === "legendary" ? 5 : 4;
  return "◆".repeat(filled) + "◇".repeat(of - filled);
}

/** A ground colour at an opacity, for the fade under a card's text. */
export function fade(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/**
 * The holographic sheen: bands of pale colour, laid across the card three
 * times its width and slid against the tilt.
 */
export function foilBands(strength: number): { colors: string[]; locations: number[] } {
  const a = (alpha: number) => (alpha * strength).toFixed(3);
  return {
    colors: [
      "rgba(255, 255, 255, 0)",
      `rgba(159, 232, 255, ${a(0.26)})`,
      `rgba(255, 184, 238, ${a(0.24)})`,
      `rgba(200, 255, 184, ${a(0.2)})`,
      `rgba(255, 233, 168, ${a(0.18)})`,
      "rgba(255, 255, 255, 0)",
      `rgba(185, 200, 255, ${a(0.18)})`,
      "rgba(255, 255, 255, 0)",
    ],
    locations: [0.18, 0.3, 0.38, 0.45, 0.52, 0.62, 0.72, 0.84],
  };
}

/** A small deterministic generator, so a card is engraved the same every time. */
function random(seed: number): () => number {
  let state = (Math.abs(Math.floor(seed)) * 2654435761) % 4294967296 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Lines a card is engraved with, like the contours of a map, drawn from its
 * seed in a 300 × 420 box: no two cards are engraved alike.
 */
export function contourPaths(seed: number): string[] {
  const next = random(seed);
  const lines = 15;
  const tilt = (next() - 0.5) * 80;
  const a = 10 + next() * 14;
  const b = 4 + next() * 8;
  const f1 = 0.012 + next() * 0.01;
  const f2 = 0.03 + next() * 0.02;
  const p1 = next() * Math.PI * 2;
  const p2 = next() * Math.PI * 2;
  const paths: string[] = [];
  for (let line = 0; line < lines; line++) {
    const base = -20 + (line * 460) / lines;
    const swell = 1 + 0.35 * Math.sin(line * 0.7 + p1);
    let d = "";
    for (let x = -10; x <= 310; x += 10) {
      const y = base + (tilt * x) / 300
        + swell * a * Math.sin(x * f1 + p1 + line * 0.18)
        + b * Math.sin(x * f2 + p2 - line * 0.25);
      d += `${x === -10 ? "M" : "L"}${x} ${y.toFixed(1)} `;
    }
    paths.push(d);
  }
  return paths;
}
