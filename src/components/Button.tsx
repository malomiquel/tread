import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, font } from "@/lib/theme";

type Variant = "primary" | "secondary" | "danger";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Flat, near square corners, no shadow. A small radius reads as a control; a
 * large one reads as a sticker.
 */
export function Button({ label, onPress, variant = "primary", disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" && styles.labelPrimary,
          variant === "danger" && styles.labelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: 50,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  danger: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.dangerSoft },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  label: { color: colors.text, fontSize: 18, fontFamily: font.semibold, letterSpacing: 0.3 },
  labelPrimary: { color: colors.accentText, fontFamily: font.bold },
  labelDanger: { color: colors.danger },
});
