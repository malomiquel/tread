import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  SensorType, useAnimatedSensor, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

/**
 * How far the phone's tilt moves a card, from -1 to 1 on each axis, or null
 * when the card is still. Read by what is drawn on the card to move it in
 * depth: the outline floats above the paper.
 */
export const TiltContext = createContext<{ x: SharedValue<number>; y: SharedValue<number> } | null>(null);

export const useTilt = () => useContext(TiltContext);

/** The most a card leans, in degrees. Enough to catch the light, not to read as a 3D effect. */
const MAX_DEGREES = 9;
/**
 * How quickly the neutral angle follows the phone. The card answers a
 * movement, then settles flat again at whatever angle the phone is held,
 * so nobody has to hold it upright to see it straight.
 */
const SETTLE = 0.035;

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
  const baseX = useSharedValue<number | null>(null);
  const baseY = useSharedValue<number | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useDerivedValue(() => {
    const { x: gx, y: gy, z: gz } = gravity.sensor.get();
    const length = Math.hypot(gx, gy, gz) || 1;
    const nx = gx / length;
    const ny = gy / length;
    const fromX = baseX.get() ?? nx;
    const fromY = baseY.get() ?? ny;
    const settledX = fromX + (nx - fromX) * SETTLE;
    baseX.set(settledX);
    const settledY = fromY + (ny - fromY) * SETTLE;
    baseY.set(settledY);
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    x.set(clamp((nx - settledX) * 4));
    y.set(clamp((ny - settledY) * 4));
  });

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
