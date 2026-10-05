import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";

const strings = defineStrings({
  fr: {
    title: "Lecture impossible",
    detail: "Tes données sont toujours là, le téléphone n'a simplement pas pu les lire à l'instant.",
    retry: "Réessayer",
  },
  en: {
    title: "Couldn't read this",
    detail: "Your data is still there; the phone simply couldn't read it just now.",
    retry: "Try again",
  },
});

interface Props {
  onRetry: () => void;
}

/**
 * What a page shows when reading what it is about failed.
 *
 * Never the empty state: a history that failed to load is not an empty
 * history, and offering "Get started" to somebody with a hundred runs is how
 * they end up importing them all a second time.
 */
export function LoadError({ onRetry }: Props) {
  const s = useStrings(strings);
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={22} color={colors.muted} />
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.detail}>{s.detail}</Text>
      <Button label={s.retry} variant="secondary" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 20, paddingVertical: 28, alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3, textAlign: "center" },
  detail: { color: colors.muted, fontSize: 15, fontFamily: font.regular, textAlign: "center", maxWidth: 320 },
  button: { alignSelf: "stretch", marginTop: 8 },
});
