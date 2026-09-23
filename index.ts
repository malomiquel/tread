import "expo-router/entry";
import { Platform } from "react-native";

// The Android home-screen widget is drawn by a headless task, which has to be
// registered while the bundle loads: Android may start the app for the widget
// alone, with no screen to show, and asks for the task straight away. Required
// rather than imported, and guarded, because without its native half (Expo Go)
// the library throws as soon as it is loaded.
if (Platform.OS === "android") {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerWidgetTaskHandler } = require("react-native-android-widget") as typeof import("react-native-android-widget");
    const { widgetTaskHandler } = require("./src/lib/widgetTask") as typeof import("./src/lib/widgetTask");
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    /* no widget in this build */
  }
}
