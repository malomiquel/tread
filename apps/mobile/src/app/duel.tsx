import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import QRCode from "react-native-qrcode-svg";
import { Button } from "@/components/Button";
import { DuelCardFace } from "@/components/DuelCard";
import { LoadError } from "@/components/LoadError";
import { MiniCard, MINI_CARD_WIDTH } from "@/components/MiniCard";
import { Panel, PANEL_PADDING } from "@/components/Panel";
import { RecordRow } from "@/components/RecordRow";
import { SectionHeader } from "@/components/SectionHeader";
import { SummaryBanner } from "@/components/SummaryBanner";
import { cardWords, type Card, type Trait } from "@tread/core/card";
import {
  DECK_BUDGET, DECK_SIZE, decodeDeck, deckCost, deckProblem, duelCard, duelWords, encodeDeck, KEYWORD_POINTS,
  playable, playDuel, RARITY_COST, suggestDeck, type Duel, type DuelCard, type Round,
} from "@tread/core/duel";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { useAlbum, type Album } from "@/lib/album";
import { setDuelDeck, useSettings } from "@/lib/settings";
import { colors, font, literalColors } from "@/lib/theme";

const strings = defineStrings({
  fr: {
    lede: `Cinq de tes cartes contre cinq des siennes, manche par manche. ${DECK_BUDGET} points au plus : une commune coûte 1, une exceptionnelle 4.`,
    yourDeck: "Ton deck",
    points: (spent: number) => `${spent} / ${DECK_BUDGET} points`,
    empty: "Case libre",
    remove: (label: string) => `${label}, retirer du deck`,
    suggest: "Composer pour moi",
    clear: "Vider le deck",
    challenge: "Défier un ami",
    showCode: "Montrer le QR code",
    hideCode: "Cacher le QR code",
    codeNote: "Ton ami le scanne avec l'appareil photo de son téléphone. Le lien ne contient que tes cinq cartes : ni lieu, ni tracé, ni nom.",
    shareMessage: (link: string) => `Mon deck Tread contre le tien : ${link}`,
    replyMessage: (link: string) => `Je t'ai répondu sur Tread : ${link}`,
    yourCards: "Tes cartes",
    cost: (points: number) => `${points} pt${points > 1 ? "s" : ""}`,
    notEnough: (count: number) => `Il faut ${DECK_SIZE} cartes de course pour jouer. Tu en as ${count} : chaque sortie en ajoute une.`,
    rules: "Ce que valent les traits",
    rulesAside: "en duel",
    theirDeck: "Son deck",
    invalidLink: "Ce lien de duel est illisible. Demande à ton ami de le renvoyer.",
    buildFirst: "Compose d'abord ton deck pour lui répondre.",
    play: "Jouer le duel",
    replayNote: "Le duel se rejoue avec le deck que tu lui avais envoyé : vous voyez tous les deux le même.",
    round: (index: number, terrain: string) => `Manche ${index} · ${terrain}`,
    you: "Toi",
    them: "En face",
    won: "Gagnée",
    drawn: "Égalité",
    result: "Résultat",
    outcome: { home: "Victoire", away: "Défaite", draw: "Égalité" } as Record<Duel["winner"], string>,
    tieBreak: "À égalité de manches, c'est le total des points qui départage.",
    reply: "Lui renvoyer le duel",
    newDuel: "Préparer un autre duel",
  },
  en: {
    lede: `Five of your cards against five of theirs, round by round. ${DECK_BUDGET} points at most: a common card costs 1, an exceptional one 4.`,
    yourDeck: "Your deck",
    points: (spent: number) => `${spent} / ${DECK_BUDGET} points`,
    empty: "Empty slot",
    remove: (label: string) => `${label}, remove from the deck`,
    suggest: "Build it for me",
    clear: "Empty the deck",
    challenge: "Challenge a friend",
    showCode: "Show the QR code",
    hideCode: "Hide the QR code",
    codeNote: "Your friend scans it with their phone's camera. The link holds only your five cards: no place, no outline, no name.",
    shareMessage: (link: string) => `My Tread deck against yours: ${link}`,
    replyMessage: (link: string) => `I answered you on Tread: ${link}`,
    yourCards: "Your cards",
    cost: (points: number) => `${points} pt${points > 1 ? "s" : ""}`,
    notEnough: (count: number) => `You need ${DECK_SIZE} running cards to play. You have ${count}: every run adds one.`,
    rules: "What traits are worth",
    rulesAside: "in a duel",
    theirDeck: "Their deck",
    invalidLink: "This duel link can't be read. Ask your friend to send it again.",
    buildFirst: "Build your deck first to answer them.",
    play: "Play the duel",
    replayNote: "The duel is played again with the deck you sent them: you both see the same one.",
    round: (index: number, terrain: string) => `Round ${index} · ${terrain}`,
    you: "You",
    them: "Them",
    won: "Won",
    drawn: "Draw",
    result: "Result",
    outcome: { home: "Victory", away: "Defeat", draw: "Draw" },
    tieBreak: "Level on rounds, the total of points decides.",
    reply: "Send the duel back",
    newDuel: "Prepare another duel",
  },
});

