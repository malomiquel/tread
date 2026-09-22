import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { HoldButton } from "@/components/HoldButton";
import { formatDistance } from "@/lib/format";
import { setWeeklyGoal } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

/** One kilometre a tap, which is the smallest change worth making to a week. */
const STEP_M = 1000;
const LOWEST_M = 1000;
const HIGHEST_M = 300_000;

interface Props {
  visible: boolean;
  /** The goal as it stands, in metres, or null when there is none. */
  goalM: number | null;
  /** What to offer somebody who has never set one: their own recent average. */
  suggestedM: number;
  onClose: () => void;
}

/**
 * Choosing the week's distance.
 *
 * A stepper rather than a list of round numbers, because the useful goal is
 * rarely a round number: it is usually a little more than what you already
 * run, and only the runner knows how much more. It opens on their own recent
 * average so that the first thing they see is a figure they recognise and can
 * nudge, rather than a blank to fill.
 *
 * Dropping the goal is offered as plainly as setting one. A target somebody
 * has outgrown, or set on an optimistic evening, must be as easy to put down
 * as it was to pick up.
 */
export function WeeklyGoalSheet({ visible, goalM, suggestedM, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The body exists only while the sheet is open, which is what lets the
          draft below start from the goal rather than being pushed back to it
          every time the sheet reopens. A modal keeps its children alive when
          it closes, and a stale draft would come back with it. */}
      {visible ? <Sheet goalM={goalM} suggestedM={suggestedM} onClose={onClose} /> : null}
    </Modal>
  );
}

function Sheet({ goalM, suggestedM, onClose }: Omit<Props, "visible">) {
  const [draft, setDraft] = useState(goalM ?? suggestedM);

  const move = (by: number) =>
    setDraft((metres) => Math.min(HIGHEST_M, Math.max(LOWEST_M, metres + by)));

  async function keep(metres: number | null) {
    onClose();
    await setWeeklyGoal(metres).catch(() => undefined);
  }

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      {/* Stops a tap inside the sheet from closing it. */}
      <Pressable onPress={() => undefined} style={styles.sheet}>
        <Text style={styles.title}>Objectif hebdomadaire</Text>
        <Text style={styles.lede}>
          La distance à couvrir du lundi au dimanche. Elle n&apos;est comparée à rien
          d&apos;autre qu&apos;à elle-même.
        </Text>

        <View style={styles.stepper}>
          <HoldButton
            onStep={() => move(-STEP_M)}
            label="−"
            accessibilityLabel="Diminuer l'objectif d'un kilomètre"
            disabled={draft <= LOWEST_M}
          />
          <View style={styles.value}>
            <Text style={styles.number}>{formatDistance(draft)}</Text>
            <Text style={styles.unit}>km par semaine</Text>
          </View>
          <HoldButton
            onStep={() => move(STEP_M)}
            label="+"
            accessibilityLabel="Augmenter l'objectif d'un kilomètre"
            disabled={draft >= HIGHEST_M}
          />
        </View>

        <View style={styles.actions}>
          <Button label="Annuler" variant="secondary" onPress={onClose} />
          <Button label="Garder" onPress={() => void keep(draft)} />
        </View>

        {goalM !== null ? (
          <Pressable
            onPress={() => void keep(null)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.drop, pressed && styles.dropPressed]}
          >
            <Text style={styles.dropLabel}>Retirer l&apos;objectif</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Pressable>
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
  stepper: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 6 },
  value: { flex: 1, alignItems: "center" },
  number: {
    color: colors.text, fontSize: 44, fontFamily: font.bold,
    letterSpacing: -1, fontVariant: ["tabular-nums"], lineHeight: 50,
  },
  unit: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  drop: { alignItems: "center", paddingTop: 2 },
  dropPressed: { opacity: 0.6 },
  dropLabel: { color: colors.danger, fontSize: 14.5, fontFamily: font.semibold },
});
