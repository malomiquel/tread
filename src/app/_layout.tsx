import "@/lib/tracker"; // defines the background GPS task at startup, outside any screen
import {
  BarlowCondensed_400Regular, BarlowCondensed_500Medium, BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, useFonts,
} from "@expo-google-fonts/barlow-condensed";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, useColorScheme, View, Alert } from "react-native";
import { IncomingGpx } from "@/components/IncomingGpx";
import { backfillEfforts, checkpoint, initDb } from "@/lib/db";
import { importFromHealth } from "@/lib/healthSync";
import { copyToOffer, makeCopy, restoreNewestCopy } from "@/lib/safetyCopy";
import { refreshHomeWidget } from "@/lib/homeWidget";
import { defineStrings, intlLocale, useStrings } from "@/lib/i18n";
import { applyLanguage } from "@/lib/language";
import { clearStaleRun } from "@/lib/liveActivity";
import { refreshReminders } from "@/lib/planReminders";
import { configureServices } from "@/lib/services";
import { loadCustomSessions } from "@/lib/sessionLibrary";
import { loadSettings, useSettings } from "@/lib/settings";
import { colors, literalColors } from "@/lib/theme";

const layoutStrings = defineStrings({
  fr: {
    databaseUnavailable: "Base de données inaccessible.",
    launchFailedTitle: "Tread n'a pas pu ouvrir tes données",
    launchFailed: "Rien n'est effacé. Ferme l'app complètement puis rouvre-la. Si ça recommence, ce détail aidera à comprendre :",
    restoreTitle: "Une copie de tes courses existe",
    restoreMessage: (runs: number, date: string) =>
      `Ta copie de sécurité du ${date} contient ${runs} course${runs > 1 ? "s" : ""}. La remettre dans l'app ?`,
    restoreLater: "Plus tard",
    restoreFailedTitle: "Copie illisible",
    restoreFailed: "La copie n'a pas pu être lue. Tu peux réessayer dans Réglages › Données.",
    restoreNow: "Récupérer",
    restoredTitle: "Courses récupérées",
    back: "Retour",
    run: "Course",
    editRun: "Modifier la course",
    addRun: "Ajouter une course",
    heatmap: "Toutes tes courses",
    recap: "Récap",
    method: "Méthode",
    settings: "Réglages",
    profile: "Profil",
    notifications: "Notifications",
    language: "Langue",
    runner: "Mon profil de coureur",
    units: "Unités",
    sharing: "Partage",
    shoes: "Chaussures",
    data: "Données",
    about: "À propos",
    privacy: "Confidentialité",
    transfer: "Changer de téléphone",
    send: "Envoyer",
    receive: "Recevoir",
  },
  en: {
    databaseUnavailable: "The database can't be opened.",
    launchFailedTitle: "Tread couldn't open your data",
    launchFailed: "Nothing has been erased. Close the app completely and open it again. If it happens again, this detail will help:",
    restoreTitle: "A copy of your runs exists",
    restoreMessage: (runs: number, date: string) =>
      `Your safety copy from ${date} holds ${runs} run${runs > 1 ? "s" : ""}. Bring them back into the app?`,
    restoreLater: "Later",
    restoreFailedTitle: "Copy unreadable",
    restoreFailed: "The copy couldn't be read. You can try again in Settings › Data.",
    restoreNow: "Bring them back",
    restoredTitle: "Runs restored",
    back: "Back",
    run: "Run",
    editRun: "Edit run",
    addRun: "Add a run",
    heatmap: "All your runs",
    recap: "Recap",
    method: "Method",
    settings: "Settings",
    profile: "Profile",
    notifications: "Notifications",
    language: "Language",
    runner: "My runner profile",
    units: "Units",
    sharing: "Sharing",
    shoes: "Shoes",
    data: "Data",
    about: "About",
    privacy: "Privacy",
    transfer: "Switch phones",
    send: "Send",
    receive: "Receive",
  },
});

// The weather and routing endpoints, and the support address, as this build
// was configured. Read once, before any screen can ask for either.
configureServices(Constants.expoConfig?.extra?.services as Record<string, unknown> | undefined);

