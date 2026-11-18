import { palette, type ColorToken } from "@tread/core/palette";
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

const dual = (pair: { light: string; dark: string }): ColorValue =>
  Platform.OS === "ios" ? DynamicColorIOS(pair) : androidDark ? pair.dark : pair.light;

/**
 * The values live in `@tread/core/palette`, shared with the web. The notes on
 * why each one is what it is stay here:
 * - `sunken` is for the rare recessed block, never a page canvas.
 * - Dark needs a lighter accent to stay legible, and dark text on top of it:
 *   white on a blue pale enough to read against near black fails contrast.
 * - `scrim` is heavier in the dark, where a light veil reads as fog.
 */
export const colors = Object.fromEntries(
  Object.entries(palette).map(([token, pair]) => [token, dual(pair)]),
) as Record<ColorToken, ColorValue>;

/**
 * Barlow Condensed, by weight.
 *
 * A condensed face because the app is almost entirely numbers, and numbers
 * set narrow read as pace: it is the typography of a stopwatch and a start
 * list rather than of a paragraph. It also buys back width, which is why the
 * figures could shrink without losing any of their presence.
 *
 * Each weight is its own file with its own name, so weight is chosen by
 * picking a family here rather than by asking for a fontWeight. Asking for
 * one on top would have the system smear a synthetic bold over an already
 * bold face.
 */
export const font = {
  regular: "BarlowCondensed_400Regular",
  medium: "BarlowCondensed_500Medium",
  semibold: "BarlowCondensed_600SemiBold",
  bold: "BarlowCondensed_700Bold",
  extrabold: "BarlowCondensed_800ExtraBold",
} as const;

/**
 * Cobalt, chosen where the colour actually has to work rather than on a
 * swatch: the track is drawn on a map. The green it replaces vanished into
 * the first park a run crossed — parks are green.
 *
 * Measured rather than eyeballed. White on it clears eleven to one, so the
 * play button carries its icon comfortably rather than barely. And it sits
 * far from every colour a map puts underneath it — roughly twice the
 * distance at which two colours start being confused — including water,
 * which it beats on both depth and saturation. The blues that failed did so
 * for one of two reasons: too pale to hold white text, or the exact blue of
 * a river.
 *
 * Literal pairs, for native components that demand a concrete colour string
 * and cannot resolve a dynamic one: the map's polyline is drawn by MapKit,
 * not by React Native, so it never sees the system appearance.
 */
export const literalColors = {
  track: palette.track,
  // The navigation header is a native bar, and native bars resolve a dynamic
  // colour to its light variant and stop there — so a dark app wore a white
  // strip across the top of every pushed screen.
  background: palette.background,
  text: palette.text,
  // For colours animated between states, which have to be read as values.
  warning: palette.warning,
  sunken: palette.sunken,
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
