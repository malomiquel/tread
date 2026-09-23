import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { RunButtonText } from "@/components/RunButtonText";
import { defineStrings, useStrings } from "@/lib/i18n";
import { colors, font } from "@/lib/theme";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

export interface EmptyAction {
  icon: Icon;
  title: string;
  /** One line saying what happens, so the card can be chosen without trying it. */
  detail: string;
  onPress: () => void;
  /** The one thing most people came to do: filled with the app's colour. */
  primary?: boolean;
  /** Working: the card shows a spinner and ignores further taps. */
  busy?: boolean;
}

const emptyStrings = defineStrings({
  fr: { start: "Pour commencer" },
  en: { start: "Get started" },
});

interface Props {
  actions: EmptyAction[];
  /** A closing line, which may point at the run button with `RUN_BUTTON`. */
  note?: string;
}

/**
 * What a tab shows while it has nothing to list.
 *
 * A rule under the page's title, then the ways forward under their own
 * label, as cards that say what each one does. The same shape on every empty
 * page, so an empty plan, an empty history and no routes read as one app
 * asking one question: where would you like to start? The tab's title and the
 * cards' own words already say what is missing; a sentence repeating it only
 * pushed the cards around.
 */
export function EmptyState({ actions, note }: Props) {
  const s = useStrings(emptyStrings);
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{s.start}</Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            key={action.title}
            onPress={action.onPress}
            disabled={action.busy}
            accessibilityRole="button"
            accessibilityState={{ busy: Boolean(action.busy) }}
            style={({ pressed }) => [
              styles.card, action.primary && styles.cardPrimary, pressed && styles.pressed,
            ]}
          >
            {action.busy ? (
              <ActivityIndicator color={action.primary ? colors.accentText : colors.accent} />
            ) : (
              <Ionicons name={action.icon} size={22} color={action.primary ? colors.accentText : colors.accent} />
            )}
            <View style={styles.body}>
              <Text style={[styles.title, action.primary && styles.onPrimary]} numberOfLines={1}>
                {action.title}
              </Text>
              <Text style={[styles.detail, action.primary && styles.detailOnPrimary]} numberOfLines={2}>
                {action.detail}
              </Text>
            </View>
            {action.primary ? null : <Ionicons name="chevron-forward" size={18} color={colors.subtle} />}
          </Pressable>
        ))}
      </View>
      {note ? <RunButtonText style={styles.note}>{note}</RunButtonText> : null}
    </View>
  );
}

const GUTTER = 20;
const DETAIL_LINE = 20;

const styles = StyleSheet.create({
  // The rule is what separates the page's title from what the page holds.
  block: {
    paddingHorizontal: GUTTER, paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  label: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.semibold,
    letterSpacing: 1.3, textTransform: "uppercase",
  },
  actions: { marginTop: 10, gap: 12 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 12, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  cardPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3 },
  onPrimary: { color: colors.accentText },
  detail: {
    color: colors.muted, fontSize: 14.5, fontFamily: font.regular,
    lineHeight: DETAIL_LINE, minHeight: DETAIL_LINE * 2,
  },
  detailOnPrimary: { color: colors.accentText, opacity: 0.85 },
  note: {
    color: colors.subtle, fontSize: 13.5, fontFamily: font.regular, lineHeight: 19, marginTop: 18,
  },
});
