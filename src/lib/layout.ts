import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Height of the floating tab bar itself. */
export const TAB_BAR_HEIGHT = 62;
/** Gap between the bar and the bottom edge, on top of the safe area. */
export const TAB_BAR_GAP = 10;
/** How far the bar is inset from each side, which is what centres it. */
export const TAB_BAR_INSET = 20;

/**
 * Vertical room a screen must leave at its bottom.
 *
 * A floating bar is positioned absolutely, so it no longer pushes content up
 * the way a docked one does. Without this padding every screen would hide its
 * last row underneath the bar.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + 8;
}
