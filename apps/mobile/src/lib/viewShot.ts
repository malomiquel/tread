import { Platform, TurboModuleRegistry } from "react-native";

export type ViewShot = typeof import("react-native-view-shot");

let loaded: ViewShot | null | undefined;

/**
 * The screenshot library, or null where its native half is missing.
 *
 * Probed rather than imported, and the distinction matters more here than
 * anywhere else in the app: this library resolves its native module with
 * `getEnforcing`, which throws at import time. A plain import therefore takes
 * down the whole run screen wherever the native side is absent — Expo Go, for
 * one — rather than merely disabling the button it belongs to.
 *
 * The same shape as the HealthKit guard, for the same reason: ask the
 * registry first, because asking the registry cannot throw.
 */
export function viewShot(): ViewShot | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === "web") return (loaded = null);
  try {
    loaded = TurboModuleRegistry.get("RNViewShot")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? (require("react-native-view-shot") as ViewShot)
      : null;
  } catch {
    loaded = null;
  }
  return loaded;
}
