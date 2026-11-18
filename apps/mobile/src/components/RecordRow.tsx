import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PANEL_PADDING } from "@/components/Panel";
import { colors, font } from "@/lib/theme";

export type RecordIcon = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  icon: RecordIcon;
  label: string;
  value: string;
  /** Where it was set, or what it is measured over. */
  detail?: string;
  /** The first row of a list draws no rule above it. */
  first: boolean;
  /** Makes the row lead somewhere, with a chevron to say so. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** On a `Panel` the row's tile takes the page's colour, so it still reads as a tile. */
  onPanel?: boolean;
}

/**
 * One figure worth keeping: a mark on the left, what it is and where it came
 * from, the figure on the right.
 *
 * Laid out like a run in the history — a tile, then a rule that starts after
 * it — so the profile's lists read as the same kind of list. With `onPress`
 * the row leads to a page of its own and ends in a chevron.
 */
export function RecordRow({ icon, label, value, detail, first, onPress, accessibilityLabel, onPanel = false }: Props) {
  const body = (
    <>
      <View style={[styles.mark, onPanel && styles.markOnPanel]}>
        <Ionicons name={icon} size={19} color={colors.muted} />
      </View>
      <View style={[styles.body, onPanel && styles.bodyOnPanel, !first && styles.rule]}>
        <View style={styles.text}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
        </View>
        <Text style={styles.value}>{value}</Text>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : null}
      </View>
    </>
  );

  if (!onPress) return <View style={[styles.row, onPanel && styles.rowOnPanel]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}, ${value}`}
      style={({ pressed }) => [styles.row, onPanel && styles.rowOnPanel, pressed && (onPanel ? styles.pressedOnPanel : styles.pressed)]}
    >
      {body}
    </Pressable>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: GUTTER },
  pressed: { backgroundColor: colors.sunken },
  rowOnPanel: { paddingLeft: PANEL_PADDING },
  pressedOnPanel: { backgroundColor: colors.hairline },
  markOnPanel: { backgroundColor: colors.background, width: 34, height: 34, borderRadius: 10 },
  bodyOnPanel: { paddingRight: PANEL_PADDING, paddingVertical: 10 },
  mark: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.sunken,
  },
  body: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingRight: GUTTER,
  },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  text: { flex: 1, gap: 1 },
  label: { color: colors.text, fontSize: 16.5, fontFamily: font.semibold },
  detail: { color: colors.subtle, fontSize: 14, fontFamily: font.regular },
  value: { color: colors.text, fontSize: 20, fontFamily: font.semibold, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
});
