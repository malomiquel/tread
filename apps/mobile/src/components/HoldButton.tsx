import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, font } from "@/lib/theme";

/**
 * A stepper side that repeats while it is held.
 *
 * Reaching a target time thirty seconds at a time means forty taps to move
 * twenty minutes, which is how a control teaches someone to give up. Holding
 * covers the distance and tapping lands the second, so both gestures do the
 * thing they are naturally good at.
 *
 * The repeat starts slowly and quickens. A hold that accelerates immediately
 * overshoots every time, and the pause before the first repeat is also what
 * keeps a plain tap from being read as the beginning of a hold.
 */
export function HoldButton({
  onStep, label, accessibilityLabel, disabled = false,
}: {
  onStep: () => void;
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticks = useRef(0);
  /** Read by the running chain, so a re-render never leaves it on stale state. */
  const step = useRef(onStep);
  step.current = onStep;
  /**
   * The same, for whether this button still accepts a press.
   *
   * It is read by the chain rather than closed over, because the value that
   * matters is the one at the next tick and not the one when the finger
   * landed.
   */
  const off = useRef(disabled);
  off.current = disabled;

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    ticks.current = 0;
  }

  // A finger lifted outside the button, or a screen left mid-hold, would
  // otherwise leave the chain running against a component nobody can see.
  useEffect(() => stop, []);

  /**
   * Reaching the end of the range stops the repeat, and has to.
   *
   * A Pressable that becomes disabled never sends `onPressOut` — so a hold
   * that walked the value into its own limit went on repeating for ever,
   * against a button that could no longer be released. It is the one way out
   * of this chain that the finger does not control.
   */
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  function tick() {
    // Checked at every tick, not only when the finger landed: the step itself
    // is what pushes the value to the limit that disables the button.
    if (off.current) {
      stop();
      return;
    }
    ticks.current += 1;
    step.current();
    void Haptics.selectionAsync().catch(() => undefined);
    const delay = ticks.current < 6 ? 130 : ticks.current < 18 ? 70 : 40;
    timer.current = setTimeout(tick, delay);
  }

  return (
    <Pressable
      onPressIn={() => {
        if (disabled) return;
        step.current();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        timer.current = setTimeout(tick, 420);
      }}
      onPressOut={stop}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.stepOff]}
    >
      <Text style={styles.stepLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: {
    width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  stepPressed: { backgroundColor: colors.sunken },
  stepOff: { opacity: 0.35 },
  stepLabel: { color: colors.text, fontSize: 24, fontFamily: font.semibold, lineHeight: 28 },
});
