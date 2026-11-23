import { Pressable, StyleSheet, Text, View } from "react-native";
import { defineStrings, intlLocale, useStrings } from "@tread/core/i18n";
import { colors, font } from "@/lib/theme";

const monthStrings = defineStrings({
  fr: {
    weekdays: ["L", "M", "M", "J", "V", "S", "D"],
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
  },
  en: {
    weekdays: ["M", "T", "W", "T", "F", "S", "S"],
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },
});

/** Where a weekday falls in a grid that starts on Monday. */
const mondayIndex = (day: number): number => (day + 6) % 7;

/**
 * A month of days, as rows of seven, with the month above and arrows to
 * move through them: every date the app asks for (a plan's race, a race on
 * a route) is chosen here.
 *
 * Built rather than borrowed. A date picker is the one control that would
 * have meant a native dependency, and every native dependency in this
 * project has cost a rebuild and a round of Expo Go breakage. A month grid
 * is sixty lines and owes nothing to anybody.
 *
 * Days outside `earliest`–`latest` are greyed rather than hidden, so the
 * reason a date is unavailable stays visible.
 */
export function MonthPicker({
  month, onMonth, chosen, earliest, latest, onPick,
}: {
  /** Any day of the month shown. */
  month: Date;
  onMonth: (month: Date) => void;
  /** Midnight of the chosen day, local time. */
  chosen: number | null;
  earliest: number;
  latest: number;
  onPick: (at: number) => void;
}) {
  const s = useStrings(monthStrings);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(mondayIndex(first.getDay())).fill(null),
    ...Array.from({ length: days }, (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), i + 1).getTime()),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.monthHead}>
        <Pressable
          onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          accessibilityRole="button"
          accessibilityLabel={s.previousMonth}
          hitSlop={10}
        >
          <Text style={styles.monthArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthName}>
          {month.toLocaleDateString(intlLocale(), { month: "long" })} {month.getFullYear()}
        </Text>
        <Pressable
          onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          accessibilityRole="button"
          accessibilityLabel={s.nextMonth}
          hitSlop={10}
        >
          <Text style={styles.monthArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekdays}>
        {s.weekdays.map((letter, i) => (
          <Text key={`${letter}${i}`} style={styles.weekday}>{letter}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((at, i) => {
            if (at === null) return <View key={i} style={styles.day} />;
            const reachable = at >= earliest && at <= latest;
            const picked = chosen !== null && at === chosen;
            return (
              <Pressable
                key={i}
                onPress={() => reachable && onPick(at)}
                disabled={!reachable}
                accessibilityRole="button"
                accessibilityState={{ disabled: !reachable, selected: picked }}
                // The whole date: "14, button" says nothing about which month.
                accessibilityLabel={new Date(at).toLocaleDateString(intlLocale(), {
                  weekday: "long", day: "numeric", month: "long",
                })}
                style={[styles.day, picked && styles.dayPicked]}
              >
                <Text style={[styles.dayLabel, !reachable && styles.dayOut, picked && styles.dayPickedLabel]}>
                  {new Date(at).getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  monthHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 6,
  },
  monthName: { color: colors.text, fontSize: 17, fontFamily: font.semibold },
  monthArrow: { color: colors.accent, fontSize: 28, fontFamily: font.semibold, paddingHorizontal: 10 },
  weekdays: { flexDirection: "row", paddingBottom: 4 },
  weekday: {
    flex: 1, textAlign: "center", color: colors.subtle,
    fontSize: 12, fontFamily: font.semibold,
  },
  week: { flexDirection: "row" },
  day: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayPicked: { backgroundColor: colors.accent },
  dayLabel: { color: colors.text, fontSize: 15, fontFamily: font.regular, fontVariant: ["tabular-nums"] },
  dayOut: { color: colors.subtle, opacity: 0.35 },
  dayPickedLabel: { color: colors.accentText, fontFamily: font.semibold },
});
