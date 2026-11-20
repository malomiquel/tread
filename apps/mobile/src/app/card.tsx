import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from "react-native-reanimated";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { MetaCardView } from "@/components/MetaCard";
import { CardBack, RunCard } from "@/components/RunCard";
import { TiltCard } from "@/components/TiltCard";
import { cardPoints, cardWords, slotName, type Card } from "@tread/core/card";
import { duelWords } from "@tread/core/duel";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { completedBy, metaWords, type MetaCard } from "@tread/core/metaCard";
import { useAlbum, type Album } from "@/lib/album";
import { readItems, type StageItem as Item } from "@/lib/cardStage";
import { markCardsSeen, useSettings } from "@/lib/settings";
import { colors, font } from "@/lib/theme";
import { pendingWeather } from "@/lib/tracker";
import { viewShot } from "@/lib/viewShot";

const strings = defineStrings({
  fr: {
    reveal: "Touche la carte pour la retourner",
    close: "Fermer",
    next: "Carte suivante",
    done: "Terminé",
    seeRun: "Voir la course",
    share: "Partager la carte",
    shareUnavailable: "Partage indisponible",
    shareUnavailableBody: "Ce téléphone ne propose pas de partager une image.",
    imageFailed: "Image impossible",
    unexpected: "Erreur inattendue.",
    of: (index: number, total: number) => `${index} sur ${total}`,
    newSlot: (name: string) => `Nouvelle case : ${name}`,
    completes: (kind: string) => `Elle complète une carte : ${kind}`,
    plain: "Une carte simple. Les plus belles viennent des jours qui sortent de l'ordinaire, ou d'un footing tenu tranquille.",
    inDuel: "En duel",
    missing: "Cette carte n'existe plus : sa course a été supprimée.",
    backFace: "Dos de la carte",
  },
  en: {
    reveal: "Tap the card to turn it over",
    close: "Close",
    next: "Next card",
    done: "Done",
    seeRun: "See the run",
    share: "Share the card",
    shareUnavailable: "Sharing unavailable",
    shareUnavailableBody: "This phone doesn't offer to share an image.",
    imageFailed: "Couldn't make the image",
    unexpected: "Unexpected error.",
    of: (index: number, total: number) => `${index} of ${total}`,
    newSlot: (name: string) => `New slot: ${name}`,
    completes: (kind: string) => `It completes a card: ${kind}`,
    plain: "A plain card. The finest come from days out of the ordinary, or from an easy run kept easy.",
    inDuel: "In a duel",
    missing: "This card is gone: its run was deleted.",
    backFace: "Back of the card",
  },
});

const findMeta = (album: Album, key: string): MetaCard | undefined =>
  [...album.meta.races, ...album.meta.blocks, ...album.meta.weeks].find((card) => card.key === key);

/**
 * The stage cards are turned over on, and looked at.
 *
 * After a run, its card arrives face down: a tap turns it, then what it
 * earned is said one line at a time, each with a tick under the finger, and
 * then what else it completed, a slot in a set, a week, a block, a race, each
 * of those its own card to turn after it. From the collection, the same
 * stage shows a card already face up, to hold and tilt.
 *
 * Nothing on it is drawn at random: the card was decided by the run. The
 * ceremony is in the turning, not in the odds.
 */
