import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { Rarity } from "@tread/core/card";
import { palette } from "@tread/core/palette";
import { useTilt } from "@/components/TiltCard";
import { font } from "@/lib/theme";

/** A card's proportions, a playing card's: five wide for seven high. */
export const CARD_RATIO = 7 / 5;

const light = (token: keyof typeof palette) => palette[token].light;

/**
 * How a card of one tier is printed. A card is a picture, made to leave the
 * app, so none of this follows the phone's appearance.
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

/*
 * The card art's own colours. Paper, metal and holographic sheen exist on
 * the cards alone, the one place in the app made to look printed, so they
 * live here rather than in the palette.
 */
const IVORY = "#f7f5f0";
const IVORY_SOFT = "#8a8780";
const IVORY_STRONG = "#5f5c56";
const NIGHT = "#0b0b0c";
const MATTE_SILVER = ["#cfcbc2", "#f1eee8", "#b6b1a7", "#e4e1da"] as const;
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
  notable: { ...paper, metal: POLISHED_SILVER, frame: light("text"), frameWidth: 1.5, strong: light("text") },
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
const BACK: Look = {
  ...LOOKS.rare, foil: 0.35, innerFrame: "rgba(255, 255, 255, 0.3)",
};

/** The diamonds that say a rarity in shape as well as in a word. */
export function rarityPips(rarity: Rarity | "legendary"): string {
  const filled = { common: 1, notable: 2, rare: 3, exceptional: 4, legendary: 5 }[rarity];
  const of = rarity === "legendary" ? 5 : 4;
  return "◆".repeat(filled) + "◇".repeat(of - filled);
}

interface SurfaceProps {
  look: Look;
  /** Changes the contour lines, so no two cards are engraved alike. */
  seed: number;
  radius?: number;
  /** The width of the metal edge. */
  edge?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * What every card is printed on: a metal edge, the ground, the light from
 * the top right, contour lines, and on the rarer cards a holographic sheen
 * that slides with the tilt of the phone, the way a foil card catches the
 * light. Held, the light also runs along the edge and the contours drift
 * under the outline. Its content is laid on top, the sheen over everything.
 */
export const CardSurface = forwardRef<View, SurfaceProps>(function CardSurface(
  { look, seed, radius = 18, edge = 4, style, children },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={[{ borderRadius: radius, padding: edge }, styles.surface, style]}>
      <Metal colors={look.metal} />
      <View style={[styles.ground, { borderRadius: radius - edge, backgroundColor: look.page }]}>
        {look.glow ? (
          <LinearGradient
            colors={look.glow}
            start={{ x: 1.05, y: -0.1 }}
            end={{ x: 0.15, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <Contours seed={seed} color={look.contour} />
        {children}
        {look.foil > 0 ? <Foil strength={look.foil} /> : null}
        {look.innerFrame ? (
          <View
            pointerEvents="none"
            style={[styles.inner, { borderRadius: Math.max(radius - edge - 5, 4), borderColor: look.innerFrame }]}
          />
        ) : null}
      </View>
    </View>
  );
});

/** The card's tilt, or still values for a card that does not lean. */
function useLean() {
  const tilt = useTilt();
  const zero = useSharedValue(0);
  return { x: tilt?.x ?? zero, y: tilt?.y ?? zero };
}

/**
 * The metal edge: a polished strip twice the card's size, slid with the
 * tilt, so the light runs along the edge as the card is turned in the hand.
 * Only its rim shows, the ground covering the rest.
 */
function Metal({ colors }: { colors: Look["metal"] }) {
  const { x, y } = useLean();
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() * 70 }, { translateY: -y.get() * 90 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.metal, slide]}>
      <LinearGradient
        colors={[...colors, ...colors.slice(0, -1).reverse()] as unknown as Look["metal"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * Lines a card is engraved with, like the contours of a map, drawn from its
 * seed. They drift a little with the tilt, under the outline that floats
 * the other way, so the card reads as layered.
 */
function Contours({ seed, color }: { seed: number; color: string }) {
  const paths = useMemo(() => contourPaths(seed), [seed]);
  const { x, y } = useLean();
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() * 10 }, { translateY: -y.get() * 10 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.contours, drift]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
        {paths.map((d, index) => (
          <Path key={index} d={d} stroke={color} strokeWidth={1.1} fill="none" />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** A small deterministic generator, so a card is engraved the same every time. */
function random(seed: number): () => number {
  let state = (Math.abs(Math.floor(seed)) * 2654435761) % 4294967296 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function contourPaths(seed: number): string[] {
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

/**
 * The holographic sheen: bands of pale colour across the card, three times
 * its width, moved against the tilt. Still on a card that does not tilt.
 */
function Foil({ strength }: { strength: number }) {
  const { x, y } = useLean();
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -x.get() * 90 }, { translateY: y.get() * 60 }],
  }));
  const a = (alpha: number) => (alpha * strength).toFixed(3);
  return (
    <Animated.View pointerEvents="none" style={[styles.foil, slide]}>
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0)",
          `rgba(159, 232, 255, ${a(0.26)})`,
          `rgba(255, 184, 238, ${a(0.24)})`,
          `rgba(200, 255, 184, ${a(0.2)})`,
          `rgba(255, 233, 168, ${a(0.18)})`,
          "rgba(255, 255, 255, 0)",
          `rgba(185, 200, 255, ${a(0.18)})`,
          "rgba(255, 255, 255, 0)",
        ]}
        locations={[0.18, 0.3, 0.38, 0.45, 0.52, 0.62, 0.72, 0.84]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * The back of every card: the stage under a silver edge, engraved, with
 * TREAD and the card's number. What a card shows before it is turned over.
 * Laid over the face it hides, so both are the same size.
 */
export function CardBack({ number, small = false }: { number?: string; small?: boolean }) {
  return (
    <CardSurface
      look={BACK}
      seed={7}
      radius={small ? 8 : 18}
      edge={small ? 1.5 : 4}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.back}>
        <Text style={[styles.backBrand, small && styles.backBrandSmall]}>TREAD</Text>
        {number && !small ? <Text style={styles.backNumber}>{number}</Text> : null}
      </View>
    </CardSurface>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: "hidden" },
  ground: { flex: 1, overflow: "hidden" },
  inner: { position: "absolute", top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1 },
  metal: { position: "absolute", top: "-50%", left: "-50%", width: "200%", height: "200%" },
  contours: { position: "absolute", top: -12, left: -12, right: -12, bottom: -12 },
  foil: { position: "absolute", top: "-20%", bottom: "-20%", left: "-100%", width: "300%" },
  back: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  backBrand: { color: light("onStage"), fontSize: 44, fontFamily: font.extrabold, letterSpacing: 6 },
  backBrandSmall: { fontSize: 11, letterSpacing: 1.5 },
  backNumber: {
    color: ON_DARK_SOFT, fontSize: 13, fontFamily: font.semibold, letterSpacing: 1.3,
    textTransform: "uppercase", fontVariant: ["tabular-nums"],
  },
});
