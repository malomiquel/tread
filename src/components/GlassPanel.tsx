import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, floatingShadow } from "@/lib/theme";

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Reacts to touches and to what moves beneath it. iOS 26 only. */
  interactive?: boolean;
}

/**
 * A panel in the system's glass material, with the two fallbacks it needs.
 *
 * Real Liquid Glass on iOS 26, which refracts and reacts to what scrolls
 * beneath it. Older iOS gets a blur. Android, which has neither, gets an
 * opaque panel: a translucent surface over nothing is worse than an honest
 * solid one.
 *
 * Extracted because the same three-way choice is needed by the tab bar and by
 * the panel over the map, and getting it subtly different in two places is how
 * an interface stops feeling like one piece of work.
 */
export function GlassPanel({ children, style, interactive = false }: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={[styles.panel, style]} glassEffectStyle="regular" isInteractive={interactive}>
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={70} tint="light" style={[styles.panel, styles.bordered, style]}>
        {children}
      </BlurView>
    );
  }

  return <View style={[styles.panel, styles.bordered, styles.opaque, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: { overflow: "hidden" },
  // The glass material carries its own depth; the fallbacks have none, so they
  // borrow a hairline and a shadow to stay detached from what is behind them.
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...floatingShadow,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  opaque: { backgroundColor: colors.background },
});
