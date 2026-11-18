import { Pressable, StyleSheet, Text, View } from "react-native";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { colors, font } from "@/lib/theme";

const noMatchStrings = defineStrings({
  fr: { showAll: "Tout afficher" },
  en: { showAll: "Show all" },
});

/**
 * What a narrowed list shows when nothing is left in it: a sentence saying
 * so, and the way back to everything. Never the empty state: a filter that
 * matches nothing is not an empty history.
 */
export function NoMatch({ message, onShowAll }: { message: string; onShowAll: () => void }) {
  const s = useStrings(noMatchStrings);
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onShowAll} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.showAll}>{s.showAll}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: 8, paddingTop: 40, paddingHorizontal: 20 },
  text: { color: colors.muted, fontSize: 15.5, fontFamily: font.regular, textAlign: "center" },
  showAll: { color: colors.accent, fontSize: 15.5, fontFamily: font.semibold },
});
