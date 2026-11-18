import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";

/**
 * A block of a page, as the landing page sets its sections: a rounded
 * `sunken` panel, set 12 points in from the edge, radius 20.
 *
 * It replaces the hairline lists a tab used to be laid straight on. What a
 * panel holds keeps its gutter of 20 from the screen's edge (8 inside the
 * panel), so text lines up with the headings above it.
 */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export const PANEL_INSET = 12;
/** Horizontal padding inside a panel that keeps its content on the page's 20-point gutter. */
export const PANEL_PADDING = 20 - PANEL_INSET;

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: PANEL_INSET, borderRadius: 20, overflow: "hidden",
    paddingVertical: 2, backgroundColor: colors.sunken,
  },
});
