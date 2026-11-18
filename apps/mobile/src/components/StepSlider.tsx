import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors, floatingShadow, font } from "@/lib/theme";

interface Props<T extends number> {
  /** The stops, left to right. */
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers, which adjust it with a swipe up or down. */
  accessibilityLabel: string;
}

const THUMB = 30;
const TRACK = 6;
const SNAP = { damping: 22, stiffness: 260 } as const;

/**
 * A slider that only rests on its stops.
 *
 * Dragged, the thumb follows the finger and settles on the nearest stop when
 * let go; tapped, the track sends it straight there. Each new stop is felt
 * as the light tick a picker gives, so the choice can be made without
 * looking at the numbers. Written here rather than pulled in, because a
 * handful of stops needs none of what a general slider library carries.
 */
export function StepSlider<T extends number>({ values, value, onChange, accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const last = values.length - 1;
  const index = Math.max(0, values.indexOf(value));
  const span = Math.max(1, width - THUMB);
  const stopX = (at: number) => (last === 0 ? 0 : (at / last) * span);

  const x = useSharedValue(0);
  /** A finger is on the thumb: it, not the chosen stop, says where it goes. */
  const dragging = useSharedValue(false);
  /** The first placement jumps; every later one springs. */
  const placed = useRef(false);

  // Where the thumb belongs whenever no finger is holding it: on the chosen
  // stop, found again whenever the choice or the width changes.
  useEffect(() => {
    if (width === 0 || dragging.get()) return;
    const target = last === 0 ? 0 : (index / last) * Math.max(1, width - THUMB);
    x.set(placed.current ? withSpring(target, SNAP) : target);
    placed.current = true;
  }, [dragging, index, last, width, x]);

  const choose = (at: number) => {
    const next = values[at];
    if (next === undefined || next === value) return;
    void Haptics.selectionAsync().catch(() => undefined);
    onChange(next);
  };

  const nearest = (position: number) => {
    "worklet";
    return Math.min(last, Math.max(0, Math.round((position / span) * last)));
  };

  const drag = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .onBegin(() => {
      dragging.set(true);
    })
    .onUpdate((event) => {
      const position = Math.min(span, Math.max(0, event.x - THUMB / 2));
      x.set(position);
      runOnJS(choose)(nearest(position));
    })
    .onFinalize((_event, success) => {
      dragging.set(false);
      // Only a drag that happened settles here. A touch that turned out to
      // be a tap also ends this gesture, and the tap has already sent the
      // thumb where it belongs.
      if (success) x.set(withSpring((nearest(x.get()) / Math.max(1, last)) * span, SNAP));
    });

  const tap = Gesture.Tap().onEnd((event) => {
    const at = nearest(Math.min(span, Math.max(0, event.x - THUMB / 2)));
    x.set(withSpring((at / Math.max(1, last)) * span, SNAP));
    runOnJS(choose)(at);
  });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.get() + TRACK }));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: String(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") choose(Math.min(last, index + 1));
        if (event.nativeEvent.actionName === "decrement") choose(Math.max(0, index - 1));
      }}
    >
      <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
        <View style={styles.area} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
          <View style={styles.track} />
          <Animated.View style={[styles.fill, fillStyle]} />
          {values.map((stop, at) => (
            <View
              key={stop}
              style={[styles.tick, at <= index && styles.tickOn, { left: stopX(at) + THUMB / 2 - 3 }]}
            />
          ))}
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
      <View style={styles.labels}>
        {values.map((stop, at) => (
          <Text
            key={stop}
            style={[styles.label, at === index && styles.labelOn, { left: stopX(at), width: THUMB }]}
          >
            {stop}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: THUMB + 16, justifyContent: "center" },
  track: {
    position: "absolute", left: THUMB / 2, right: THUMB / 2,
    height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.accentSoft,
  },
  fill: {
    position: "absolute", left: THUMB / 2 - TRACK / 2,
    height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.accent,
  },
  tick: {
    position: "absolute", width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.hairline,
  },
  tickOn: { backgroundColor: colors.accentText },
  thumb: {
    position: "absolute", left: 0,
    width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: colors.background,
    borderWidth: 2, borderColor: colors.accent,
    ...floatingShadow,
  },
  labels: { height: 22 },
  label: {
    position: "absolute", top: 0, textAlign: "center",
    color: colors.subtle, fontSize: 15, fontFamily: font.semibold,
  },
  labelOn: { color: colors.accent },
});
