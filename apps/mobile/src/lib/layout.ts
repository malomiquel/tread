import { useSafeAreaInsets } from "react-native-safe-area-context";

/** How far the map's own controls sit from the top, and anything aligned with them. */
export const CONTROLS_TOP = 60;

/**
 * Side of the round buttons laid over a map. Shared because screens that
 * stack their own controls above them have to know how tall they are.
 */
export const CONTROL_SIZE = 42;

/** Height of the floating tab bar itself. */
export const TAB_BAR_HEIGHT = 62;

/**
 * How far the bar sits above the bottom edge.
 *
 * It tucks partly into the home indicator area rather than clearing it: a
 * floating bar left a full safe area above the edge reads as adrift in the
 * middle of the screen rather than belonging to the device.
 */
export function useTabBarBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 18, 8);
}

/**
 * Vertical room a screen must leave at its bottom.
 *
 * A floating bar is positioned absolutely, so it no longer pushes content up
 * the way a docked one does. Without this padding every screen would hide its
 * last row underneath the bar.
 */
export function useTabBarSpace(): number {
  return useTabBarBottom() + TAB_BAR_HEIGHT + 10;
}
