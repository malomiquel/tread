import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SettingRow } from "@/components/SettingRow";
import { WeeklyGoalSheet } from "@/components/WeeklyGoalSheet";
import { listRuns } from "@/lib/db";
import { formatDistance } from "@/lib/format";
import { suggestedWeeklyGoalM } from "@/lib/stats";
import { useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";

/**
 * What the programme is aiming at.
 *
 * The weekly goal can also be set from the week it describes, in Progression,
 * and that is the door most people will use — a figure is easiest to change
 * while you are looking at it. This page exists for the other half of the
 * question: somebody who has come looking for their settings expects to find
 * every one of them here, including the ones they set somewhere else.
 */
export default function PlanSettings() {
  const router = useRouter();
  const settings = useSettings();
  const [suggestedM, setSuggestedM] = useState(5000);
  const [editing, setEditing] = useState(false);

  // Their own recent average, so the sheet opens on a figure they recognise.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRuns()
        .then((runs) => active && setSuggestedM(suggestedWeeklyGoalM(runs)))
        .catch(() => undefined);
      return () => { active = false; };
    }, []),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.group}>
        <SettingRow
          label="Objectif hebdomadaire"
          detail="La distance à couvrir du lundi au dimanche"
          value={
            settings.weeklyGoalM === null
              ? "Aucun"
              : `${formatDistance(settings.weeklyGoalM)} km`
          }
          onPress={() => setEditing(true)}
        />
      </View>

      <View style={styles.group}>
        <SettingRow
          label="Comment les programmes sont construits"
          detail="Le calcul, et ce qui relève de mon jugement"
          onPress={() => router.push("/plan-method")}
        />
      </View>

      <WeeklyGoalSheet
        visible={editing}
        goalM={settings.weeklyGoalM}
        suggestedM={suggestedM}
        onClose={() => setEditing(false)}
      />
    </ScrollView>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  group: {
    paddingHorizontal: GUTTER, paddingVertical: 6, marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline,
  },
});
