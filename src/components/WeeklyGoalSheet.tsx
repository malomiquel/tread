import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { HoldButton } from "@/components/HoldButton";
import { Segmented } from "@/components/Segmented";
import {
  GOAL_KINDS, GOAL_MAX, GOAL_START, goalAmount, goalKindName, goalStep, type GoalKind,
} from "@/lib/goals";
import { defineStrings, useStrings } from "@/lib/i18n";
import { setGoal, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";

const weeklyGoalStrings = defineStrings({
  fr: {
    title: "Objectif hebdomadaire",
    lede: {
      distance: "La distance à couvrir du lundi au dimanche.",
      time: "Le temps à courir du lundi au dimanche, quelle que soit l'allure : pour le trail, ou pour reprendre.",
      climb: "Le dénivelé à grimper du lundi au dimanche, pour préparer la montagne.",
    } as Record<GoalKind, string>,
    decrease: "Diminuer l'objectif",
    increase: "Augmenter l'objectif",
    perWeek: "par semaine",
    cancel: "Annuler",
    keep: "Garder",
    remove: "Retirer l'objectif",
  },
  en: {
    title: "Weekly goal",
    lede: {
      distance: "The distance to cover from Monday to Sunday.",
      time: "The time to run from Monday to Sunday, whatever the pace: for trails, or for getting back into it.",
      climb: "The climb to cover from Monday to Sunday, to get ready for the mountains.",
    },
    decrease: "Lower the goal",
    increase: "Raise the goal",
    perWeek: "per week",
    cancel: "Cancel",
    keep: "Keep",
    remove: "Remove the goal",
  },
});

interface Props {
  visible: boolean;
  /** What to offer somebody who has never set a distance: their own recent average. */
  suggestedM: number;
  onClose: () => void;
}

/**
 * Choosing the week's goal: a distance, a time or a climb.
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
export function WeeklyGoalSheet({ visible, suggestedM, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* The body exists only while the sheet is open, which is what lets the
          draft below start from the goal rather than being pushed back to it
          every time the sheet reopens. A modal keeps its children alive when
          it closes, and a stale draft would come back with it. */}
      {visible ? <Sheet suggestedM={suggestedM} onClose={onClose} /> : null}
    </Modal>
  );
}

function Sheet({ suggestedM, onClose }: Omit<Props, "visible">) {
  const s = useStrings(weeklyGoalStrings);
  const settings = useSettings();
  const stored: Record<GoalKind, number | null> = {
    distance: settings.weeklyGoalM, time: settings.weeklyGoalS, climb: settings.weeklyGoalClimbM,
  };
  const [kind, setKind] = useState<GoalKind>(settings.goalKind);
  // One draft per measure, each starting where that measure was left, so
  // switching back and forth loses nothing.
  const [drafts, setDrafts] = useState<Record<GoalKind, number>>(() => ({
    distance: stored.distance ?? suggestedM,
    time: stored.time ?? GOAL_START.time,
    climb: stored.climb ?? GOAL_START.climb,
  }));
  const draft = drafts[kind];
  const step = goalStep(kind);
  const hasGoal = stored[settings.goalKind] !== null;

  const move = (by: number) =>
    setDrafts((held) => ({ ...held, [kind]: Math.min(GOAL_MAX[kind], Math.max(step, held[kind] + by)) }));

  async function keep(value: number | null) {
    onClose();
    await setGoal(value === null ? settings.goalKind : kind, value).catch(() => undefined);
  }

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      {/* Stops a tap inside the sheet from closing it. */}
      <Pressable onPress={() => undefined} style={styles.sheet}>
        <Text style={styles.title}>{s.title}</Text>
        <Segmented
          options={GOAL_KINDS.map((option) => ({ value: option, label: goalKindName(option) }))}
          value={kind}
          onChange={setKind}
        />
        <Text style={styles.lede}>{s.lede[kind]}</Text>

        <View style={styles.stepper}>
          <HoldButton
            onStep={() => move(-step)}
            label="−"
            accessibilityLabel={s.decrease}
            disabled={draft <= step}
          />
          <View style={styles.value}>
            <Text style={styles.number} adjustsFontSizeToFit numberOfLines={1}>{goalAmount(kind, draft)}</Text>
            <Text style={styles.unit}>{s.perWeek}</Text>
          </View>
          <HoldButton
            onStep={() => move(step)}
            label="+"
            accessibilityLabel={s.increase}
            disabled={draft >= GOAL_MAX[kind]}
          />
        </View>

        <View style={styles.actions}>
          <Button label={s.cancel} variant="secondary" onPress={onClose} />
          <Button label={s.keep} onPress={() => void keep(draft)} />
        </View>

        {hasGoal ? (
          <Pressable
            onPress={() => void keep(null)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.drop, pressed && styles.dropPressed]}
          >
            <Text style={styles.dropLabel}>{s.remove}</Text>
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
    color: colors.text, fontSize: 38, fontFamily: font.bold,
    letterSpacing: -1, fontVariant: ["tabular-nums"], lineHeight: 50,
  },
  unit: { color: colors.subtle, fontSize: 13.5, fontFamily: font.regular },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  drop: { alignItems: "center", paddingTop: 2 },
  dropPressed: { opacity: 0.6 },
  dropLabel: { color: colors.danger, fontSize: 14.5, fontFamily: font.semibold },
});
