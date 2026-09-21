import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { colors, font } from "@/lib/theme";

const ACTION_WIDTH = 92;

interface Props {
  children: ReactNode;
  /** Called when the revealed action is tapped, before anything is deleted. */
  onDelete: () => void;
  /** Spoken to a screen reader, which cannot perform the swipe. */
  label: string;
}

/**
 * Wraps a list row so it can be swiped leftwards to reveal a delete action.
 *
 * The row is not removed by a full swipe: a run cannot be recovered, and a
 * flick of the thumb is too cheap a gesture for that. Tapping the revealed
 * action asks the caller to confirm.
 */
export function SwipeToDelete({ children, onDelete, label }: Props) {
  const row = useRef<SwipeableMethods>(null);

  const renderAction = (_progress: SharedValue<number>, translation: SharedValue<number>) => (
    <Action
      translation={translation}
      label={label}
      onPress={() => {
        // Close first: if the confirmation is dismissed, the row is already
        // back in place rather than left open on an abandoned action.
        row.current?.close();
        onDelete();
      }}
    />
  );

  return (
    <ReanimatedSwipeable
      ref={row}
      friction={1.8}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={renderAction}
      containerStyle={styles.container}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function Action({
  translation, label, onPress,
}: {
  translation: SharedValue<number>;
  label: string;
  onPress: () => void;
}) {
  // The action tracks the finger exactly rather than sliding in behind the
  // row, so the button feels dragged out rather than uncovered.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.actionWrapper, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${label}`}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      >
        <Ionicons name="trash-outline" size={19} color={colors.accentText} />
        <Text style={styles.actionLabel}>Supprimer</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.danger },
  actionWrapper: { width: ACTION_WIDTH },
  action: {
    flex: 1,
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.danger,
  },
  actionPressed: { opacity: 0.75 },
  actionLabel: { color: colors.accentText, fontSize: 15, fontFamily: font.semibold },
});
