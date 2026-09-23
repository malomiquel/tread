import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, font } from "@/lib/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  icon: Icon;
  label: string;
  onPress: () => void;
  /** Filled with the app's colour: the tab's main action, like drawing a route. */
  primary?: boolean;
  /** Working: a spinner takes the icon's place and taps are ignored. */
  busy?: boolean;
  accessibilityLabel?: string;
}

/**
 * The action beside a tab's title: an icon and a word, never an icon alone.
 *
 * One shape for every tab — the routes' "New", the history's "Import", the
 * profile's "Settings" — so the corner of the screen means the same thing
 * wherever it is looked at.
 */
export function HeaderButton({ icon, label, onPress, primary = false, busy = false, accessibilityLabel }: Props) {
  const tint = primary ? colors.accentText : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy }}
      hitSlop={8}
      style={({ pressed }) => [styles.button, primary && styles.primary, pressed && styles.pressed]}
    >
      {busy ? <ActivityIndicator size="small" color={tint} /> : <Ionicons name={icon} size={18} color={tint} />}
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row", alignItems: "center", gap: 5,
    height: 36, paddingLeft: 11, paddingRight: 14, borderRadius: 18,
    backgroundColor: colors.accentSoft,
  },
  primary: { backgroundColor: colors.accent },
  pressed: { opacity: 0.6 },
  label: { fontSize: 15.5, fontFamily: font.semibold },
});
