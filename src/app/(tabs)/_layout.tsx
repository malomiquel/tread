import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, TAB_BAR_INSET } from "@/lib/layout";
import { colors, floatingShadow } from "@/lib/theme";
import { useTracker } from "@/lib/tracker";

/**
 * The Courir tab icon, with a dot when a run is recording.
 *
 * The dot rather than a different icon on purpose: swapping in a play or pause
 * symbol made the tab look like a button that would start something, when all
 * it does is move between sections. A badge reports state without promising
 * an action.
 */
function RunTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const tracker = useTracker();
  return (
    <View>
      <Ionicons name="footsteps" size={size} color={color} />
      {tracker.status !== "idle" && (
        <View
          style={[styles.badge, tracker.status === "paused" && styles.badgePaused]}
          accessibilityLabel="Course en cours"
        />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtle,
        // Floating rather than docked: inset from both sides, which is what
        // centres it, and lifted clear of the bottom edge.
        tabBarStyle: [styles.bar, { bottom: insets.bottom + TAB_BAR_GAP }],
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
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
      {/* Au milieu : c'est la section qu'on ouvre le plus souvent. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Courir",
          tabBarIcon: ({ color, size }) => <RunTabIcon color={color} size={size} />,
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
    position: "absolute",
    left: TAB_BAR_INSET,
    right: TAB_BAR_INSET,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: colors.background,
    // A docked bar is separated by its top rule; a floating one has nothing
    // above it, so the rule would read as a stray line.
    borderTopWidth: 0,
    // A hairline all round keeps the pill legible against a white page, where
    // a shadow alone would leave its edge vague.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: 6,
    ...floatingShadow,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { paddingTop: 8, paddingBottom: 6 },
  icon: { marginTop: 0 },
  label: { fontSize: 10, fontWeight: "600", letterSpacing: 0.1, marginTop: 1 },
  badge: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    // A ring in the bar's own colour keeps the dot legible wherever it lands
    // on the icon beneath it.
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  badgePaused: { backgroundColor: colors.warning },
});
