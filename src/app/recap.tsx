import Ionicons from "@expo/vector-icons/Ionicons";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { RecapCard, periodTitle } from "@/components/RecapCard";
import { Segmented } from "@/components/Segmented";
import { listRuns, type Run } from "@/lib/db";
import { defineStrings, useStrings } from "@/lib/i18n";
import { nextPeriod, previousPeriod, recapOf, type RecapKind, type RecapPeriod } from "@/lib/recap";
import { colors, font } from "@/lib/theme";
import { viewShot } from "@/lib/viewShot";

const strings = defineStrings({
  fr: {
    month: "Mois",
    year: "Année",
    earlier: "Période précédente",
    later: "Période suivante",
    share: "Partager l'image",
    sharing: "Préparation…",
    unavailableTitle: "Image indisponible",
    unavailable: "Cette version de l'app ne peut pas produire l'image. Elle demande une version installée, pas Expo Go.",
    failed: "Partage impossible",
    tryAgain: "L'image n'a pas pu être préparée. Réessaie.",
  },
  en: {
    month: "Month",
    year: "Year",
    earlier: "Previous period",
    later: "Next period",
    share: "Share the picture",
    sharing: "Preparing…",
    unavailableTitle: "Picture unavailable",
    unavailable: "This version of the app can't make the picture. It needs an installed build, not Expo Go.",
    failed: "Couldn't share",
    tryAgain: "The picture couldn't be made. Try again.",
  },
});

/**
 * A month or a year summed up on one picture, to share. Opens on the month or
 * the year it was asked for, and steps back through the others.
 */
export default function RecapScreen() {
  const s = useStrings(strings);
  const params = useLocalSearchParams<{ kind?: string }>();
  const [openedAt] = useState(() => new Date());
  const [period, setPeriod] = useState<RecapPeriod>(() => ({
    kind: params.kind === "year" ? "year" : "month",
    year: openedAt.getFullYear(),
    month: openedAt.getMonth(),
  }));
  const [runs, setRuns] = useState<Run[]>([]);
  const [sharing, setSharing] = useState(false);
  const card = useRef<View>(null);

  useEffect(() => {
    let active = true;
    void listRuns().then((found) => {
      if (active) setRuns(found);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const recap = recapOf(runs, period);
  // No period after the current one: it has not happened.
  const isCurrent = period.year === openedAt.getFullYear()
    && (period.kind === "year" || period.month === openedAt.getMonth());
  const oldest = runs.reduce((first, run) => Math.min(first, run.startedAt), openedAt.getTime());
  const isFirst = new Date(oldest).getFullYear() === period.year
    && (period.kind === "year" || new Date(oldest).getMonth() === period.month);

  const switchKind = (kind: RecapKind) => setPeriod({ ...period, kind });

  const share = async () => {
    const shot = viewShot();
    if (!shot || !card.current) {
      Alert.alert(s.unavailableTitle, s.unavailable);
      return;
    }
    setSharing(true);
    try {
      const uri = await shot.captureRef(card.current, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
    } catch {
      Alert.alert(s.failed, s.tryAgain);
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Segmented
        options={[{ value: "month", label: s.month }, { value: "year", label: s.year }]}
        value={period.kind}
        onChange={switchKind}
      />

      <View style={styles.stepper}>
        <Pressable
          onPress={() => setPeriod(previousPeriod(period))}
          disabled={isFirst}
          accessibilityRole="button"
          accessibilityLabel={s.earlier}
          hitSlop={10}
          style={({ pressed }) => [styles.arrow, (pressed || isFirst) && styles.dim]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.period}>{periodTitle(recap)}</Text>
        <Pressable
          onPress={() => setPeriod(nextPeriod(period))}
          disabled={isCurrent}
          accessibilityRole="button"
          accessibilityLabel={s.later}
          hitSlop={10}
          style={({ pressed }) => [styles.arrow, (pressed || isCurrent) && styles.dim]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.preview}>
        <RecapCard ref={card} recap={recap} />
      </View>

      <Button label={sharing ? s.sharing : s.share} onPress={() => void share()} disabled={sharing || recap.runs === 0} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.3 },
  period: { color: colors.text, fontSize: 19, fontFamily: font.semibold },
  preview: { alignItems: "center" },
});