export default function RootLayout() {
  const s = useStrings(layoutStrings);
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
  const { welcomed } = useSettings();

  useEffect(() => {
    // An activity outlives the process that started it, so a run cut short by
    // a crash or a swipe-away can leave a clock counting on the lock screen
    // for a run that is long over. Launching is the moment to clear it.
    clearStaleRun();
    // The phone's language until the settings say otherwise, so that the
    // loading and error screens already speak it; loadSettings then applies
    // the stored choice.
    applyLanguage("auto");
    // Health is no longer asked for here. Raised by the launch itself, its
    // sheet was the first thing a new user saw, with nothing to say what it
    // was for; the welcome asks instead, with the reason beside the button.
    initDb()
      .then(() => Promise.all([loadSettings(), loadCustomSessions()]))
      .then(() => {
        setReady(true);
        // The home-screen widget, as things stand at launch.
        void refreshHomeWidget();
        // Runs that predate best efforts, or came from a file or another
        // phone, have theirs worked out quietly, one at a time.
        void backfillEfforts().catch(() => undefined);
        // The settings are loaded by now, so this knows whether reminders are
        // wanted at all. Not awaited: it reaches the network for the weather,
        // and nothing about opening the app depends on its answer.
        void refreshReminders();
        // Runs a watch recorded while the app was closed, when that is on.
        void importFromHealth();
        // An empty app with a copy in the cloud: a reinstall, or a new phone.
        // Offered once, and only then is a first copy of this state written.
        void copyToOffer().then((copy) => {
          if (!copy) {
            void makeCopy();
            return;
          }
          const words = layoutStrings();
          Alert.alert(
            words.restoreTitle,
            words.restoreMessage(copy.runs, new Date(copy.at).toLocaleDateString(intlLocale(), { day: "numeric", month: "long" })),
            [
              { text: words.restoreLater, style: "cancel" },
              {
                text: words.restoreNow,
                onPress: () => void restoreNewestCopy()
                  .then((summary) => {
                    if (summary) Alert.alert(words.restoredTitle, summary);
                  })
                  .catch(() => Alert.alert(words.restoreFailedTitle, words.restoreFailed)),
              },
            ],
          );
        });
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : layoutStrings().databaseUnavailable);
      });
  }, []);

  // Leaving the app is when anything the widget shows may have changed — a
  // goal set, a plan made, a language switched — so it is rewritten then.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        void refreshHomeWidget();
        // Folded first, so the copy reads a database with the last run in it.
        void checkpoint().then(() => makeCopy());
      }
      // Back from a run with the watch: its run is waiting in Health.
      if (next === "active") void importFromHealth();
    });
    return () => subscription.remove();
  }, []);

  // Said in words first; the cause stays underneath, small and selectable,
  // because it is the one thing that lets anybody find out what went wrong.
  if (error) {
    const words = layoutStrings();
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{words.launchFailedTitle}</Text>
        <Text style={styles.errorText}>{words.launchFailed}</Text>
        <Text style={styles.error} selectable>{error}</Text>
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
        {/* A title is needed even without a header: the next screen's back
            button uses it, and would otherwise fall back on the route's
            technical name, "(tabs)". */}
        {/* The welcome, until it has been seen — and then never again.
            Guarded rather than pushed: the rest of the app simply does not
            exist until the welcome is done, so there is nothing behind it to
            swipe back to, and finishing it lands on the tabs by itself. */}
        <Stack.Protected guard={!welcomed}>
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={welcomed}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Tread" }} />
          {/*
            * Running is a page laid over the tabs, not a tab.
            *
            * It already was in all but name: it hid the bar and carried its
            * own way out. Making it a real stacked page gives it the native
            * back gesture — the page follows the finger and uncovers the one
            * beneath — which no tab can offer, having nothing behind it to
            * reveal.
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
          <Stack.Screen name="run/[id]" options={{ title: s.run, headerBackTitle: s.back }} />
          <Stack.Screen name="run/edit/[id]" options={{ title: s.editRun, headerBackTitle: s.run }} />
          <Stack.Screen name="run/add" options={{ title: s.addRun, headerBackTitle: s.back }} />
          <Stack.Screen name="heatmap" options={{ title: s.heatmap, headerBackTitle: s.profile }} />
          <Stack.Screen name="recap" options={{ title: s.recap, headerBackTitle: s.back }} />
          <Stack.Screen name="plan-method" options={{ title: s.method, headerBackTitle: s.back }} />
          {/* One screen for both: drawing a route and changing one are the same
              act, and the title is set by the screen from what it was given. */}
          <Stack.Screen name="route/[id]" options={{ headerBackTitle: s.back }} />
          {/* A page of its own, with its own rooms under it. Naming each back
              button after the page it returns to is what makes a hierarchy
              readable from inside it. */}
          {/* Titled by the page itself: a new session or one being changed. */}
          <Stack.Screen name="session/[id]" options={{ headerBackTitle: s.back }} />
          {/* Titled by the page itself, from the list it was opened on. */}
          <Stack.Screen name="performance/[section]" options={{ headerBackTitle: s.profile }} />
          <Stack.Screen name="settings/index" options={{ title: s.settings, headerBackTitle: s.profile }} />
          <Stack.Screen
            name="settings/notifications"
            options={{ title: s.notifications, headerBackTitle: s.settings }}
          />
          <Stack.Screen
            name="settings/language"
            options={{ title: s.language, headerBackTitle: s.settings }}
          />
          <Stack.Screen
            name="settings/runner"
            options={{ title: s.runner, headerBackTitle: s.settings }}
          />
          <Stack.Screen
            name="settings/units"
            options={{ title: s.units, headerBackTitle: s.settings }}
          />
          <Stack.Screen
            name="settings/sharing"
            options={{ title: s.sharing, headerBackTitle: s.settings }}
          />
          <Stack.Screen name="settings/shoes" options={{ title: s.shoes, headerBackTitle: s.settings }} />
          <Stack.Screen name="settings/shoe/[id]" options={{ headerBackTitle: s.shoes }} />
          <Stack.Screen name="settings/data" options={{ title: s.data, headerBackTitle: s.settings }} />
          <Stack.Screen name="settings/about" options={{ title: s.about, headerBackTitle: s.settings }} />
          <Stack.Screen
            name="settings/privacy"
            options={{ title: s.privacy, headerBackTitle: s.about }}
          />
          <Stack.Screen
            name="settings/transfer"
            options={{ title: s.transfer, headerBackTitle: s.back }}
          />
          <Stack.Screen name="settings/send" options={{ title: s.send, headerBackTitle: s.back }} />
          <Stack.Screen name="settings/receive" options={{ title: s.receive, headerBackTitle: s.back }} />
        </Stack.Protected>
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
  errorTitle: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  errorText: { color: colors.muted, fontSize: 15, textAlign: "center", marginBottom: 16 },
  error: { color: colors.subtle, fontSize: 12, textAlign: "center" },
});
