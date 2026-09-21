/**
 * Flat, print-like. White page, hairline rules, almost no radius and almost no
 * shadow.
 *
 * The previous direction, white rounded cards floating on a grey canvas with a
 * soft shadow on everything, is the default look of every starter template. It
 * reads as unfinished rather than designed. Separation here comes from rules
 * and from typographic weight, the way a well set page does it, not from
 * stacking surfaces.
 */
export const colors = {
  background: "#ffffff",
  /** For the rare recessed block. Never a page canvas. */
  sunken: "#f4f4f4",
  hairline: "#e6e6e6",
  text: "#101010",
  muted: "#6e6e6e",
  subtle: "#9c9c9c",
  accent: "#0f7a3d",
  accentText: "#ffffff",
  accentSoft: "#eaf3ed",
  warning: "#9a5b06",
  danger: "#b3261e",
  dangerSoft: "#fbecea",
  track: "#0f7a3d",
} as const;

/**
 * The only shadow left in the app. Controls floating over a map have nothing
 * behind them to separate from, so they genuinely need one; everything else
 * sits on the page and is separated by a rule.
 */
export const floatingShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.18,
  shadowRadius: 4,
  elevation: 3,
};
