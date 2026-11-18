import { StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

export interface Figure {
  value: string;
  unit?: string;
  label: string;
}

interface Props {
  figures: Figure[];
  /** `stage` on the stage's blue, `glass` there with a glass ground, `page` on a panel or the page. */
  tone: "stage" | "glass" | "page";
}

/**
 * A row of figures split by rules: value large, unit small beside it, label
 * in capitals under it. The landing page's spec bar, on the phone.
 *
 * Two to a row past two figures, so four stay legible on a phone's width.
 */
export function Figures({ figures, tone }: Props) {
  const glass = tone === "glass" || tone === "stage";
  const wide = figures.length > 2;
  return (
    <View style={[styles.row, tone === "glass" && styles.glass, tone === "stage" && styles.stage]}>
      {figures.map((figure, index) => (
        <View
          key={figure.label}
          style={[
            styles.cell,
            wide && styles.half,
            index % (wide ? 2 : figures.length) !== 0 && [styles.ruled, glass && styles.ruledGlass],
          ]}
          accessible
          accessibilityLabel={`${figure.label}, ${figure.value}${figure.unit ? ` ${figure.unit}` : ""}`}
        >
          <Text style={[styles.value, glass && styles.onStage]} numberOfLines={1} adjustsFontSizeToFit>
            {figure.value}
            {figure.unit ? <Text style={[styles.unit, glass && styles.unitGlass]}> {figure.unit}</Text> : null}
          </Text>
          <Text style={[styles.label, glass && styles.labelGlass]} numberOfLines={1}>{figure.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  glass: {
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 2,
    backgroundColor: colors.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassRule,
  },
  cell: { flex: 1, minWidth: 0, paddingHorizontal: 14, gap: 1 },
  half: { flexBasis: "50%", flexGrow: 0 },
  stage: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassRule, paddingTop: 10 },
  ruled: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.hairline },
  ruledGlass: { borderLeftColor: colors.glassRule },
  value: {
    color: colors.text, fontSize: 22, fontFamily: font.semibold, letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  onStage: { color: colors.onStage },
  unit: { color: colors.subtle, fontSize: 13, fontFamily: font.medium, letterSpacing: 0 },
  unitGlass: { color: colors.onStage, opacity: 0.7 },
  label: {
    color: colors.subtle, fontSize: 10.5, fontFamily: font.semibold, letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  labelGlass: { color: colors.onStage, opacity: 0.65 },
});
