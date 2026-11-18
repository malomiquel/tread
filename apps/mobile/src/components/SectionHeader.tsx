import { StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props {
  title: string;
  /** What the section adds up to, in the app's colour on the right. */
  aside?: string;
}

/**
 * The heading of a block of a tab: its name, large and tight as the landing
 * page sets its headlines, and what it comes to.
 *
 * Shared by the history's months and the profile's sections, so a heading
 * looks the same wherever the app groups things. Set on the page's own
 * colour, so it can also stay pinned while a list scrolls beneath it.
 */
export function SectionHeader({ title, aside }: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {aside ? <Text style={styles.aside} numberOfLines={1}>{aside}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
    backgroundColor: colors.background,
  },
  title: { flexShrink: 1, color: colors.text, fontSize: 24, fontFamily: font.bold, letterSpacing: -0.6 },
  aside: {
    color: colors.accent, fontSize: 15, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
});