const TRAITS: readonly Trait[] = [
  "best", "longest", "climb", "session", "patience", "ghost", "race",
  "early", "late", "rain", "snow", "wind", "cold", "anniversary",
];

/** The cards of the saved deck that still exist and may still play, in order. */
function deckOf(album: Album, ids: readonly number[]): Card[] {
  return ids
    .map((id) => album.cards.get(id))
    .filter((card): card is Card => card !== undefined && playable(card));
}

const travelling = (album: Album, cards: readonly Card[]): DuelCard[] =>
  cards.map((card) => duelCard(card, album.byId.get(card.runId)?.distanceM ?? 0));

const duelLink = (params: Record<string, string>) => Linking.createURL("duel", { queryParams: params });

/**
 * Duels: five cards against a friend's five.
 *
 * Opened on its own, it builds the deck and sends it, as a link or a QR
 * code. Opened from a friend's link, it shows their deck and plays the duel,
 * one round at a time, and offers to send the answer back so that both
 * phones show the same match. Nothing passes through a server, and the link
 * holds the cards alone.
 */
export default function DuelScreen() {
  const params = useLocalSearchParams<{ d?: string; vs?: string }>();
  const s = useStrings(strings);
  const { album, failed, reload } = useAlbum();
  const settings = useSettings();

  if (!album) {
    return <View style={styles.screen}>{failed ? <LoadError onRetry={reload} /> : null}</View>;
  }
  if (params.d !== undefined) {
    const theirs = decodeDeck(params.d);
    if (!theirs) {
      return (
        <View style={styles.screen}>
          <Text style={styles.lede}>{s.invalidLink}</Text>
        </View>
      );
    }
    return <Match album={album} theirs={theirs} sent={params.vs ? decodeDeck(params.vs) : null} deckIds={settings.duelDeck} />;
  }
  return <DeckBuilder album={album} deckIds={settings.duelDeck} />;
}

