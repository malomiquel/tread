import { Appearance, DynamicColorIOS, Platform, type ColorValue } from "react-native";

/**
 * Flat, print-like, in two appearances. White page or near black, hairline
 * rules, almost no radius and almost no shadow. Separation comes from rules
 * and typographic weight, the way a well set page does it, not from stacking
 * surfaces.
 */

/**
 * On iOS the colour itself carries both appearances and the system resolves
 * it at draw time, so every StyleSheet below stays static and the whole app
 * flips the instant the phone does, with no re-render and no theme context
 * threaded through a hundred components.
 *
 * Android has no equivalent, so it reads the appearance once at launch.
 * Changing the system theme there needs the app reopened, which is a fair
 * trade against rebuilding every stylesheet on the fly.
 */
const androidDark = Appearance.getColorScheme() === "dark";

const dual = (light: string, dark: string): ColorValue =>
  Platform.OS === "ios" ? DynamicColorIOS({ light, dark }) : androidDark ? dark : light;

export const colors = {
  background: dual("#ffffff", "#0b0b0c"),
  /** For the rare recessed block. Never a page canvas. */
  sunken: dual("#f4f4f4", "#18181a"),
  hairline: dual("#e6e6e6", "#2b2b2e"),
  text: dual("#101010", "#f2f2f3"),
  muted: dual("rgba(16, 16, 16, 0.62)", "rgba(242, 242, 243, 0.62)"),
  subtle: dual("rgba(16, 16, 16, 0.42)", "rgba(242, 242, 243, 0.44)"),
  // Dark needs a lighter green to stay legible, and dark text on top of it:
  // white on a green pale enough to read against near black fails contrast.
  accent: dual("#0f7a3d", "#41b573"),
  accentText: dual("#ffffff", "#07130b"),
  accentSoft: dual("rgba(15, 122, 61, 0.12)", "rgba(65, 181, 115, 0.18)"),
  warning: dual("#9a5b06", "#d69a3e"),
  danger: dual("#b3261e", "#f08078"),
  dangerSoft: dual("rgba(179, 38, 30, 0.10)", "rgba(240, 128, 120, 0.16)"),
  track: dual("#0f7a3d", "#4cc47f"),
  /** Behind a dialog. Heavier in the dark, where a light veil reads as fog. */
  scrim: dual("rgba(16, 16, 16, 0.4)", "rgba(0, 0, 0, 0.6)"),
} as const;

/**
 * Literal pairs, for native components that demand a concrete colour string
 * and cannot resolve a dynamic one: the map's polyline is drawn by MapKit,
 * not by React Native, so it never sees the system appearance.
 */
export const literalColors = {
  track: { light: "#0f7a3d", dark: "#4cc47f" },
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
