import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing, SensorType, useAnimatedSensor, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue,
  withTiming, type DerivedValue,
} from "react-native-reanimated";

/**
 * How far the phone's tilt moves a card, from -1 to 1 on each axis, or null
 * when the card is still. Read by what is drawn on the card to move it in
 * depth: the outline floats above the paper.
 */
export const TiltContext = createContext<{ x: DerivedValue<number>; y: DerivedValue<number> } | null>(null);

export const useTilt = () => useContext(TiltContext);

/** The most a card leans, in degrees. Enough to catch the light, not to read as a 3D effect. */
const MAX_DEGREES = 9;
/**
 * How quickly the neutral angle follows the phone. The card answers a
 * movement, then settles flat again at whatever angle the phone is held,
 * so nobody has to hold it upright to see it straight. Restarted with every
 * reading, a linear timing of this length closes about a thirtieth of the
 * gap each frame.
 */
const SETTLE_MS = 480;

interface Props {
  children: ReactNode;
  /** Off for a card that has earned no finish. */
  enabled: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A card that leans with the phone.
 *
 * The finish a rare card has earned: held in the hand, it tilts under the
 * light the way a printed card does, and its outline moves above the paper.
 * Driven by gravity on the UI thread, never by the JavaScript one. Still for
 * anyone who asked the phone to reduce motion, and for a plain card.
 */
export function TiltCard({ children, enabled, style }: Props) {
  const reduced = useReducedMotion();
  if (!enabled || reduced) return <View style={style}>{children}</View>;
  return <Tilting style={style}>{children}</Tilting>;
}

function Tilting({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 16 });
  /*
   * Every value here is derived, none is written from a worklet. The first
   * version kept its state with set() calls inside a derived value, and when
   * "next card" unmounted the card that worklet ran once more and wrote into
   * shared values already released: an error on the UI thread, which a
   * release build answers by closing the app.
   */
  const normal = useDerivedValue(() => {
    const { x: gx, y: gy, z: gz } = gravity.sensor.get();
    const length = Math.hypot(gx, gy, gz) || 1;
    return { x: gx / length, y: gy / length };
  });
  const settle = { duration: SETTLE_MS, easing: Easing.linear };
  const baseX = useDerivedValue(() => withTiming(normal.get().x, settle));
  const baseY = useDerivedValue(() => withTiming(normal.get().y, settle));
  const x = useDerivedValue(() => Math.max(-1, Math.min(1, (normal.get().x - baseX.get()) * 4)));
  const y = useDerivedValue(() => Math.max(-1, Math.min(1, (normal.get().y - baseY.get()) * 4)));

  const lean = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${x.get() * MAX_DEGREES}deg` },
      { rotateX: `${-y.get() * MAX_DEGREES}deg` },
    ],
  }));

  return (
    <TiltContext.Provider value={{ x, y }}>
      <Animated.View style={[styles.fill, style, lean]}>{children}</Animated.View>
    </TiltContext.Provider>
  );
}

/**
 * A layer of the card that floats above the rest: moved a few points with
 * the tilt, against it, so it reads as standing off the paper.
 */
export function Depth({ children, points = 6 }: { children: ReactNode; points?: number }) {
  const tilt = useTilt();
  const zero = useSharedValue(0);
  const x = tilt?.x ?? zero;
  const y = tilt?.y ?? zero;
  const shift = useAnimatedStyle(() => ({
    transform: [{ translateX: -x.get() * points }, { translateY: y.get() * points }],
  }));
  return <Animated.View style={shift}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { alignSelf: "center" },
});
