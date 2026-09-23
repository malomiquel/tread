import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props {
  /** What the figure is about: "Ce mois-ci", "Cette semaine". */
  label: string;
  value: string;
  unit?: string;
  /** The line under the figure. */
  detail?: string;
  /** Anything after it: a comparison, a goal. Drawn on the same blue. */
  children?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * The one figure a tab leads with, on the app's colour.
 *
 * The history opens on its month, the profile on its week: both the same
 * blue block, the same large number and the same line under it, so the two
 * pages read as parts of one app rather than as two designs side by side.
 */
export function SummaryBanner({
  label, value, unit, detail, children, onPress, accessibilityLabel,
}: Props) {
  const body = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {children}
    </>
  );

  if (!onPress) return <View style={styles.banner}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** A small rounded tag on the banner, for a comparison or an invitation. */
export function BannerTag({ children }: { children: React.ReactNode }) {
  return <View style={styles.tag}>{children}</View>;
}

/** Text set on the banner's blue. */
export const bannerText = StyleSheet.create({
  tag: { color: colors.accentText, fontSize: 13, fontFamily: font.medium },
  soft: {
    color: colors.accentText, opacity: 0.85, fontSize: 14, fontFamily: font.medium,
    fontVariant: ["tabular-nums"],
  },
});

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20, marginBottom: 4, paddingHorizontal: 16, paddingVertical: 13, gap: 1,
    borderRadius: 16, backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.9 },
  label: {
    color: colors.accentText, opacity: 0.75, fontSize: 11.5,
    fontFamily: font.semibold, letterSpacing: 1.2, textTransform: "uppercase",
  },
  value: {
    color: colors.accentText, fontSize: 34, fontFamily: font.semibold,
    letterSpacing: -0.8, fontVariant: ["tabular-nums"], lineHeight: 39,
  },
  unit: { fontSize: 16, fontFamily: font.medium, letterSpacing: 0 },
  detail: {
    color: colors.accentText, opacity: 0.85, fontSize: 14, fontFamily: font.regular,
    fontVariant: ["tabular-nums"],
  },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
