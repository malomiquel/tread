import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { markScale, monthsSince, monthWeeks, runsByDay } from "@/lib/calendar";
import type { Run } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { intlLocale } from "@/lib/i18n";
import { startOfDay } from "@/lib/plan";
import { colors, font } from "@/lib/theme";
import { distanceUnit } from "@/lib/units";

interface Props {
  runs: Run[];
  /** The moment "today" is measured from. */
  now: number;
  onOpenRun: (id: number) => void;
  bottomSpace: number;
}

const CELL = 38;

/** Monday to Sunday, in the interface's language: "L M M J V S D". */
function weekdayInitials(): string[] {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), 0, 1 + i).toLocaleDateString(intlLocale(), { weekday: "narrow" }));
}

function monthTitle(year: number, month: number): string {
  const name = new Date(year, month, 1).toLocaleDateString(intlLocale(), { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The history as a calendar: every month back to the first run, each day a
 * dot sized by what was run, each week's total at the end of its row.
 */
export function TrainingCalendar({ runs, now, onOpenRun, bottomSpace }: Props) {
  const days = runsByDay(runs);
  const longest = Math.max(0, ...[...days.values()].map((day) => day.distanceM));
  const oldest = runs.reduce((first, run) => Math.min(first, run.startedAt), now);
  const months = monthsSince(oldest, now);
  const today = startOfDay(now);
  const initials = weekdayInitials();

  return (
    <FlatList
      data={months}
      keyExtractor={(item) => `${item.year}-${item.month}`}
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      initialNumToRender={3}
      renderItem={({ item }) => {
        const weeks = monthWeeks(item.year, item.month);
        return (
          <View style={styles.month}>
            <Text style={styles.title}>{monthTitle(item.year, item.month)}</Text>
            <View style={styles.row}>
              {initials.map((initial, index) => (
                <Text key={index} style={styles.initial}>{initial}</Text>
              ))}
              <View style={styles.total} />
            </View>
            {weeks.map((week) => {
              const weekM = week.days.reduce((sum, day) => sum + (day ? days.get(day.start)?.distanceM ?? 0 : 0), 0);
              return (
                <View key={week.start} style={styles.row}>
                  {week.days.map((day, index) => {
                    if (!day) return <View key={index} style={styles.cell} />;
                    const ran = days.get(day.start);
                    const size = ran ? markScale(ran.distanceM, longest) * CELL : 0;
                    return (
                      <Pressable
                        key={index}
                        disabled={!ran}
                        onPress={() => ran && onOpenRun(ran.runIds[0])}
                        accessibilityRole={ran ? "button" : "text"}
                        accessibilityLabel={ran
                          ? `${day.date}, ${formatDistance(ran.distanceM)} ${distanceUnit()}`
                          : String(day.date)}
                        style={[styles.cell, day.start === today && styles.today]}
                      >
                        {ran ? (
                          <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]} />
                        ) : null}
                        <Text style={[styles.date, ran && size > CELL * 0.6 && styles.dateOnMark]}>{day.date}</Text>
                      </Pressable>
                    );
                  })}
                  <Text style={styles.total} numberOfLines={1}>
                    {weekM > 0 ? formatDistance(weekM) : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  month: { paddingHorizontal: 20, paddingTop: 18 },
  title: { color: colors.text, fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  initial: {
    flex: 1, textAlign: "center", color: colors.subtle, fontSize: 12,
    fontFamily: font.semibold, paddingBottom: 4,
  },
  cell: { flex: 1, height: CELL + 4, alignItems: "center", justifyContent: "center" },
  today: { borderRadius: 8, borderWidth: 1.5, borderColor: colors.accent },
  mark: { position: "absolute", backgroundColor: colors.accentSoft },
  date: { color: colors.muted, fontSize: 13.5, fontFamily: font.medium, fontVariant: ["tabular-nums"] },
  dateOnMark: { color: colors.accent, fontFamily: font.semibold },
  total: {
    width: 44, textAlign: "right", color: colors.accent, fontSize: 13.5,
    fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
});
