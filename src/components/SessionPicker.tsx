import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassPanel } from "@/components/GlassPanel";
import { formatPace } from "@/lib/format";
import { defineStrings, useStrings } from "@/lib/i18n";
import { clampTarget, TARGET_MAX_S, TARGET_MIN_S, TARGET_STEP_S } from "@/lib/pace";
import { setTargetPace, useSettings } from "@/lib/settings";
import { colors, floatingShadow, font } from "@/lib/theme";
import {
  hasSinglePace, SESSIONS, sessionById, sessionMinutes, sessionName, stepLabel, type Session,
} from "@/lib/workout";

const sessionPickerStrings = defineStrings({
  fr: {
    about: (minutes: number) => `environ ${minutes} min`,
    targetPace: "Allure cible",
    setByBlocks: "Fixée par les blocs de la séance",
    announced: "Annoncée dès huit secondes d'écart",
    none: "Aucune, course libre",
    clearPace: "Retirer l'allure cible",
    faster: "Allure plus rapide",
    slower: "Allure plus lente",
    title: "Séance",
    freeRun: "Course libre",
    freeRunDetail: "Aucun bloc, aucune annonce",
  },
  en: {
    about: (minutes: number) => `about ${minutes} min`,
    targetPace: "Target pace",
    setByBlocks: "Set by the session's blocks",
    announced: "Announced once you drift eight seconds off",
    none: "None, free run",
    clearPace: "Clear the target pace",
    faster: "Faster pace",
    slower: "Slower pace",
    title: "Session",
    freeRun: "Free run",
    freeRunDetail: "No blocks, no announcements",
  },
});

interface Props {
  visible: boolean;
  /** The session currently chosen, or null for a free run. */
  chosen: string | null;
  onChoose: (id: string | null) => void;
  onClose: () => void;
}

/** A line describing what a session is made of, without listing every block. */
function summary(session: Session): string {
  const efforts = session.steps.filter((s) => s.effort === "fast" || s.effort === "steady");
  const core = efforts.length ? stepLabel(efforts[0]) : stepLabel(session.steps[0]);
  const repeats = efforts.length > 1 ? `${efforts.length} × ` : "";
  return `${repeats}${core} · ${sessionPickerStrings().about(sessionMinutes(session))}`;
}

/**
 * The pace to hold, stepped five seconds at a time.
 *
 * Stepped rather than typed: a pace is chosen by feel, adjusted from the last
 * one, and nobody knows to the second what they want before they start. The
 * dash clears it, because running free has to be as easy to choose as running
 * to a number.
 */
function TargetPace({ session }: { session: Session | null }) {
  const s = useStrings(sessionPickerStrings);
  const { targetPaceSKm } = useSettings();
  const set = targetPaceSKm !== null;

  const step = (by: number) => {
    const from = targetPaceSKm ?? 5 * 60 + 30;
    void setTargetPace(clampTarget(from + by));
  };

  // A session that asks for several efforts already says what each block is
  // for, and one figure across all of them would be asking a runner to sprint
  // their recovery. The row explains itself rather than disappearing, so the
  // setting is never simply missing.
  if (session && !hasSinglePace(session)) {
    return (
      <View style={styles.pace}>
        <View style={styles.rowText}>
          <Text style={styles.name}>{s.targetPace}</Text>
          <Text style={styles.detail}>{s.setByBlocks}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pace}>
      <View style={styles.rowText}>
        <Text style={[styles.name, set && styles.nameOn]}>{s.targetPace}</Text>
        <Text style={styles.detail}>
          {set ? s.announced : s.none}
        </Text>
      </View>

      <View style={styles.stepper}>
        {/* The clear button only exists once there is something to clear.
            Shown always, it sat beside the minus as a second dash and the two
            read as one control with a stutter. */}
        {set && (
          <Pressable
            onPress={() => void setTargetPace(null)}
            accessibilityRole="button"
            accessibilityLabel={s.clearPace}
            hitSlop={8}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={18} color={colors.subtle} />
          </Pressable>
        )}
        <Pressable
          onPress={() => step(-TARGET_STEP_S)}
          disabled={targetPaceSKm === TARGET_MIN_S}
          accessibilityRole="button"
          accessibilityLabel={s.faster}
          hitSlop={8}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.paceValue, !set && styles.paceEmpty]}>
          {set ? formatPace(targetPaceSKm) : "5'30\""}
        </Text>
        <Pressable
          onPress={() => step(TARGET_STEP_S)}
          disabled={targetPaceSKm === TARGET_MAX_S}
          accessibilityRole="button"
          accessibilityLabel={s.slower}
          hitSlop={8}
          style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={20} color={colors.text} />
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
  const s = useStrings(sessionPickerStrings);
  const row = (id: string | null, title: string, detail: string) => {
    const selected = chosen === id;
    return (
      <Pressable
        key={id ?? "free"}
        onPress={() => {
          onChoose(id);
          onClose();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: selected }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowText}>
          <Text style={[styles.name, selected && styles.nameOn]}>{title}</Text>
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
            <Text style={styles.title}>{s.title}</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {row(null, s.freeRun, s.freeRunDetail)}
              {SESSIONS.map((session) => row(session.id, sessionName(session), summary(session)))}
            </ScrollView>
            <TargetPace session={sessionById(chosen)} />
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
  stepper: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  // Every control in the row is an icon in a box of the same size, which is
  // what keeps them on one line: a glyph of text and an icon never sit at the
  // same height.
  stepButton: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  paceValue: {
    color: colors.text, fontSize: 19, fontFamily: font.semibold,
    minWidth: 62, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  // Greyed rather than blank: the figure shows what the first tap would pick,
  // so the stepper reads as ready rather than as broken.
  paceEmpty: { color: colors.subtle },
});