export default function CardStage() {
  const params = useLocalSearchParams<{ items?: string; reveal?: string; seen?: string }>();
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const meta = useStrings(metaWords);
  const duel = useStrings(duelWords);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { privacyRadiusM } = useSettings();
  const { album, reload } = useAlbum();
  const revealing = params.reveal === "1";
  const asked = readItems(params.items);

  // A run just finished has its weather arriving a moment after it, and the
  // weather is part of what deals the card: wait for it before showing.
  const [ready, setReady] = useState(!revealing);
  useEffect(() => {
    if (ready) return;
    const waits = asked.flatMap((item) => (item.kind === "run" ? [pendingWeather(item.runId)] : []))
      .filter((wait) => wait !== null);
    const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
    void Promise.race([Promise.all(waits), timeout]).then(() => {
      reload();
      setReady(true);
    });
    // Asked once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A run's card brings the meta cards it completed along behind it.
  const items: Item[] = [];
  for (const item of asked) {
    items.push(item);
    if (revealing && item.kind === "run" && album) {
      for (const completed of completedBy(album.meta, item.runId)) {
        if (!asked.some((other) => other.kind === "meta" && other.key === completed.key)) {
          items.push({ kind: "meta", key: completed.key });
        }
      }
    }
  }

  const [index, setIndex] = useState(0);
  const item = items[Math.min(index, items.length - 1)];
  const last = index >= items.length - 1;

  const close = () => {
    if (revealing) {
      const newest = Math.max(0, Number(params.seen) || 0, ...asked.flatMap((one) => (one.kind === "run" ? [one.runId] : [])));
      if (newest > 0) void markCardsSeen(newest);
    }
    router.back();
  };

  const front = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  async function share() {
    const shot = viewShot();
    if (!shot || !front.current || sharing) return;
    setSharing(true);
    try {
      const uri = await shot.captureRef(front.current, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
      } else {
        Alert.alert(s.shareUnavailable, s.shareUnavailableBody);
      }
    } catch (cause) {
      Alert.alert(s.imageFailed, cause instanceof Error ? cause.message : s.unexpected);
    } finally {
      setSharing(false);
    }
  }

  const runCard: Card | undefined = item?.kind === "run" ? album?.cards.get(item.runId) : undefined;
  const run = item?.kind === "run" ? album?.byId.get(item.runId) : undefined;
  const metaCard = item?.kind === "meta" && album ? findMeta(album, item.key) : undefined;
  const missing = album !== undefined && ready && item !== undefined && !(runCard && run) && !metaCard;

  // What the card earned, said after it is turned: its traits, then the
  // slots of the album it filled first.
  const lines: { key: string; text: string; aside?: string }[] = [];
  if (runCard && run && album) {
    if (runCard.note) lines.push({ key: "note", text: words.note[runCard.note] });
    for (const trait of runCard.traits) {
      lines.push({ key: trait, text: words.trait[trait], aside: `${s.inDuel} ${duel.keyword[trait]}` });
    }
    if (!runCard.note && runCard.traits.length === 0) lines.push({ key: "plain", text: s.plain });
    for (const set of album.sets) {
      for (const slot of set.slots) {
        if (slot.runId === run.id) lines.push({ key: `${set.id}-${slot.key}`, text: s.newSlot(slotName(set.id, slot.key)) });
      }
    }
  } else if (metaCard) {
    lines.push({ key: "explain", text: meta.explain[metaCard.kind] });
  }

  // A full-screen modal can be laid out before its insets are known, and
  // then sits under the clock: the window's own insets are the floor.
  const window = initialWindowMetrics?.insets;
  const safe = {
    top: Math.max(insets.top, window?.top ?? 0),
    bottom: Math.max(insets.bottom, window?.bottom ?? 0),
  };

  const strong = runCard ? cardPoints(runCard.traits) >= 4 : metaCard !== undefined;

  return (
    <View style={[styles.screen, { paddingTop: safe.top, paddingBottom: safe.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.bar}>
        <Text style={styles.count}>{items.length > 1 ? s.of(index + 1, items.length) : ""}</Text>
        <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.close}>{s.close}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {missing ? <Text style={styles.missing}>{s.missing}</Text> : null}
        {ready && item && ((runCard && run) || metaCard) ? (
          <Flip
            key={`${index}-${item.kind === "run" ? item.runId : item.key}`}
            faceDown={revealing}
            number={runCard ? words.number(runCard.number) : metaCard ? `${meta.kind[metaCard.kind]} · ${words.number(metaCard.number)}` : ""}
            strong={strong}
            hint={s.reveal}
            backLabel={s.backFace}
            lines={lines}
          >
            <TiltCard enabled>
              {runCard && run ? (
                <RunCard ref={front} card={runCard} run={run} privacyRadiusM={privacyRadiusM} />
              ) : metaCard && album ? (
                <MetaCardView ref={front} card={metaCard} byId={album.byId} privacyRadiusM={privacyRadiusM} />
              ) : null}
            </TiltCard>
          </Flip>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {!last ? (
          <Button label={s.next} onPress={() => setIndex((at) => at + 1)} />
        ) : run && !revealing ? (
          <Button label={s.seeRun} onPress={() => router.replace({ pathname: "/run/[id]", params: { id: String(run.id) } })} />
        ) : (
          <Button label={s.done} onPress={close} />
        )}
        {viewShot() && (runCard || metaCard) ? (
          <Button label={s.share} variant="secondary" disabled={sharing} onPress={() => void share()} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * A card that arrives face down and turns over at a touch, then says what
 * it earned one line at a time.
 *
 * The turn is a rotation about the vertical axis, back and front each
 * hidden past ninety degrees. Moved, never faded. For someone who asked the
 * phone to reduce motion, the card is simply face up.
 */
function Flip({ faceDown, number, strong, hint, backLabel, lines, children }: {
  faceDown: boolean;
  number: string;
  strong: boolean;
  hint: string;
  backLabel: string;
  lines: { key: string; text: string; aside?: string }[];
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [turned, setTurned] = useState(!faceDown || reduced);
  const [said, setSaid] = useState(turned ? lines.length : 0);
  const turn = useSharedValue(turned ? 1 : 0);

  // Each line arrives on its own, with a tick, once the card is face up.
  useEffect(() => {
    if (!turned || said >= lines.length) return;
    const timer = setTimeout(() => {
      setSaid((count) => count + 1);
      void Haptics.selectionAsync();
    }, said === 0 ? 520 : 380);
    return () => clearTimeout(timer);
  }, [turned, said, lines.length]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.get() * 180}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${turn.get() * 180 - 180}deg` }],
  }));

  function reveal() {
    if (turned) return;
    setTurned(true);
    turn.set(withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    void Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
  }

  return (
    <View style={styles.flip}>
      <Pressable
        onPress={reveal}
        disabled={turned}
        accessibilityRole="button"
        accessibilityLabel={turned ? undefined : `${backLabel}, ${hint}`}
      >
        <Animated.View style={[styles.face, frontStyle]}>{children}</Animated.View>
        <Animated.View pointerEvents="none" style={[styles.back, backStyle]}>
          <CardBack number={number} />
        </Animated.View>
      </Pressable>

      {/* Room kept for the hint and the lines, so nothing jumps as they come. */}
      <View style={styles.lines}>
        {!turned ? <Text style={styles.hint}>{hint}</Text> : null}
        {lines.slice(0, said).map((line) => (
          <View key={line.key} style={styles.line}>
            <Text style={styles.lineText}>{line.text}</Text>
            {line.aside ? <Text style={styles.lineAside}>{line.aside}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
  },
  count: { color: colors.subtle, fontSize: 14.5, fontFamily: font.regular, fontVariant: ["tabular-nums"] },
  close: { color: colors.accent, fontSize: 17, fontFamily: font.semibold },
  content: { paddingTop: 8, paddingBottom: 24 },
  missing: { color: colors.muted, fontSize: 15.5, fontFamily: font.regular, paddingHorizontal: 20, lineHeight: 22 },

  flip: { alignItems: "center", gap: 18 },
  face: { backfaceVisibility: "hidden" },
  back: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backfaceVisibility: "hidden" },

  lines: { alignSelf: "stretch", paddingHorizontal: 20, gap: 10, minHeight: 120 },
  hint: { color: colors.subtle, fontSize: 15, fontFamily: font.regular, textAlign: "center" },
  line: { gap: 1 },
  lineText: { color: colors.text, fontSize: 18.5, fontFamily: font.semibold, letterSpacing: -0.2 },
  lineAside: { color: colors.subtle, fontSize: 14, fontFamily: font.regular },

  actions: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 10 },
});
