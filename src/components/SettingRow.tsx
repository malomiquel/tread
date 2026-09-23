import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  /** A mark on the left, so a row can be found by eye before it is read. */
  icon?: Icon;
  label: string;
  /** The sentence under it, for anything the label cannot say on its own. */
  detail?: string;
  /**
   * Where the setting currently stands, on the right — "La veille au soir".
   *
   * It is what turns a list of doors into a list of answers: a settings page
   * that only names its rooms makes you walk into every one of them to find
   * out what is set.
   */
  value?: string;
  /** A control that lives in the row itself, such as a switch. */
  right?: React.ReactNode;
  /**
   * One of several answers to the same question, and this is the one chosen.
   *
   * A tick rather than a chevron, because the row leads nowhere: it *is* the
   * answer. Rows that offer a choice are the one case where a settings list
   * changes something by itself.
   */
  selected?: boolean;
  onPress?: () => void;
  /** Reads as an action rather than a setting: red, centred, no chevron. */
  destructive?: boolean;
}

/**
 * One line of a settings page.
 *
 * The app sets its pages like print — rules and weight, no floating cards —
 * and this is that same page furniture, made once so that three screens
 * cannot drift apart from one another.
 */
export function SettingRow({
  icon, label, detail, value, right, onPress, destructive, selected,
}: Props) {
  const body = (
    <>
      {icon ? (
        <View style={styles.icon}>
          <Ionicons name={icon} size={17} color={colors.accent} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {selected !== undefined ? (
        selected ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null
      ) : /* Only where there is somewhere to go. A chevron on a row that
             merely toggles something promises a page that does not exist. */
        onPress && !right && !destructive ? (
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? "button" : "radio"}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [styles.row, destructive && styles.rowCentred, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, minHeight: 50 },
  icon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft,
  },
  rowCentred: { justifyContent: "center" },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 1 },
  label: { color: colors.text, fontSize: 16.5, fontFamily: font.medium },
  destructive: { color: colors.danger, flex: 0, fontFamily: font.semibold },
  detail: { color: colors.subtle, fontSize: 14, fontFamily: font.regular, lineHeight: 19 },
  value: { color: colors.muted, fontSize: 15.5, fontFamily: font.regular, maxWidth: 170 },
});
