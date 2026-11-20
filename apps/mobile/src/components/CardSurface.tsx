import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { BACK_INK, BACK_LOOK, contourPaths, foilBands, type Look } from "@tread/core/cardLook";
import { useTilt } from "@/components/TiltCard";
import { font } from "@/lib/theme";

export { CARD_RATIO, cardLook, rarityPips, type Look } from "@tread/core/cardLook";

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
            style={[
              styles.inner,
              edge < 3 && styles.innerSmall,
              { borderRadius: Math.max(radius - edge - (edge < 3 ? 3 : 5), 4), borderColor: look.innerFrame },
            ]}
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

/**
 * The holographic sheen: bands of pale colour across the card, three times
 * its width, moved against the tilt. Still on a card that does not tilt.
 */
function Foil({ strength }: { strength: number }) {
  const { x, y } = useLean();
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -x.get() * 90 }, { translateY: y.get() * 60 }],
  }));
  const bands = foilBands(strength);
  return (
    <Animated.View pointerEvents="none" style={[styles.foil, slide]}>
      <LinearGradient
        colors={bands.colors as unknown as readonly [string, string, ...string[]]}
        locations={bands.locations as unknown as readonly [number, number, ...number[]]}
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
      look={BACK_LOOK}
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
  innerSmall: { top: 3, left: 3, right: 3, bottom: 3, borderWidth: StyleSheet.hairlineWidth },
  metal: { position: "absolute", top: "-50%", left: "-50%", width: "200%", height: "200%" },
  contours: { position: "absolute", top: -12, left: -12, right: -12, bottom: -12 },
  foil: { position: "absolute", top: "-20%", bottom: "-20%", left: "-100%", width: "300%" },
  back: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  backBrand: { color: BACK_INK.brand, fontSize: 44, fontFamily: font.extrabold, letterSpacing: 6 },
  backBrandSmall: { fontSize: 11, letterSpacing: 1.5 },
  backNumber: {
    color: BACK_INK.number, fontSize: 13, fontFamily: font.semibold, letterSpacing: 1.3,
    textTransform: "uppercase", fontVariant: ["tabular-nums"],
  },
});
