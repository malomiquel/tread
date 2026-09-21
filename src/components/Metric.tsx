import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

interface Props {
  label: string;
  value: string;
  unit?: string;
  /** Hero treatment: the one figure you read mid-stride. */
  large?: boolean;
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
export function Metric({ label, value, unit, large, align = "left" }: Props) {
  return (
    <View style={[styles.block, align === "right" && styles.right]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, align === "right" && styles.rowRight]}>
        <Text style={[styles.value, large && styles.large]}>{value}</Text>
        {unit ? <Text style={[styles.unit, large && styles.unitLarge]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, minWidth: 92 },
  right: { alignItems: "flex-end" },
  label: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
  rowRight: { justifyContent: "flex-end" },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -0.9,
    fontVariant: ["tabular-nums"],
  },
  large: { fontSize: 76, fontWeight: "700", letterSpacing: -4, lineHeight: 78 },
  unit: { color: colors.subtle, fontSize: 12, fontWeight: "600" },
  unitLarge: { fontSize: 18 },
});
