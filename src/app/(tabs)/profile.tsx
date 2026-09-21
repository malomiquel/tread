import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter, useScrollToTop } from "expo-router";
import { useCallback, useState, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildLine } from "@/lib/build";
import { personalRecords, type PersonalRecords } from "@/lib/db";
import { formatDistance, formatDuration } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { colors, font } from "@/lib/theme";




export default function ProfileScreen() {
  /**
   * Tapping the section you are already in walks back to the top.
   *
   * The navigator emits a press even when the tab is already the one showing,
   * and this hook is what listens for it. Without it that tap does nothing at
   * all, which reads as the app having missed the finger rather than as
   * having nothing to do.
   */
  const page = useRef<ScrollView>(null);
  useScrollToTop(page);
  const [records, setRecords] = useState<PersonalRecords | null>(null);
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      personalRecords()
        .then((best) => {
          if (!active) return;
          setRecords(best);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  // The heading stays while the figures are fetched. An empty screen for the
  // length of a query is indistinguishable from a broken one, and it is the
  // whole of what people were seeing as a white page between tabs.
  if (!records) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <Text style={styles.title}>Profil</Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Same arrival as the history: the page settles in rather than
          replacing what was there between two frames. */}
      {/* A plain view. The tab itself cross-fades this screen in, and a
          second opacity animation on top of that one was not a second effect
          but a second chance to fail: when the inner fade did not run to
          completion the screen stayed at zero, which is the white page that
          appeared on some tab changes and not others. */}
      <View style={styles.fill}>
      <ScrollView ref={page} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}>
        <Text style={styles.title}>Profil</Text>
        {records.totalRuns > 0 ? (
          <Text style={styles.lede}>
            {records.totalRuns} course{records.totalRuns > 1 ? "s" : ""} ·{" "}
            {formatDistance(records.totalDistanceM)} km · {formatDuration(records.totalDurationS)}
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>À propos</Text>
          <Pressable
            onPress={() => router.push("/plan-method")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
          >
            <View style={styles.linkText}>
              <Text style={styles.recordLabel}>Comment les programmes sont construits</Text>
              <Text style={styles.recordDetail}>Le calcul, et ce qui relève de mon jugement</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        </View>

        {/* Which build this app was made from. An app on a phone otherwise
            says nothing about the version of the source that produced it, so
            "am I still up to date?" has no answer from the device. Compare
            this with git log and it does. */}
        <Text style={styles.build}>{buildLine()}</Text>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: {},
  title: {
    color: colors.text, fontSize: 32, fontFamily: font.bold,
    letterSpacing: -0.6, paddingHorizontal: GUTTER, paddingTop: 10,
  },
  // The one line that says who this is: everything below it is the detail.
  lede: {
    color: colors.muted, fontFamily: font.regular, fontSize: 15,
    paddingHorizontal: GUTTER, marginTop: 2, paddingBottom: 12,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    color: colors.muted, fontFamily: font.regular, fontSize: 16.5, textAlign: "center",
    marginTop: 56, lineHeight: 27.5, paddingHorizontal: GUTTER,
  },

  // Sections run edge to edge, told apart by a rule rather than by floating on
  // their own surface.
  card: {
    paddingHorizontal: GUTTER, paddingVertical: 18, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  cardTitle: {
    color: colors.subtle, fontSize: 13, fontFamily: font.semibold,
    letterSpacing: 1.4, textTransform: "uppercase",
  },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  hero: {
    color: colors.text, fontSize: 53.5, fontFamily: font.bold,
    letterSpacing: -1.17, fontVariant: ["tabular-nums"],
  },
  heroUnit: { color: colors.subtle, fontSize: 16.5, fontFamily: font.semibold },
  heroSub: { color: colors.muted, fontFamily: font.regular, fontSize: 15, marginTop: -2, fontVariant: ["tabular-nums"] },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 84, marginTop: 8 },
  column: { flex: 1, alignItems: "center", gap: 6 },
  barArea: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2, backgroundColor: colors.accentSoft },
  barCurrent: { backgroundColor: colors.accent },
  weekLabel: { color: colors.subtle, fontFamily: font.regular, fontSize: 13, fontVariant: ["tabular-nums"] },
  caption: { color: colors.subtle, fontSize: 13 },

  build: {
    color: colors.subtle, fontFamily: font.regular, fontSize: 12,
    textAlign: "center", paddingTop: 22, paddingBottom: 6, paddingHorizontal: GUTTER,
  },

  link: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 12, paddingVertical: 9,
  },
  linkPressed: { opacity: 0.6 },
  linkText: { flex: 1, gap: 1 },

  record: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 9,
  },
  recordLeft: { flex: 1, gap: 1 },
  recordLabel: { color: colors.text, fontSize: 16.5 },
  recordDetail: { color: colors.subtle, fontSize: 14 },
  recordValue: {
    color: colors.text, fontSize: 19, fontFamily: font.semibold, fontVariant: ["tabular-nums"],
  },
});
