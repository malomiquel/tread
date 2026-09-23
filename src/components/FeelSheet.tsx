import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { defineStrings, useStrings } from "@/lib/i18n";
import { exertionName, type Exertion } from "@/lib/plan";
import { colors, font } from "@/lib/theme";

const feelStrings = defineStrings({
  fr: {
    title: "Comment c'était ?",
    lede: "Ton ressenti ajuste le programme : deux séances dures d'affilée, et les suivantes s'allègent.",
    later: "Plus tard",
  },
  en: {
    title: "How did it feel?",
    lede: "How it felt shapes your plan: two hard sessions in a row, and the next ones get lighter.",
    later: "Later",
  },
});

interface Props {
  visible: boolean;
  onChoose: (level: Exertion) => void;
  /** Answered later, from the run's own page. */
  onLater: () => void;
}

const LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * The one question asked when a run ends.
 *
 * It used to sit halfway down the run's page while the button to close the
 * run stayed greyed out at the bottom, waiting on it — a disabled button with
 * its reason somewhere above the fold, which is how people end up thinking
 * the app has frozen. Asked first, on its own, it is answered in one tap.
 *
 * "Plus tard" is a real answer: the programme copes without it, and the page
 * keeps the same scale for whenever they come back to it.
 */
export function FeelSheet({ visible, onChoose, onLater }: Props) {
  const s = useStrings(feelStrings);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.lede}>{s.lede}</Text>

          <View style={styles.levels}>
            {LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => onChoose(level)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.level, pressed && styles.pressed]}
              >
                <Text style={styles.levelNumber}>{level}</Text>
                <Text style={styles.levelName}>{exertionName(level)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onLater} accessibilityRole="button" hitSlop={8} style={styles.later}>
            <Text style={styles.laterLabel}>{s.later}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheet: {
    width: "100%", maxWidth: 380, borderRadius: 18, padding: 22, gap: 14,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 24, fontFamily: font.bold, letterSpacing: -0.4 },
  lede: { color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  levels: { gap: 8 },
  level: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.accentSoft },
  levelNumber: {
    color: colors.accent, fontSize: 20, fontFamily: font.bold,
    width: 18, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  levelName: { color: colors.text, fontSize: 17, fontFamily: font.semibold },
  later: { alignItems: "center", paddingTop: 2 },
  laterLabel: { color: colors.subtle, fontSize: 15, fontFamily: font.semibold },
});
