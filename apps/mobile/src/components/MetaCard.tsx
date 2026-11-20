import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import { cardLook, LegendaryGround, RUN_CARD_WIDTH } from "@/components/RunCard";
import { RunShape } from "@/components/RunShape";
import { Depth } from "@/components/TiltCard";
import { cardWords } from "@tread/core/card";
import { autoName, formatDistance, formatDuration } from "@tread/core/format";
import { useStrings } from "@tread/core/i18n";
import { metaWords, tierName, type MetaCard } from "@tread/core/metaCard";
import { distanceUnit } from "@tread/core/units";
import type { Run } from "@/lib/db";
import { font } from "@/lib/theme";
import { MINI_CARD_WIDTH } from "@/components/MiniCard";

type ShapeRun = Pick<Run, "id" | "startedAt" | "endedAt" | "name" | "activity">;

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

/**
 * The card a week, a block or a race leaves, at the size of a run's card.
 *
 * A week or a block shows the outlines of its runs, like the cards it is
 * made of laid side by side; a race shows its own outline large, standing
 * off the paper, over the runs that led to it. A race is legendary, on the
 * stage with a second frame; the others wear the frame of their tier.
 */
export const MetaCardView = forwardRef<View, {
  card: MetaCard;
  byId: ReadonlyMap<number, ShapeRun>;
  privacyRadiusM: number;
}>(function MetaCardView({ card, byId, privacyRadiusM }, ref) {
  const words = useStrings(metaWords);
  const cards = useStrings(cardWords);
  const look = cardLook(card.tier);
  const race = card.raceRunId === null ? undefined : byId.get(card.raceRunId);
  const inner = RUN_CARD_WIDTH - 2 * PADDING;
  const strip = shown(card, byId, card.kind === "race" ? 6 : 8);
  const stripSize = (inner - 3 * GAP) / 4;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { backgroundColor: look.page, borderColor: look.frame, borderWidth: look.frameWidth }]}
    >
      {card.tier === "legendary" ? <LegendaryGround /> : null}
      <View style={styles.top}>
        <Text style={[styles.corner, { color: look.soft }]}>
          {`${words.kind[card.kind]} · ${cards.number(card.number)}`}
        </Text>
        <Text style={[styles.corner, { color: look.strong }]}>{tierName(card.tier)}</Text>
      </View>

      {race ? (
        <Depth points={8}>
          <RunShape
            runId={race.id}
            track={`${race.startedAt}-${race.endedAt}`}
            size={inner}
            hideEndsM={privacyRadiusM}
            tint={{ tile: look.tile, line: look.line, icon: look.soft }}
          />
        </Depth>
      ) : null}

      {/* The runs it holds, four to a row; room kept for two rows on a week
          or a block so every one is the same height. */}
      {strip.length > 0 || card.kind !== "race" ? (
        <View style={[styles.strip, card.kind !== "race" && { minHeight: 2 * stripSize + GAP }]}>
          {strip.map((run) => (
            <RunShape
              key={run.id}
              runId={run.id}
              track={`${run.startedAt}-${run.endedAt}`}
              size={card.kind === "race" ? (inner - 5 * GAP) / 6 : stripSize}
              hideEndsM={privacyRadiusM}
              tint={{ tile: look.tile, line: look.line, icon: look.soft }}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.title}>
        <Text style={[styles.name, { color: look.ink }]} numberOfLines={1}>{metaTitle(card, byId)}</Text>
        <Text style={[styles.detail, { color: look.soft }]} numberOfLines={1}>
          {card.kind === "race"
            ? words.prepared(card.runs - 1)
            : `${words.runs(card.runs)} · ${formatDistance(card.distanceM)} ${distanceUnit()} · ${formatDuration(card.durationS)}`}
        </Text>
      </View>

      <Text style={[styles.traits, { color: look.ink }]} numberOfLines={2}>
        {[
          card.rareCards > 0 ? words.rareCards(card.rareCards) : null,
          ...card.traits.slice(0, 4).map((trait) => cards.trait[trait]),
        ].filter(Boolean).join(" · ")}
      </Text>
    </View>
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
  const inner = width - 16;
  const race = card.raceRunId === null ? undefined : byId.get(card.raceRunId);
  const quarter = (inner - 4) / 2;
  const four = shown(card, byId, 4);
  const title = metaTitle(card, byId);
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${words.kind[card.kind]}, ${tierName(card.tier)}, ${title}`}
      style={[styles.mini, { width, backgroundColor: look.page, borderColor: look.frame, borderWidth: look.frameWidth }]}
    >
      {card.tier === "legendary" ? <LegendaryGround radius={9} /> : null}
      <Text style={[styles.miniKind, { color: look.soft }]} numberOfLines={1}>{words.kind[card.kind]}</Text>
      {race ? (
        <RunShape
          runId={race.id}
          track={`${race.startedAt}-${race.endedAt}`}
          size={inner}
          tint={{ tile: look.tile, line: look.line, icon: look.soft }}
        />
      ) : (
        <View style={[styles.grid, { width: inner, height: inner }]}>
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
      <View style={styles.miniFoot}>
        <Text style={[styles.miniName, { color: look.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.miniTier, { color: look.strong }]} numberOfLines={1}>{tierName(card.tier)}</Text>
      </View>
    </PressableScale>
  );
}

const PADDING = 16;
const GAP = 6;

const styles = StyleSheet.create({
  card: { width: RUN_CARD_WIDTH, alignSelf: "center", borderRadius: 16, padding: PADDING, gap: 12, overflow: "hidden" },
  top: { flexDirection: "row", justifyContent: "space-between" },
  corner: {
    fontSize: 11.5, fontFamily: font.semibold, letterSpacing: 1.3, textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  title: { gap: 2 },
  name: { fontSize: 21, fontFamily: font.bold, letterSpacing: -0.3 },
  detail: { fontSize: 14, fontFamily: font.regular, fontVariant: ["tabular-nums"] },
  traits: { fontSize: 15, fontFamily: font.medium, lineHeight: 20, minHeight: 40 },

  mini: { borderRadius: 12, padding: 8, gap: 6, overflow: "hidden" },
  miniKind: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  miniFoot: { gap: 1 },
  miniName: { fontSize: 14.5, fontFamily: font.semibold },
  miniTier: { fontSize: 11, fontFamily: font.semibold, letterSpacing: 1, textTransform: "uppercase" },
});
