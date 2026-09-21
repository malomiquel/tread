import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassPanel } from "@/components/GlassPanel";
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
  const rapides = session.steps.filter((s) => s.effort === "rapide" || s.effort === "allure");
  const coeur = rapides.length ? stepLabel(rapides[0]) : stepLabel(session.steps[0]);
  const repetitions = rapides.length > 1 ? `${rapides.length} × ` : "";
  return `${repetitions}${coeur} · environ ${sessionMinutes(session)} min`;
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
  const ligne = (id: string | null, titre: string, detail: string) => {
    const actif = chosen === id;
    return (
      <Pressable
        key={id ?? "libre"}
        onPress={() => {
          onChoose(id);
          onClose();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: actif }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.name, actif && styles.nameOn]}>{titre}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        {actif && <Ionicons name="checkmark" size={20} color={colors.accent} />}
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
              {ligne(null, "Course libre", "Aucun bloc, aucune annonce")}
              {SESSIONS.map((s) => ligne(s.id, s.name, summary(s)))}
            </ScrollView>
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
});
