import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassPanel } from "@/components/GlassPanel";
import { formatPace } from "@/lib/format";
import { clampTarget, TARGET_MAX_S, TARGET_MIN_S, TARGET_STEP_S } from "@/lib/pace";
import { setTargetPace, useSettings } from "@/lib/settings";
import { colors, floatingShadow, font } from "@/lib/theme";
import { SESSIONS, sessionMinutes, stepLabel, type Session } from "@/lib/workout";

interface Props {
  visible: boolean;
  /** The session currently chosen, or null for a free run. */
  chosen: string | null;
  onChoose: (id: string | null) => void;
  onClose: () => void;
}

/** A line describing what a session is made of, without listing every block. */
function summary(session: Session): string {
  const efforts = session.steps.filter((s) => s.effort === "rapide" || s.effort === "allure");
  const core = efforts.length ? stepLabel(efforts[0]) : stepLabel(session.steps[0]);
  const repeats = efforts.length > 1 ? `${efforts.length} × ` : "";
  return `${repeats}${core} · environ ${sessionMinutes(session)} min`;
}

/**
 * The pace to hold, stepped five seconds at a time.
 *
 * Stepped rather than typed: a pace is chosen by feel, adjusted from the last
 * one, and nobody knows to the second what they want before they start. The
 * dash clears it, because running free has to be as easy to choose as running
 * to a number.
 */
function TargetPace() {
  const { targetPaceSKm } = useSettings();

  const step = (by: number) => {
    const from = targetPaceSKm ?? 5 * 60 + 30;
    void setTargetPace(clampTarget(from + by));
  };

  return (
    <View style={styles.pace}>
      <View style={styles.rowText}>
        <Text style={[styles.name, targetPaceSKm !== null && styles.nameOn]}>Allure cible</Text>
        <Text style={styles.detail}>
          {targetPaceSKm === null ? "Aucune, course libre" : "Annoncée dès huit secondes d'écart"}
        </Text>
      </View>

      <View style={styles.stepper}>
        <Pressable
          onPress={() => void setTargetPace(null)}
          accessibilityRole="button"
          accessibilityLabel="Aucune allure cible"
          hitSlop={8}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Text style={styles.stepSign}>—</Text>
        </Pressable>
        <Pressable
          onPress={() => step(-TARGET_STEP_S)}
          disabled={targetPaceSKm === TARGET_MIN_S}
          accessibilityRole="button"
          accessibilityLabel="Allure plus rapide"
          hitSlop={8}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Ionicons name="remove" size={19} color={colors.text} />
        </Pressable>
        <Text style={styles.paceValue}>
          {targetPaceSKm === null ? "–'––\"" : formatPace(targetPaceSKm)}
        </Text>
        <Pressable
          onPress={() => step(TARGET_STEP_S)}
          disabled={targetPaceSKm === TARGET_MAX_S}
          accessibilityRole="button"
          accessibilityLabel="Allure plus lente"
          hitSlop={8}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={19} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The session chooser, opened before a run.
 *
 * Only between runs, because a session is a plan and a plan changed halfway
 * through is not the plan you ran. The free run sits at the top of the list
 * rather than being the absence of a choice, so that stopping following a
 * session is as explicit as starting to.
 */
export function SessionPicker({ visible, chosen, onChoose, onClose }: Props) {
  const row = (id: string | null, titre: string, detail: string) => {
    const selected = chosen === id;
    return (
      <Pressable
        key={id ?? "libre"}
        onPress={() => {
          onChoose(id);
          onClose();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: selected }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.name, selected && styles.nameOn]}>{titre}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stops a tap inside the sheet from closing it. */}
        <Pressable onPress={() => undefined} style={styles.sheet}>
          <GlassPanel style={styles.panel}>
            <Text style={styles.title}>Séance</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {row(null, "Course libre", "Aucun bloc, aucune annonce")}
              {SESSIONS.map((s) => row(s.id, s.name, summary(s)))}
            </ScrollView>
            <TargetPace />
          </GlassPanel>
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
  sheet: { width: "100%", maxWidth: 380, ...floatingShadow },
  panel: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  title: {
    color: colors.subtle, fontSize: 11, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  list: { maxHeight: 380 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  pressed: { opacity: 0.55 },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 17, fontFamily: font.semibold, letterSpacing: -0.2 },
  nameOn: { color: colors.accent },
  detail: { color: colors.muted, fontSize: 13.5, fontFamily: font.regular },

  pace: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  stepButton: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  stepSign: { color: colors.subtle, fontSize: 17, fontFamily: font.semibold },
  paceValue: {
    color: colors.text, fontSize: 19, fontFamily: font.semibold,
    minWidth: 62, textAlign: "center", fontVariant: ["tabular-nums"],
  },
});
