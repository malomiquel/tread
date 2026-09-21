import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { couleurs } from "@/lib/theme";

export default function Onglets() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.accent,
        tabBarInactiveTintColor: couleurs.discret,
        tabBarStyle: { backgroundColor: couleurs.surface, borderTopColor: couleurs.bordure },
        sceneStyle: { backgroundColor: couleurs.fond },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Courir", tabBarIcon: ({ color, size }) => <Ionicons name="play-circle" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="historique"
        options={{ title: "Historique", tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
