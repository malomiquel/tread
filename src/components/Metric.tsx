import { StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props {
  label: string;
  value: string;
  unit?: string;
  /** Hero treatment: the one figure you read mid-stride. */
  large?: boolean;
  /** For panels laid over the map, where the standard size overflows. */
  compact?: boolean;
  align?: "left" | "right";
}

/**
 * A measurement with its label.
 *
 * The contrast between the two is deliberately steep: a small, quiet, widely
 * tracked label above a very large, tightly tracked figure. Sizing them within
 * a few points of each other, as the previous version did, left the eye
 * nothing to land on.
 */
export function Metric({ label, value, unit, large, compact, align = "left" }: Props) {
  return (
    <View style={[styles.block, compact && styles.blockCompact, align === "right" && styles.right]}>
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.row, align === "right" && styles.rowRight]}>
        <Text style={[styles.value, large && styles.large, compact && styles.valueCompact]} numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.unit, large && styles.unitLarge, compact && styles.unitCompact]}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, minWidth: 92 },
  // minWidth zero so three of these can share a narrow panel: at 92 they
  // refused to shrink, overflowed, and the unit ended up under the buttons.
  blockCompact: { minWidth: 0 },
  right: { alignItems: "flex-end" },
  label: {
    color: colors.subtle,
    fontSize: 14,
    fontFamily: font.semibold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
  rowRight: { justifyContent: "flex-end" },
  value: {
    color: colors.text,
    fontSize: 38,
    fontFamily: font.semibold,
    letterSpacing: -0.9,
    fontVariant: ["tabular-nums"],
  },
  large: { fontSize: 103, fontFamily: font.bold, letterSpacing: -1.8, lineHeight: 106 },
  // No family here on purpose: these only narrow the base style, and naming
  // one would quietly drop the weight it inherits from it.
  valueCompact: { fontSize: 23, letterSpacing: -0.4 },
  labelCompact: { fontSize: 12, letterSpacing: 0.9 },
  unitCompact: { fontSize: 14 },
  unit: { color: colors.subtle, fontSize: 16, fontFamily: font.semibold },
  unitLarge: { fontSize: 24 },
});