/** The deck being built, its slots, the cards to choose from and the rules. */
function DeckBuilder({ album, deckIds }: { album: Album; deckIds: number[] }) {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const duel = useStrings(duelWords);
  const [showingCode, setShowingCode] = useState(false);
  const deck = deckOf(album, deckIds);
  const pool = album.newest.filter(playable);
  const mine = travelling(album, deck);
  const problem = deck.length === 0 ? null : deckProblem(mine.map((card, i) => ({ ...card, runId: deck[i].runId })));
  const ready = deck.length === DECK_SIZE && problem === null;
  const code = ready ? encodeDeck(mine) : null;
  const link = code ? duelLink({ d: code }) : null;
  const spent = deckCost(deck);
  const { width } = useWindowDimensions();
  const columns = 3;
  const cell = Math.floor((width - 40 - (columns - 1) * 10) / columns);

  const toggle = (card: Card) => {
    void Haptics.selectionAsync();
    const ids = deck.map((one) => one.runId);
    void setDuelDeck(ids.includes(card.runId)
      ? ids.filter((id) => id !== card.runId)
      : ids.length < DECK_SIZE ? [...ids, card.runId] : ids);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>{s.lede}</Text>

      <SectionHeader title={s.yourDeck} aside={s.points(spent)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
        {Array.from({ length: DECK_SIZE }, (_, i) => {
          const card = deck[i];
          const run = card ? album.byId.get(card.runId) : undefined;
          return card && run ? (
            <View key={card.runId} accessibilityLabel={s.remove(words.number(card.number))}>
              <MiniCard card={card} run={run} onPress={() => toggle(card)} />
            </View>
          ) : (
            <View key={`empty-${i}`} style={styles.emptySlot}>
              <Text style={styles.emptyText}>{s.empty}</Text>
            </View>
          );
        })}
      </ScrollView>
      {/* Two lines kept for the problem, said or not. */}
      <Text style={styles.problem}>{problem ? duel.problem[problem] : ""}</Text>

      <View style={styles.actions}>
        {pool.length < DECK_SIZE ? (
          <Text style={styles.note}>{s.notEnough(pool.length)}</Text>
        ) : (
          <>
            <Button
              label={s.challenge}
              disabled={!link}
              onPress={() => link && void Share.share({ message: s.shareMessage(link) })}
            />
            <Button
              label={deck.length === 0 ? s.suggest : s.clear}
              variant="secondary"
              onPress={() => {
                if (deck.length > 0) {
                  void setDuelDeck([]);
                  return;
                }
                const suggested = suggestDeck([...album.cards.values()]);
                if (suggested) void setDuelDeck(suggested.map((card) => card.runId));
              }}
            />
            {link ? (
              <Button
                label={showingCode ? s.hideCode : s.showCode}
                variant="secondary"
                onPress={() => setShowingCode((on) => !on)}
              />
            ) : null}
          </>
        )}
      </View>

      {showingCode && link ? (
        <View style={styles.codeBlock}>
          {/* White ground whatever the appearance: a scanner reads dark on light. */}
          <View style={styles.qr}>
            <QRCode value={link} size={220} backgroundColor="#ffffff" color={literalColors.text.light} />
          </View>
          <Text style={styles.note}>{s.codeNote}</Text>
        </View>
      ) : null}

      {pool.length > 0 ? (
        <>
          <SectionHeader title={s.yourCards} aside={String(pool.length)} />
          <View style={styles.grid}>
            {pool.map((card) => {
              const run = album.byId.get(card.runId);
              if (!run) return null;
              const inDeck = deck.some((one) => one.runId === card.runId);
              return (
                <View
                  key={card.runId}
                  style={[styles.cell, { width: cell }]}
                  accessibilityState={{ selected: inDeck }}
                >
                  <View>
                    <MiniCard card={card} run={run} width={cell} onPress={() => toggle(card)} />
                    {/* In the deck: ringed, and the tick in the line under it. */}
                    {inDeck ? <View pointerEvents="none" style={styles.ring} /> : null}
                  </View>
                  <Text style={[styles.cost, inDeck && styles.costChosen]}>
                    {inDeck ? `✓ ${s.cost(RARITY_COST[card.rarity])}` : s.cost(RARITY_COST[card.rarity])}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <SectionHeader title={s.rules} aside={s.rulesAside} />
      <Panel>
        {TRAITS.map((trait, i) => (
          <RecordRow
            key={trait}
            first={i === 0}
            onPanel
            icon="flash-outline"
            label={words.trait[trait]}
            detail={duel.keyword[trait]}
            value={`+${KEYWORD_POINTS[trait]}`}
          />
        ))}
      </Panel>
    </ScrollView>
  );
}

/** A friend's deck against the runner's, played round by round. */
function Match({ album, theirs, sent, deckIds }: {
  album: Album;
  theirs: DuelCard[];
  /** The deck this runner sent, when the link is an answer to it. */
  sent: DuelCard[] | null;
  deckIds: number[];
}) {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const router = useRouter();
  const reduced = useReducedMotion();
  const deck = deckOf(album, deckIds);
  const current = travelling(album, deck);
  const mine = sent ?? (deck.length === DECK_SIZE && deckProblem(current) === null ? current : null);
  const [played, setPlayed] = useState<Duel | null>(null);
  const [shown, setShown] = useState(0);
  const { width } = useWindowDimensions();
  const half = Math.floor((width - 2 * 12 - 2 * PANEL_PADDING - 12) / 2);

  // One round after the other, each with a tick.
  useEffect(() => {
    if (!played || shown >= played.rounds.length) return;
    const timer = setTimeout(() => {
      setShown((count) => count + 1);
      void Haptics.selectionAsync();
    }, shown === 0 ? 200 : 900);
    return () => clearTimeout(timer);
  }, [played, shown]);

  const finished = played !== null && shown >= played.rounds.length;
  useEffect(() => {
    if (finished && played) {
      void Haptics.notificationAsync(played.winner === "home"
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning);
    }
  }, [finished, played]);

  const play = () => {
    if (!mine) return;
    const duel = playDuel(mine, theirs);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlayed(duel);
    setShown(reduced ? duel.rounds.length : 0);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {finished && played ? (
        <SummaryBanner
          label={s.result}
          value={`${played.home} – ${played.away}`}
          detail={s.outcome[played.winner]}
        />
      ) : null}

      <SectionHeader title={s.theirDeck} aside={s.points(deckCost(theirs))} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deckRow}>
        {theirs.map((card) => <DuelCardFace key={card.number} card={card} width={MINI_CARD_WIDTH + 22} />)}
      </ScrollView>

      {sent ? <Text style={[styles.note, styles.padded]}>{s.replayNote}</Text> : null}

      {!mine ? (
        <View style={styles.actions}>
          <Text style={styles.note}>{s.buildFirst}</Text>
          <Button label={s.yourDeck} onPress={() => router.push("/duel")} />
        </View>
      ) : !played ? (
        <View style={styles.actions}>
          <Button label={s.play} onPress={play} />
        </View>
      ) : null}

      {played?.rounds.slice(0, shown).map((round, i) => (
        <RoundView key={i} index={i + 1} round={round} width={half} />
      ))}

      {finished && played && mine ? (
        <View style={styles.actions}>
          {played.home === played.away ? <Text style={styles.note}>{s.tieBreak}</Text> : null}
          {!sent ? (
            <Button
              label={s.reply}
              onPress={() => void Share.share({
                message: s.replyMessage(duelLink({ d: encodeDeck(mine), vs: encodeDeck(theirs) })),
              })}
            />
          ) : null}
          <Button label={s.newDuel} variant="secondary" onPress={() => router.replace("/duel")} />
        </View>
      ) : null}
      {/* Read by a screen reader as the rounds arrive. */}
      <Text accessibilityLiveRegion="polite" style={styles.hidden}>
        {played && shown > 0 ? words.stat[played.rounds[shown - 1].terrain] : ""}
      </Text>
    </ScrollView>
  );
}

function RoundView({ index, round, width }: { index: number; round: Round; width: number }) {
  const s = useStrings(strings);
  const words = useStrings(cardWords);
  const sides = [
    { who: s.you, side: round.home, won: round.winner === "home" },
    { who: s.them, side: round.away, won: round.winner === "away" },
  ];
  return (
    <>
      <SectionHeader title={s.round(index, words.stat[round.terrain])} aside={round.winner === "draw" ? s.drawn : undefined} />
      <Panel>
        <View style={styles.round}>
          {sides.map(({ who, side, won }) => (
            <View key={who} style={[styles.half, { width }]}>
              <View style={styles.sideHead}>
                <Text style={styles.who}>{who}</Text>
                <Text style={[styles.verdict, !won && styles.hidden]}>{s.won}</Text>
              </View>
              <Text style={[styles.power, !won && round.winner !== "draw" && styles.powerLost]}>{side.power}</Text>
              <Text style={styles.breakdown} numberOfLines={3}>
                {[`${words.stat[round.terrain]} ${side.base}`, ...side.bonuses.map((bonus) => `${words.trait[bonus.trait]} +${bonus.points}`)].join("\n")}
              </Text>
              <DuelCardFace card={side.card} terrain={round.terrain} width={width} />
            </View>
          ))}
        </View>
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 4, paddingBottom: 48 },
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, minHeight: 40,
  },
  deckRow: { paddingHorizontal: 20, gap: 10 },
  emptySlot: {
    width: MINI_CARD_WIDTH, height: MINI_CARD_WIDTH + 70, borderRadius: 12,
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.hairline,
    alignItems: "center", justifyContent: "center",
  },
  emptyText: { color: colors.subtle, fontSize: 14, fontFamily: font.regular },
  problem: {
    color: colors.warning, fontSize: 14, fontFamily: font.regular, lineHeight: 19,
    paddingHorizontal: 20, paddingTop: 8, minHeight: 46,
  },
  actions: { paddingHorizontal: 20, gap: 10, paddingTop: 4 },
  note: { color: colors.subtle, fontSize: 14, fontFamily: font.regular, lineHeight: 19 },
  padded: { paddingHorizontal: 20, paddingTop: 10 },
  codeBlock: { alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  qr: { padding: 16, borderRadius: 12, backgroundColor: "#ffffff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20 },
  cell: { gap: 4, borderRadius: 14 },
  ring: {
    position: "absolute", top: -4, left: -4, right: -4, bottom: -4, borderRadius: 15, borderWidth: 2, borderColor: colors.accent,
  },
  cost: { color: colors.subtle, fontSize: 13, fontFamily: font.medium, textAlign: "center", fontVariant: ["tabular-nums"] },
  costChosen: { color: colors.accent, fontFamily: font.semibold },
  hidden: { opacity: 0, height: 0 },

  round: { flexDirection: "row", gap: 12, paddingHorizontal: PANEL_PADDING, paddingVertical: 14 },
  half: { gap: 6 },
  sideHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  who: {
    color: colors.subtle, fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.3, textTransform: "uppercase",
  },
  verdict: { color: colors.accent, fontSize: 13, fontFamily: font.semibold },
  power: { color: colors.text, fontSize: 32, fontFamily: font.semibold, letterSpacing: -0.9, fontVariant: ["tabular-nums"] },
  powerLost: { color: colors.subtle },
  breakdown: { color: colors.muted, fontSize: 13.5, fontFamily: font.regular, lineHeight: 18, minHeight: 54 },
});
