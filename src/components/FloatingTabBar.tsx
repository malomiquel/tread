import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Tabs, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { GlassPanel } from "@/components/GlassPanel";
import { TAB_BAR_HEIGHT, useTabBarBottom } from "@/lib/layout";
import { colors, font } from "@/lib/theme";
import { chooseSession, useTracker } from "@/lib/tracker";

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
  const router = useRouter();
  const tracker = useTracker();
  const recording = tracker.status !== "idle";

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

  /**
   * Running, kept in the bar rather than floating beside it.
   *
   * It is the thing this app is for, so it is present wherever you are
   * instead of on one screen out of three. Inside the same glass as the
   * sections, and filled rather than tinted, because it is not a fourth place
   * to go — it starts something, and a control that acts has no business
   * looking like a control that navigates.
   *
   * It also carries what the old tab's badge carried. A run you can no longer
   * see from the bar is a run easy to forget you left recording, so the
   * button changes colour and shape rather than staying the same in both.
   */
  const run = (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        // A free run starts free: a session left over from the last outing
        // would otherwise be handed to somebody who asked for nothing.
        if (!recording) chooseSession(null);
        router.push("/record");
      }}
      accessibilityRole="button"
      accessibilityLabel={recording ? "Reprendre la course en cours" : "Démarrer une course"}
      style={({ pressed }) => [styles.run, recording && styles.runLive, pressed && styles.tabPressed]}
    >
      <Ionicons
        name={recording ? "radio-button-on" : "play"}
        size={20}
        color={colors.accentText}
        style={recording ? undefined : styles.play}
      />
    </Pressable>
  );

  const content = (
    <View style={styles.row}>
      {tabs}
      <View style={styles.divider} />
      {run}
    </View>
  );

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
    // A shade narrower than before: the run button has to fit beside three of
    // these on the smallest phone still supported.
    minWidth: 70,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
  },
  tabPressed: { opacity: 0.55 },
  divider: {
    width: StyleSheet.hairlineWidth, height: 26, marginHorizontal: 7,
    backgroundColor: colors.hairline,
  },
  run: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.accent,
  },
  runLive: { backgroundColor: colors.warning },
  // A play triangle centred geometrically reads as off-centre: its mass sits
  // left of its box.
  play: { marginLeft: 2 },
  label: { fontSize: 13, fontFamily: font.semibold, letterSpacing: 0.1 },
});
