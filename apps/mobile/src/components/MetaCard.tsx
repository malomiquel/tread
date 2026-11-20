import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CARD_RATIO, CardSurface, cardLook, rarityPips } from "@/components/CardSurface";
import { MINI_CARD_WIDTH } from "@/components/MiniCard";
import { PressableScale } from "@/components/PressableScale";
import { ART_SIZE, ART_TOP, RUN_CARD_HEIGHT, RUN_CARD_WIDTH, fade } from "@/components/RunCard";
import { RunShape } from "@/components/RunShape";
import { Depth } from "@/components/TiltCard";
import { cardWords } from "@tread/core/card";
import { autoName, formatDistance, formatDuration } from "@tread/core/format";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { metaWords, tierName, type MetaCard } from "@tread/core/metaCard";
import { distanceUnit } from "@tread/core/units";
import type { Run } from "@/lib/db";
import { font } from "@/lib/theme";

type ShapeRun = Pick<Run, "id" | "startedAt" | "endedAt" | "name" | "activity">;

const strings = defineStrings({
  fr: { runs: "Sorties", time: "Temps", rare: "Rares", weeks: "Semaines" },
  en: { runs: "Runs", time: "Time", rare: "Rare", weeks: "Weeks" },
});

/** What a meta card is called on its face: a week, two dates, or the race's name. */
export function metaTitle(card: MetaCard, byId: ReadonlyMap<number, ShapeRun>): string {
  const words = metaWords();
  if (card.kind === "week") return words.weekOf(card.from);
  if (card.kind === "block") return words.blockOf(card.from, card.to);
  const race = card.raceRunId === null ? undefined : byId.get(card.raceRunId);
  return race ? race.name ?? autoName(race.startedAt) : words.kind.race;
}

/** The runs a card shows the outlines of: the race, or the last of a week. */
function shown(card: MetaCard, byId: ReadonlyMap<number, ShapeRun>, count: number): ShapeRun[] {
  const ids = card.kind === "race" ? card.runIds.slice(0, -1).slice(-count) : card.runIds.slice(-count);
  return ids.map((id) => byId.get(id)).filter((run): run is ShapeRun => run !== undefined);
}

/** A stable number to engrave a meta card's contours from. */
const seedOf = (card: MetaCard) => Math.floor(card.from / 86_400_000) + card.number * 31;

/**
 * The card a week, a block or a race leaves, printed like a run's card.
 *
 * A race shows its own outline large across the card; a week or a block
 * lays its runs' outlines out as a plate of small engravings, or one alone
 * large when it holds a single run. At the foot, its name and three
 * figures. A race is legendary: night under platinum, a second frame and
 * the strongest sheen.
 */
