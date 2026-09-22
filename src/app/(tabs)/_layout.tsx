import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { colors } from "@/lib/theme";

/**
 * Where the app opens, stated rather than inherited.
 *
 * Expo Router starts on the first screen declared, which used to be the
 * history by happy accident. The plan is declared first now, so the landing
 * has to be named explicitly or the app would open somewhere nobody asked
 * for.
 */
/**
 * No transition between tabs, on purpose.
 *
 * Both options this navigator offers animate the scene's opacity — `shift`
 * is that same fade with a slide added, not an alternative to it. And an
 * animated opacity is what the native surfaces in this app refuse to
 * composite under: it blanked the run screen, it stripped the glass panels
 * of their background, and it is what left the history and the profile
 * showing white on some arrivals and not others.
 *
 * Three symptoms, one cause, and the transition was never worth any of them.
 * Motion can come back the way the run screen does it — each piece arriving
 * from its own edge, translated rather than faded — which touches no opacity
 * and cannot strand a screen at zero.
 */
export const unstable_settings = { initialRouteName: "index" };

export default function TabsLayout() {
  return (
    <Tabs
      /*
       * The bar has nothing left to hide from. Running used to be a tab that
       * hid it; it is a page over the tabs now, so the bar is simply not on
       * screen while a run is on.
       */
      tabBar={(props) => <FloatingTabBar {...props} />}
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
          animation: "none",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Historique",
          animation: "none",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      {/*
        * The routes, where the programme's sessions are not: one says what to
        * run, the other says where. They were behind a button on the running
        * map until that stopped making sense — a route outlives the run it
        * was drawn for, and nothing that outlives a run should only be
        * reachable from inside one.
        */}
      <Tabs.Screen
        name="routes"
        options={{
          title: "Parcours",
          animation: "none",
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      {/*
        * Last, and no longer light.
        *
        * The week, the records, the totals, who this runner is, and the way
        * into the settings. Progression was a tab beside this one until the
        * two were found to be about the same person. It is also what makes
        * the bar even, which is what lets the run button sit in the middle of
        * it rather than off to one side.
        */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          animation: "none",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

