import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props {
  label: string;
  /** Tinted: a filter that is on, or the sort, which always is. */
  on?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  accessibilityLabel?: string;
  /** "checkbox" for a filter that switches on and off, "button" for one that opens a choice. */
  role?: "checkbox" | "button";
  /** A chevron after the word: the chip opens a choice rather than switching. */
  menu?: boolean;
}

/**
 * One chip in the row under a list's title: the sort, or a filter.
 *
 * Neutral with a hairline when off, `accentSoft` + `accent` when on. The
 * width follows the word and the height never changes, so switching one on
 * moves nothing below it.
 */
export function Chip({ label, on = false, icon, onPress, accessibilityLabel, role = "checkbox", menu = false }: Props) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === "checkbox" ? { checked: on } : undefined}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={15} color={on ? colors.accent : colors.muted} /> : null}
      <Text style={[styles.text, on && styles.textOn]}>{label}</Text>
      {menu ? <Ionicons name="chevron-down" size={14} color={on ? colors.accent : colors.subtle} /> : null}
    </Pressable>
  );
}

/** The row the chips sit in, scrolling sideways from the page's gutter. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: GUTTER },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, height: 36, borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  pressed: { backgroundColor: colors.sunken },
  text: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  textOn: { color: colors.accent, fontFamily: font.semibold },
});
