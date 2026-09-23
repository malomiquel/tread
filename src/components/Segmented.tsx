import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font } from "@/lib/theme";

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Two or three ways of seeing the same thing, side by side: the history as
 * a list or as a calendar. The one showing is filled, the others are words
 * on the page's grey.
 */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
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
            style={[styles.segment, on && styles.segmentOn]}
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
  segmentOn: { backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 14.5, fontFamily: font.medium },
  labelOn: { color: colors.text, fontFamily: font.semibold },
});
