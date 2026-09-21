import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GlassPanel } from "@/components/GlassPanel";
import { formatPace } from "@/lib/format";
import { colors, floatingShadow, font } from "@/lib/theme";
import { groupLabel, groupSteps, sessionMinutes, type Session } from "@/lib/workout";

interface Props {
  visible: boolean;
  session: Session | null;
  /** The block under way, when a run is following the session. */
  currentIndex?: number | null;
  /** The pace to hold, when the session came from a programme. */
  targetSKm?: number | null;
  /** Offered only where the session can actually be started. */
  onStart?: () => void;
  /** Offered where the proposal can be turned down in favour of running free. */
  onFree?: () => void;
  onClose: () => void;
}

/** Where each folded group begins and ends in the flat list of blocks. */
function spans(session: Session): { label: string; from: number; to: number }[] {
  let at = 0;
  return groupSteps(session.steps).map((group) => {
    const length = group.times * group.steps.length;
    const span = { label: groupLabel(group), from: at, to: at + length - 1 };
    at += length;
    return span;
  });
}

/**
 * What a session actually asks of you, block by block.
 *
 * "Quatre blocs" told a runner the size of the thing and nothing about its
 * shape, which is the one question worth answering before starting: how long
 * is the warm-up, how many repetitions, how much recovery between them.
 *
 * The same sheet serves before a run and during one. Mid-session it marks the
 * block under way, because the useful question changes from what am I about
 * to do into how much of this is left.
 */
export function SessionDetail({
  visible, session, currentIndex = null, targetSKm = null, onStart, onFree, onClose,
}: Props) {
  if (!session) return null;
  const groups = spans(session);
  const running = currentIndex !== null;
  const over = running && currentIndex >= session.steps.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stops a tap inside the sheet from closing it. */}
        <Pressable onPress={() => undefined} style={styles.sheet}>
          <GlassPanel style={styles.panel}>
            <Text style={styles.kicker}>Séance</Text>
            <Text style={styles.name}>{session.name}</Text>
            <Text style={styles.detail}>
              {session.steps.length} bloc{session.steps.length > 1 ? "s" : ""} · environ{" "}
              {sessionMinutes(session)} min
              {targetSKm !== null ? ` · ${formatPace(targetSKm)}` : ""}
            </Text>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {groups.map((group) => {
                const current = running && !over
                  && currentIndex >= group.from && currentIndex <= group.to;
                const past = running && currentIndex > group.to;
                return (
                  <View key={group.from} style={[styles.block, current && styles.blockCurrent]}>
                    <View style={[styles.mark, (current || past) && styles.markFilled]}>
                      {past ? (
                        <Ionicons name="checkmark" size={13} color={colors.accentText} />
                      ) : (
                        <Text style={[styles.markLabel, current && styles.markLabelCurrent]}>
                          {group.from + 1}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.blockLabel,
                        current && styles.blockCurrentLabel,
                        past && styles.blockPast,
                      ]}
                    >
                      {group.label}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* The figure above is an estimate and says so: a distance block
                takes as long as it takes. It exists to tell a twenty minute
                session from an hour long one, not to be relied upon. */}
            <Text style={styles.note}>
              {running
                ? "Un bloc mesuré en distance finit quand la distance est faite, pas au bout d'un temps."
                : "Durée estimée : les blocs en distance dépendent de ton allure réelle."}
            </Text>

            {onStart ? (
              <Pressable
                onPress={onStart}
                accessibilityRole="button"
                style={({ pressed }) => [styles.start, pressed && styles.pressed]}
              >
                <Ionicons name="play" size={17} color={colors.accentText} />
                <Text style={styles.startLabel}>Démarrer cette séance</Text>
              </Pressable>
            ) : null}

            {/* Declining has to be as easy as accepting. A programme you can
                only obey is one people leave rather than argue with, and a
                run outside it is still a run. */}
            {onFree ? (
              <Pressable
                onPress={onFree}
                accessibilityRole="button"
                style={({ pressed }) => [styles.free, pressed && styles.pressed]}
              >
                <Text style={styles.freeLabel}>Courir sans séance</Text>
              </Pressable>
            ) : null}
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
  panel: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, gap: 4 },

  kicker: {
    color: colors.subtle, fontSize: 11, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  name: { color: colors.text, fontSize: 23, fontFamily: font.bold, letterSpacing: -0.4 },
  detail: {
    color: colors.muted, fontSize: 14, fontFamily: font.regular,
    fontVariant: ["tabular-nums"], marginBottom: 6,
  },

  list: { maxHeight: 320 },
  block: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8,
  },
  blockCurrent: { backgroundColor: colors.accentSoft },
  mark: {
    width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.sunken,
  },
  markFilled: { backgroundColor: colors.accent },
  markLabel: {
    color: colors.subtle, fontSize: 12, fontFamily: font.semibold,
    fontVariant: ["tabular-nums"],
  },
  markLabelCurrent: { color: colors.accentText },
  blockLabel: { flex: 1, color: colors.text, fontSize: 15.5, fontFamily: font.medium },
  blockCurrentLabel: { fontFamily: font.semibold },
  blockPast: { color: colors.subtle },

  note: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.regular,
    lineHeight: 17, marginTop: 8,
  },

  start: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, borderRadius: 10, paddingVertical: 13, backgroundColor: colors.accent,
  },
  startLabel: { color: colors.accentText, fontSize: 16, fontFamily: font.semibold },
  free: { alignItems: "center", paddingTop: 12, paddingBottom: 2 },
  freeLabel: { color: colors.muted, fontSize: 14.5, fontFamily: font.semibold },
  pressed: { opacity: 0.85 },
});
