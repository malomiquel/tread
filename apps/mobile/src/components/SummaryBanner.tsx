import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "@tread/core/palette";
import type { Figure } from "@/components/Figures";
import { PANEL_INSET } from "@/components/Panel";
import { PressableScale } from "@/components/PressableScale";
import { colors, font } from "@/lib/theme";

interface Props {
  /** What the figure is about: "Ce mois-ci", "Cette semaine". */
  label: string;
  value: string;
  unit?: string;
  /** The line under the figure. */
  detail?: string;
  /** Anything after it: a goal, a tag. Drawn on the stage. */
  children?: React.ReactNode;
  /** The figures that go with the lead one, small, at its right. */
  figures?: Figure[];
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * The one figure a tab leads with, on the cobalt stage of the landing page:
 * lit from the top right, the same in both appearances, white on it.
 *
 * Compact on purpose: one row holds the figure and, at its right, the two or
 * three that go with it, so the stage leads the page without filling it.
 * The history opens on its month, the profile on its week: both the same.
 */
export function SummaryBanner({
  label, value, unit, detail, children, figures, onPress, accessibilityLabel,
}: Props) {
  const body = (
    <>
      <LinearGradient
        colors={[palette.stageGlow.light, palette.stage.light, palette.stage.light]}
        locations={[0, 0.6, 1]}
        start={{ x: 1.1, y: -0.3 }}
        end={{ x: 0.2, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <View style={styles.lead}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {value}
            {unit ? <Text style={styles.unit}> {unit}</Text> : null}
          </Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        {figures && figures.length > 0 ? (
          <View style={styles.side}>
            {figures.map((figure) => (
              <View key={figure.label} style={styles.figure} accessible accessibilityLabel={`${figure.label}, ${figure.value}`}>
                <Text style={styles.figureValue} numberOfLines={1}>
                  {figure.value}
                  {figure.unit ? <Text style={styles.figureUnit}> {figure.unit}</Text> : null}
                </Text>
                <Text style={styles.figureLabel} numberOfLines={1}>{figure.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {children}
    </>
  );

  if (!onPress) return <View style={styles.banner}>{body}</View>;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.banner}
    >
      {body}
    </PressableScale>
  );
}

/** A small rounded tag on the banner, for a comparison or an invitation. */
export function BannerTag({ children }: { children: React.ReactNode }) {
  return <View style={styles.tag}>{children}</View>;
}

/** Text set on the stage. */
export const bannerText = StyleSheet.create({
  tag: { color: colors.onStage, fontSize: 13, fontFamily: font.medium },
  soft: {
    color: colors.onStage, opacity: 0.85, fontSize: 13.5, fontFamily: font.medium,
    fontVariant: ["tabular-nums"],
  },
});

/** The goal's track and fill, drawn on the stage. */
export const bannerGoal = StyleSheet.create({
  track: { height: 3, borderRadius: 1.5, overflow: "hidden", backgroundColor: "rgba(255, 255, 255, 0.22)" },
  fill: { height: 3, borderRadius: 1.5, backgroundColor: colors.onStage },
});

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: PANEL_INSET, marginBottom: 4, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderRadius: 20, overflow: "hidden", backgroundColor: colors.stage,
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  lead: { flex: 1, minWidth: 0 },
  label: {
    color: colors.onStage, opacity: 0.75, fontSize: 11, fontFamily: font.semibold,
    letterSpacing: 1.6, textTransform: "uppercase",
  },
  value: {
    color: colors.onStage, fontSize: 38, fontFamily: font.bold, letterSpacing: -1.1,
    fontVariant: ["tabular-nums"], lineHeight: 42,
  },
  unit: { fontSize: 17, fontFamily: font.semibold, letterSpacing: -0.2, color: colors.stageGlow },
  detail: {
    color: colors.onStage, opacity: 0.85, fontSize: 14, fontFamily: font.regular,
    fontVariant: ["tabular-nums"],
  },
  side: { flexDirection: "row", gap: 14, paddingBottom: 4 },
  figure: { alignItems: "flex-end" },
  figureValue: {
    color: colors.onStage, fontSize: 18, fontFamily: font.semibold, letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  figureUnit: { fontSize: 12, opacity: 0.7 },
  figureLabel: {
    color: colors.onStage, opacity: 0.65, fontSize: 9.5, fontFamily: font.semibold,
    letterSpacing: 1.1, textTransform: "uppercase",
  },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
