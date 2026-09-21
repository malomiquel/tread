import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, shadows } from "@/lib/theme";

type Variant = "primary" | "secondary" | "danger";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

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
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: colors.accent, ...shadows.button, shadowColor: colors.accent },
  secondary: { backgroundColor: colors.surface, ...shadows.card },
  danger: { backgroundColor: colors.dangerSoft },
  // 0.96: anything smaller and the button feels like it ducks away from the thumb.
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  disabled: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  labelPrimary: { color: colors.accentText, fontWeight: "700" },
  labelDanger: { color: colors.danger },
});
