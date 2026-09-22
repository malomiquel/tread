import "@/lib/tracker"; // defines the background GPS task at startup, outside any screen
import {
  BarlowCondensed_400Regular, BarlowCondensed_500Medium, BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, useFonts,
} from "@expo-google-fonts/barlow-condensed";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import { IncomingGpx } from "@/components/IncomingGpx";
import { initDb } from "@/lib/db";
import { requestHealthAccess } from "@/lib/health";
import { clearStaleRun } from "@/lib/liveActivity";
import { refreshReminders } from "@/lib/planReminders";
import { loadSettings } from "@/lib/settings";
import { colors, literalColors } from "@/lib/theme";

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [ready, setReady] = useState(false);
  // Nothing is drawn before the faces are in: text rendered in the system
  // font and then reflowed a frame later is a visible stutter on every launch.
  const [fontsReady] = useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // An activity outlives the process that started it, so a run cut short by
    // a crash or a swipe-away can leave a clock counting on the lock screen
    // for a run that is long over. Launching is the moment to clear it.
    clearStaleRun();
    // Asked once, at the start, rather than hidden behind a switch somewhere.
    // iOS shows its sheet the first time and silently remembers the answer
    // afterwards, so this is a no-op on every later launch. It is not awaited:
    // whatever the answer, it changes nothing about opening the app, and a
    // refusal simply means runs stay in Tread alone.
    void requestHealthAccess();
    initDb()
      .then(loadSettings)
      .then(() => {
        setReady(true);
        // The settings are loaded by now, so this knows whether reminders are
        // wanted at all. Not awaited: it reaches the network for the weather,
        // and nothing about opening the app depends on its answer.
        void refreshReminders();
      })
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

  if (!ready || !fontsReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    // Required at the root for any gesture to be recognised. Expo Router does
    // not mount it for us, and without it a swipe simply never fires.
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="auto" />
      {/* Mounted inside the navigator, because opening a file ends by
          showing the run it created. */}
      <IncomingGpx />
      <Stack
        screenOptions={{
          // Literal, read from the scheme here, rather than the dynamic colour
          // the rest of the app uses: a native navigation bar takes the light
          // variant of a dynamic colour whatever the appearance, which put a
          // white strip above every dark screen. The scene below it keeps the
          // dynamic one, which React Native does resolve properly.
          headerStyle: { backgroundColor: literalColors.background[scheme] },
          headerTintColor: literalColors.text[scheme],
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Un titre est nécessaire même sans en-tête : le bouton retour de
            l'écran suivant s'en sert, et retombe sinon sur le nom technique
            de la route, « (tabs) ». */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Tread" }} />
        {/*
          * Courir est une page posée sur les onglets, pas un onglet.
          *
          * Elle l'était déjà en tout sauf en nom : elle masquait la barre et
          * portait sa propre sortie. En faire vraiment une page empilée rend
          * le geste de retour natif — la page suit le doigt et découvre
          * celle d'en dessous — qu'aucun onglet ne peut offrir, faute de
          * quoi que ce soit derrière lui à dévoiler.
          */}
        {/*
          * Presented over the tabs rather than pushed in front of them.
          *
          * A transparent background alone was not enough: react-native-screens
          * detaches the screen underneath a pushed one and only puts it back
          * when the stack itself starts moving, so dragging uncovered nothing
          * and the tab arrived only once the gesture had finished.
          *
          * A transparent modal keeps that screen attached the whole time,
          * which is the one thing the drag needs. The animation is named
          * explicitly because this presentation would otherwise arrive from
          * the bottom, and this screen has always come from the side.
          */}
        <Stack.Screen
          name="record"
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "slide_from_right",
            gestureDirection: "horizontal",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen name="run/[id]" options={{ title: "Course", headerBackTitle: "Retour" }} />
        <Stack.Screen name="plan-method" options={{ title: "Méthode", headerBackTitle: "Retour" }} />
        {/* One screen for both: drawing a route and changing one are the same
            act, and the title is set by the screen from what it was given. */}
        <Stack.Screen name="route/[id]" options={{ headerBackTitle: "Retour" }} />
        {/* A page of its own, with its own rooms under it. Naming each back
            button after the page it returns to is what makes a hierarchy
            readable from inside it. */}
        <Stack.Screen name="settings/index" options={{ title: "Réglages", headerBackTitle: "Profil" }} />
        <Stack.Screen
          name="settings/notifications"
          options={{ title: "Notifications", headerBackTitle: "Réglages" }}
        />
        <Stack.Screen name="settings/plan" options={{ title: "Plan", headerBackTitle: "Réglages" }} />
        <Stack.Screen
          name="settings/transfer"
          options={{ title: "Transfert", headerBackTitle: "Réglages" }}
        />
        <Stack.Screen name="settings/send" options={{ title: "Envoyer", headerBackTitle: "Transfert" }} />
        <Stack.Screen name="settings/receive" options={{ title: "Recevoir", headerBackTitle: "Transfert" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  error: { color: colors.danger, textAlign: "center" },
});
