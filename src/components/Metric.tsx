import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

interface Props {
  label: string;
  value: string;
  unit?: string;
  /** Hero treatment: the one figure you read mid-stride. */
  large?: boolean;
}

/** A single measurement with its label. Tabular figures so nothing jumps. */
export function Metric({ label, value, unit, large }: Props) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, large && styles.large]}>{value}</Text>
        {unit ? <Text style={[styles.unit, large && styles.unitLarge]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, minWidth: 96 },
  label: {
    color: colors.subtle,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 3 },
  value: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  large: { fontSize: 52, fontWeight: "800", letterSpacing: -2.5, lineHeight: 56 },
  unit: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  unitLarge: { fontSize: 16 },
});
