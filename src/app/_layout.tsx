import "@/lib/tracker"; // defines the background GPS task at startup, outside any screen
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { initDb } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(loadSettings)
      .then(() => setReady(true))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Base de données inaccessible.");
      });
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Un titre est nécessaire même sans en-tête : le bouton retour de
            l'écran suivant s'en sert, et retombe sinon sur le nom technique
            de la route, « (tabs) ». */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Tread" }} />
        <Stack.Screen name="run/[id]" options={{ title: "Course", headerBackTitle: "Retour" }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  error: { color: colors.danger, textAlign: "center" },
});
