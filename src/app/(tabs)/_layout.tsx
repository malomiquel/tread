import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { colors, shadows } from "@/lib/theme";
import { useTracker } from "@/lib/tracker";

/**
 * The raised centre button. It is the one thing you reach for, so it sits in
 * the middle of the bar and stands proud of it rather than queuing up with the
 * other two.
 *
 * Its icon reports the tracker's state, which means a run left recording is
 * visible from any tab, not only from the screen that started it.
 */
function StartTabButton({ onPress }: { onPress?: (event: GestureResponderEvent) => void }) {
  const tracker = useTracker();
  const icon =
    tracker.status === "running" ? "pulse" : tracker.status === "paused" ? "pause" : "play";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Courir"
      style={styles.slot}
    >
      {({ pressed }) => (
        <View style={[styles.circle, pressed && styles.pressed]}>
          <Ionicons
            name={icon}
            size={26}
            color={colors.accentText}
            // A play triangle centred geometrically reads as off-centre: its
            // mass sits left of its box. The other two icons are symmetrical.
            style={icon === "play" ? styles.play : undefined}
          />
        </View>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: styles.bar,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="history"
        options={{
          title: "Historique",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Courir",
          // The raised button carries its own meaning; a label underneath
          // would collide with the circle and add nothing.
          tabBarLabel: () => null,
          tabBarButton: (props) => <StartTabButton onPress={props.onPress} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progression",
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 88,
    paddingTop: 8,
    // Without this the lifted circle is clipped at the top of the bar.
    overflow: "visible",
  },
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  circle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    // Lifted just enough to read as raised, not so far that it floats away
    // from the bar it belongs to.
    marginTop: -18,
    ...shadows.button,
    shadowColor: colors.accent,
    shadowOpacity: 0.34,
    shadowRadius: 16,
  },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.92 },
  play: { marginLeft: 3 },
});
