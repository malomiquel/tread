import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { GlassPanel } from "@/components/GlassPanel";
import { TAB_BAR_HEIGHT, useTabBarBottom } from "@/lib/layout";
import { colors, font } from "@/lib/theme";

/**
 * A floating tab bar that hugs its own content.
 *
 * Written by hand rather than styled through tabBarStyle, because a bar laid
 * out by the navigator always stretches between its left and right edges. The
 * only way to get a pill no wider than the tabs inside it is to render the bar
 * ourselves.
 *
 * The material is real Liquid Glass on iOS 26, which refracts and reacts to
 * what scrolls beneath it. Older iOS falls back to a blur, and Android, which
 * has neither, to an opaque pill: a translucent panel over nothing is worse
 * than an honest solid one.
 */
/**
 * Derived from the public Tabs component rather than imported from
 * @react-navigation/bottom-tabs: Expo Router vendors its own copy, so that
 * package is not a dependency here and reaching into a build path would break
 * on any upgrade.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/**
 * Long enough to be seen leaving, short enough not to be waited for. The
 * curve is decelerating: the bar sets off at once and settles, rather than
 * easing into motion, which is what makes it read as getting out of the way
 * rather than as a thing being played at you.
 */
const SLIDE = { duration: 240, easing: Easing.out(Easing.cubic) };

export function FloatingTabBar({
  state, descriptors, navigation,
}: TabBarProps) {
  const bottom = useTabBarBottom();

  /**
   * Hidden by sliding out, not by unmounting.
   *
   * A bar that simply stops being rendered leaves a hole in the same frame
   * the new screen arrives in, and the eye reads that as a glitch rather than
   * as a change of place. Sliding it down past the edge says where it went,
   * and brings it back from the same direction.
   */
  const slide = useAnimatedStyle(() => ({
    // Moved, never faded. The pill is real glass on iOS, and a native material
    // asked to draw at partial opacity stops compositing what is behind it —
    // it flickers through the transition as a pane with no backing. Sliding
    // the whole thing past the edge needs no fade anyway.
    transform: [{ translateY: withTiming(0, SLIDE) }],
  }), [bottom]);

  const tabs = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? colors.accent : colors.subtle;
    const label =
      typeof options.tabBarLabel === "string" ? options.tabBarLabel : (options.title ?? route.name);

    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (focused || event.defaultPrevented) return;
      // The selection tick rather than an impact: this is the same gesture as
      // turning a picker, and it belongs to the same family. It fires only
      // where the navigation does — a tap on the section already open changes
      // nothing, and a buzz answering it would be claiming otherwise.
      void Haptics.selectionAsync().catch(() => undefined);
      navigation.navigate(route.name);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      >
        {options.tabBarIcon?.({ focused, color, size: 22 })}
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  });

  const content = <View style={styles.row}>{tabs}</View>;

  return (
    <Animated.View
      // box-none: the bar catches taps, the empty space beside it does not, so
      // the screen underneath stays usable right up to the pill's edge. While
      // it is away it catches nothing at all, or it would answer taps aimed at
      // the map it is sliding off.
      pointerEvents="box-none"
      style={[styles.anchor, { bottom }, slide]}
    >
      <GlassPanel style={styles.pill} interactive>
        {content}
      </GlassPanel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  // No fixed width: the pill is exactly as wide as the tabs it holds.
  pill: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
    paddingHorizontal: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  tab: {
    minWidth: 76,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
  },
  tabPressed: { opacity: 0.55 },
  label: { fontSize: 13, fontFamily: font.semibold, letterSpacing: 0.1 },
});
