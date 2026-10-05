import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Small enough to feel like a key giving way, not a card shrinking. */
const PRESSED = 0.96;
const DOWN = { duration: 90, easing: Easing.out(Easing.quad) };
const UP = { duration: 160, easing: Easing.out(Easing.cubic) };

interface Props extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
}

/**
 * A button that gives under the finger.
 *
 * Fading a control on press is what a web page does; a thing on a phone is
 * pushed. The scale runs on the UI thread and is interruptible, so a quick
 * tap dips and comes back rather than snapping between two states. Rows in
 * a list keep their own feedback, a sunken background: a whole row shrinking
 * away from its rules reads as the list moving.
 */
export function PressableScale({ style, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.set(withTiming(PRESSED, DOWN));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, UP));
        onPressOut?.(event);
      }}
      style={[style, pressed]}
    />
  );
}
