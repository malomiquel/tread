import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { TAB_BAR_HEIGHT, useTabBarBottom } from "@/lib/layout";
import { colors, floatingShadow } from "@/lib/theme";

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

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const bottom = useTabBarBottom();
  const liquid = isLiquidGlassAvailable();

  const tabs = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? colors.accent : colors.subtle;
    const label =
      typeof options.tabBarLabel === "string" ? options.tabBarLabel : (options.title ?? route.name);

    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
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
    <View
      // box-none: the bar catches taps, the empty space beside it does not, so
      // the screen underneath stays usable right up to the pill's edge.
      pointerEvents="box-none"
      style={[styles.anchor, { bottom }]}
    >
      {liquid ? (
        <GlassView style={styles.pill} glassEffectStyle="regular" isInteractive>
          {content}
        </GlassView>
      ) : Platform.OS === "ios" ? (
        <BlurView intensity={70} tint="light" style={[styles.pill, styles.bordered]}>
          {content}
        </BlurView>
      ) : (
        <View style={[styles.pill, styles.bordered, styles.opaque]}>{content}</View>
      )}
    </View>
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
  // The glass material carries its own depth; the fallbacks have none, so
  // they borrow a shadow to stay detached from the page.
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...floatingShadow,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  opaque: { backgroundColor: colors.background },
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
  label: { fontSize: 10, fontWeight: "600", letterSpacing: 0.1 },
});