export const MetaCardView = forwardRef<View, {
  card: MetaCard;
  byId: ReadonlyMap<number, ShapeRun>;
  privacyRadiusM: number;
}>(function MetaCardView({ card, byId, privacyRadiusM }, ref) {
  const words = useStrings(metaWords);
  const cards = useStrings(cardWords);
  const s = useStrings(strings);
  const look = cardLook(card.tier);
  const race = card.raceRunId === null ? undefined : byId.get(card.raceRunId);
  const plate = shown(card, byId, 8);
  const large = race ?? (plate.length === 1 ? plate[0] : undefined);
  const cell = (RUN_CARD_WIDTH - 48 - 3 * GAP) / 4;
  const figures = [
    { key: "runs", value: String(card.runs), label: s.runs },
    { key: "time", value: formatDuration(card.durationS), label: s.time },
    card.kind === "block"
      ? { key: "weeks", value: String(card.weeks), label: s.weeks }
      : { key: "rare", value: String(card.rareCards), label: s.rare },
  ];

  return (
    <CardSurface ref={ref} look={look} seed={seedOf(card)} style={styles.card}>
      <View pointerEvents="none" style={styles.art}>
        {large ? (
          <Depth points={8}>
            <RunShape
              runId={large.id}
              track={`${large.startedAt}-${large.endedAt}`}
              ride={large.activity === "ride"}
              size={ART_SIZE}
              strokeWidth={5}
              hideEndsM={privacyRadiusM}
              tint={{ tile: "transparent", line: look.line, icon: look.soft }}
            />
          </Depth>
        ) : (
          <Depth points={6}>
            <View style={[styles.plate, { width: RUN_CARD_WIDTH - 48 }]}>
              {plate.map((run) => (
                <RunShape
                  key={run.id}
                  runId={run.id}
                  track={`${run.startedAt}-${run.endedAt}`}
                  ride={run.activity === "ride"}
                  size={cell}
                  strokeWidth={3}
                  hideEndsM={privacyRadiusM}
                  tint={{ tile: look.tile, line: look.line, icon: look.soft }}
                />
              ))}
            </View>
          </Depth>
        )}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[fade(look.page, 0), fade(look.page, 0.92)]}
        locations={[0, 0.55]}
        style={styles.fade}
      />

      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={[styles.figure, { color: look.ink }]}>
            {formatDistance(card.distanceM)}
            <Text style={[styles.unit, { color: look.lit }]}> {distanceUnit()}</Text>
          </Text>
          <Text style={[styles.corner, { color: look.soft }]}>
            {`${words.kind[card.kind]}\n${cards.number(card.number)}`}
          </Text>
        </View>

        <View style={styles.foot}>
          <Text style={[styles.name, { color: look.ink }]} numberOfLines={1}>{metaTitle(card, byId)}</Text>
          <Text style={[styles.traits, { color: look.lit }]} numberOfLines={2}>
            {(card.kind === "race"
              ? [words.prepared(card.runs - 1), ...card.traits.slice(0, 3).map((trait) => cards.trait[trait])]
              : card.traits.slice(0, 4).map((trait) => cards.trait[trait])
            ).join(" · ")}
          </Text>

          <View style={[styles.stats, { borderColor: look.rule }]}>
            {figures.map((figure) => (
              <View key={figure.key} style={styles.stat}>
                <Text style={[styles.statValue, { color: look.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {figure.value}
                </Text>
                <Text style={[styles.statLabel, { color: look.soft }]} numberOfLines={1}>{figure.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.bottom}>
            <Text style={[styles.rarity, { color: look.strong }]}>
              {`${tierName(card.tier)}  ${rarityPips(card.tier)}`}
            </Text>
            <Text style={[styles.brand, { color: look.soft }]}>TREAD</Text>
          </View>
        </View>
      </View>
    </CardSurface>
  );
});

/** A meta card at the size of a thumbnail, beside the run cards. */
export function MiniMetaCard({ card, byId, onPress }: {
  card: MetaCard;
  byId: ReadonlyMap<number, ShapeRun>;
  onPress?: () => void;
}) {
  const words = useStrings(metaWords);
  const look = cardLook(card.tier);
  const width = MINI_CARD_WIDTH;
  const inner = width - 20;
  const race = card.raceRunId === null ? undefined : byId.get(card.raceRunId);
  const four = shown(card, byId, 4);
  const large = race ?? (four.length === 1 ? four[0] : undefined);
  const quarter = (inner - 4) / 2;
  const title = metaTitle(card, byId);
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${words.kind[card.kind]}, ${tierName(card.tier)}, ${title}`}
    >
      <CardSurface look={look} seed={seedOf(card)} radius={12} edge={2} style={{ width, height: width * CARD_RATIO }}>
        <View style={styles.mini}>
          <Text style={[styles.miniKind, { color: look.soft }]} numberOfLines={1}>{words.kind[card.kind]}</Text>
          <View style={styles.miniArt}>
            {large ? (
              <RunShape
                runId={large.id}
                track={`${large.startedAt}-${large.endedAt}`}
                ride={large.activity === "ride"}
                size={inner}
                strokeWidth={3}
                tint={{ tile: "transparent", line: look.line, icon: look.soft }}
              />
            ) : (
              <View style={[styles.grid, { width: inner }]}>
                {four.map((run) => (
                  <RunShape
                    key={run.id}
                    runId={run.id}
                    track={`${run.startedAt}-${run.endedAt}`}
                    size={quarter}
                    tint={{ tile: look.tile, line: look.line, icon: look.soft }}
                  />
                ))}
              </View>
            )}
          </View>
          <View style={styles.miniFoot}>
            <Text style={[styles.miniName, { color: look.ink }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.miniTier, { color: look.strong }]} numberOfLines={1}>{tierName(card.tier)}</Text>
          </View>
        </View>
      </CardSurface>
    </PressableScale>
  );
}

const GAP = 8;

const styles = StyleSheet.create({
  card: { width: RUN_CARD_WIDTH, height: RUN_CARD_HEIGHT, alignSelf: "center" },
  art: { position: "absolute", top: ART_TOP, left: 0, right: 0, alignItems: "center" },
  plate: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingTop: 8 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "52%" },
  content: { flex: 1, padding: 16, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  figure: {
    fontSize: 54, lineHeight: 54, fontFamily: font.bold, letterSpacing: -2, fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 18, fontFamily: font.semibold, letterSpacing: 0 },
  corner: {
    marginTop: 6, fontSize: 11.5, lineHeight: 15, fontFamily: font.semibold, letterSpacing: 1.6,
    textTransform: "uppercase", textAlign: "right", fontVariant: ["tabular-nums"],
  },
  foot: { gap: 3 },
  name: { fontSize: 23, fontFamily: font.bold, letterSpacing: -0.4 },
  traits: { fontSize: 13.5, fontFamily: font.semibold, lineHeight: 17, minHeight: 34, marginTop: 2 },
  stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 4 },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statValue: { fontSize: 22, lineHeight: 24, fontFamily: font.semibold, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.9, textTransform: "uppercase" },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  rarity: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1.6, textTransform: "uppercase" },
  brand: { fontSize: 11, fontFamily: font.bold, letterSpacing: 2.4 },

  mini: { flex: 1, padding: 8, justifyContent: "space-between" },
  miniArt: { flex: 1, alignItems: "center", justifyContent: "center" },
  miniKind: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  miniFoot: { gap: 1 },
  miniName: { fontSize: 14, fontFamily: font.bold, letterSpacing: -0.2 },
  miniTier: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase" },
});
