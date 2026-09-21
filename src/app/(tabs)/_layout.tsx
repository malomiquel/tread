import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { StyleSheet, View, type ColorValue } from "react-native";
import { FloatingTabBar } from "@/components/FloatingTabBar";
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
      /**
       * No bar over the run screen. It is a map from edge to edge, and a bar
       * floating across the bottom of it was the one thing between the runner
       * and the ground they are covering. That screen carries its own way out
       * instead, a chevron in the corner. It is told to hide rather than left
       * unrendered, so that it can slide away and come back instead of
       * blinking out of existence as the screen changes.
       */
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          hidden={props.state.routes[props.state.index].name === "courir"}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Historique",
          animation: "fade",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      {/*
        * In the middle: the section opened most often.
        *
        * And the only one without a fade on arrival. The fade animates the
        * whole scene's opacity on the native driver, and this screen is made
        * almost entirely of native surfaces — the map and the glass panels —
        * which simply stop drawing under an animated opacity. The screen
        * arrived completely white. Its own furniture handles the arrival
        * instead, each piece from its own edge.
        */}
      <Tabs.Screen
        name="courir"
        options={{
          title: "Courir",
          animation: "none",
          tabBarIcon: ({ color, size }) => <RunTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progression",
          animation: "fade",
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
    borderColor: colors.background,
  },
  badgePaused: { backgroundColor: colors.warning },
});
