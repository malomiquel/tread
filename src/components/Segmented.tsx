import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** As wide as its words and as tall as a chip, to share a row with chips. */
  compact?: boolean;
}

/**
 * Two or three ways of seeing the same thing, side by side: the history as
 * a list or as a calendar. The one showing is filled, the others are words
 * on the page's grey.
 */
export function Segmented<T extends string>({ options, value, onChange, compact = false }: Props<T>) {
  return (
    <View style={[styles.track, compact && styles.trackCompact]} accessibilityRole="tablist">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, compact && styles.segmentCompact, on && styles.segmentOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 3, borderRadius: 10, backgroundColor: colors.sunken },
  segment: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  // 36 high in all, like a chip: 3 + 30 + 3.
  trackCompact: { borderRadius: 8 },
  segmentCompact: { flex: 0, height: 30, paddingVertical: 0, paddingHorizontal: 12, justifyContent: "center", borderRadius: 6 },
  segmentOn: { backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  labelOn: { color: colors.text, fontFamily: font.semibold },
});
