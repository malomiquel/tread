import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { StyleSheet, View, type ColorValue } from "react-native";
import { colors } from "@/lib/theme";
import { useTracker } from "@/lib/tracker";

/**
 * The Courir tab icon, with a dot when a run is recording.
 *
 * The dot rather than a different icon on purpose: swapping in a play or pause
 * symbol made the tab look like a button that would start something, when all
 * it does is move between sections. A badge reports state without promising
 * an action.
 */
// La couleur fournie par la barre d'onglets est une ColorValue, pas une
// simple chaîne : elle peut être une valeur opaque de la plateforme.
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
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
    borderColor: colors.surface,
  },
  badgePaused: { backgroundColor: colors.warning },
});
