import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

export interface Choice<T> {
  value: T;
  label: string;
  detail?: string;
}

interface Props<T> {
  visible: boolean;
  title: string;
  choices: Choice<T>[];
  selected: T;
  onChoose: (value: T) => void;
  onClose: () => void;
}

/**
 * One answer out of a short list, in a centred sheet: which pair a run was
 * run in, what kind of run it was.
 *
 * The chosen one carries a tick, as on a settings page; a tap chooses and
 * closes, and a tap outside closes without choosing.
 */
export function ChoiceSheet<T>({ visible, title, choices, selected, onChoose, onClose }: Props<T>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stops a tap inside the sheet from closing it. */}
        <Pressable onPress={() => undefined} style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {choices.map((choice, index) => {
              const on = choice.value === selected;
              return (
                <Pressable
                  key={String(choice.value)}
                  onPress={() => {
                    onChoose(choice.value);
                    onClose();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.row, index > 0 && styles.rule, pressed && styles.pressed]}
                >
                  <View style={styles.text}>
                    <Text style={[styles.label, on && styles.labelOn]}>{choice.label}</Text>
                    {choice.detail ? <Text style={styles.detail}>{choice.detail}</Text> : null}
                  </View>
                  {on ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.scrim,
    alignItems: "center", justifyContent: "center", padding: 22,
  },
  sheet: {
    width: "100%", maxWidth: 380, borderRadius: 18, padding: 20, gap: 8,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3 },
  list: { maxHeight: 420 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  pressed: { opacity: 0.55 },
  text: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 17, fontFamily: font.semibold },
  labelOn: { color: colors.accent },
  detail: { color: colors.muted, fontSize: 13.5, fontFamily: font.regular },
});
