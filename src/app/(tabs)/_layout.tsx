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

/**
 * Where the app opens, stated rather than inherited.
 *
 * Expo Router starts on the first screen declared, which used to be the
 * history by happy accident. The plan is declared first now, so the landing
 * has to be named explicitly or the app would open somewhere nobody asked
 * for.
 */
export const unstable_settings = { initialRouteName: "index" };

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
          hidden={props.state.routes[props.state.index].name === "record"}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {/*
        * First, because it answers the question the others cannot.
        *
        * The rest of the app reports what has happened — a run under way, a
        * list of past ones, a chart of the whole. This one says what to do
        * next, and someone opening the app before a run is usually asking
        * exactly that.
        */}
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          animation: "fade",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      {/*
        * Then the run itself, second of four and within a thumb's reach.
        *
        * The only one without a fade on arrival. The fade animates the whole
        * scene's opacity on the native driver, and this screen is made almost
        * entirely of native surfaces — the map and the glass panels — which
        * simply stop drawing under an animated opacity. The screen arrived
        * completely white. Its own furniture handles the arrival instead,
        * each piece from its own edge.
        */}
      <Tabs.Screen
        name="record"
        options={{
          title: "Courir",
          animation: "none",
          tabBarIcon: ({ color, size }) => <RunTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Historique",
          animation: "fade",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      {/*
        * The progression lives in here rather than in a section of its own.
        *
        * Statistics are not a place you go, they are something you have — and
        * a profile is the drawer everything of that kind belongs in, with
        * room for what comes next without inventing another tab for it.
        */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          animation: "fade",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
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
