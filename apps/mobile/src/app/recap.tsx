import Ionicons from "@expo/vector-icons/Ionicons";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { RECAP_VARIANTS, RecapCard, periodTitle, type RecapVariant } from "@/components/RecapCard";
import { CARD_WIDTH } from "@/components/ShareCard";
import { Segmented } from "@/components/Segmented";
import { ofSport } from "@tread/core/activity";
import { listRuns, type Run } from "@/lib/db";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { nextPeriod, previousPeriod, recapOf, type RecapKind, type RecapPeriod } from "@tread/core/recap";
import { colors, font } from "@/lib/theme";
import { viewShot } from "@/lib/viewShot";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";

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
  /** Null until read: a "0 km" card shown before the runs arrive would be a lie, briefly. */
  const [loaded, setLoaded] = useState<Run[] | null>(null);
  const runs = loaded ?? [];
  const [sharing, setSharing] = useState(false);
  // Every variant side by side; the one in view is the one shared.
  const cards = useRef<Partial<Record<RecapVariant, View | null>>>({});
  const [variant, setVariant] = useState<RecapVariant>("stage");
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    let active = true;
    void listRuns().then((found) => {
      if (active) setLoaded(ofSport(found));
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
    const card = cards.current[variant];
    if (!shot || !card) {
      Alert.alert(s.unavailableTitle, s.unavailable);
      return;
    }
    setSharing(true);
    try {
      const uri = await shot.captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
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

      {/* Every way of sharing it, swiped through like photos. Their room
          is kept while the runs are read, and they are only drawn once they
          are: nothing moves when they arrive. */}
      <ScrollView
        horizontal
        snapToInterval={PAGE}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={[{ width: screenWidth, marginHorizontal: -20 }, loaded === null && styles.waiting]}
        contentContainerStyle={{ paddingHorizontal: (screenWidth - CARD_WIDTH) / 2, gap: PAGE_GAP }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / PAGE);
          setVariant(RECAP_VARIANTS[Math.max(0, Math.min(RECAP_VARIANTS.length - 1, index))]);
        }}
      >
        {RECAP_VARIANTS.map((which) => (
          <View key={which}>
            {/* Checks under a transparent one, so it does not read as the page. */}
            {which === "clear" || which === "clearBlue" ? <Checks /> : null}
            <RecapCard ref={(view) => { cards.current[which] = view; }} recap={recap} variant={which} />
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {RECAP_VARIANTS.map((which) => (
          <View key={which} style={[styles.dot, variant === which && styles.dotOn]} />
        ))}
      </View>

      <Button label={sharing ? s.sharing : s.share} onPress={() => void share()} disabled={sharing || recap.runs === 0} />
    </ScrollView>
  );
}

const PAGE_GAP = 14;
const PAGE = CARD_WIDTH + PAGE_GAP;

/** The grey checks that mean "transparent", under a picture with nothing behind it. */
function Checks() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="recap-checks" width={16} height={16} patternUnits="userSpaceOnUse">
          <Rect width={16} height={16} fill="#5a5a5a" />
          <Rect width={8} height={8} fill="#6e6e6e" />
          <Rect x={8} y={8} width={8} height={8} fill="#6e6e6e" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#recap-checks)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 6, alignSelf: "center", alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairline },
  dotOn: { width: 18, backgroundColor: colors.accent },
  waiting: { opacity: 0 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.3 },
  period: { color: colors.text, fontSize: 19, fontFamily: font.semibold },
});
