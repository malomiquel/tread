import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Panel, PANEL_PADDING } from "@/components/Panel";
import { SectionHeader } from "@/components/SectionHeader";
import { campaignWords, type Campaign, type CampaignNode } from "@tread/core/campaign";
import { useStrings } from "@tread/core/i18n";
import { kindName, type ScheduledSession } from "@tread/core/plan";
import { colors, font } from "@/lib/theme";
import { sessionName } from "@tread/core/workout";

/**
 * A plan read as a campaign: a chapter per phase, each a path of its
 * sessions with its guardians set large on it, then the guardians named
 * underneath, each opening its session.
 *
 * The path is read left to right like the weeks: a filled dot for a session
 * run, a dash for one passed over, a ring for the next, a quiet dot for what
 * is ahead. State is said by shape as well as colour, and in words on the
 * guardians' rows.
 */
export function CampaignMap({ campaign, scheduled, onOpen }: {
  campaign: Campaign;
  scheduled: readonly ScheduledSession[];
  onOpen: (entry: ScheduledSession) => void;
}) {
  const s = useStrings(campaignWords);
  const byOrder = new Map(scheduled.map((entry) => [entry.order, entry]));

  return (
    <View>
      <Text style={styles.lede}>{s.lede}</Text>
      {campaign.chapters.map((chapter) => (
        <View key={chapter.phase}>
          <SectionHeader
            title={s.chapter(chapter.index, chapter.phase)}
            aside={s.guardians(chapter.guardiansWon, chapter.guardians)}
          />
          <Text style={styles.caption}>
            {`${s.weeks(chapter.weekFrom, chapter.weekTo)} · ${s.chapterState[chapter.state]}`}
          </Text>
          <Panel>
            <View
              style={styles.path}
              accessible
              accessibilityLabel={`${s.chapter(chapter.index, chapter.phase)}, ${s.chapterState[chapter.state]}`}
            >
              {chapter.nodes.map((node, i) => (
                <View key={node.order} style={styles.step}>
                  {i > 0 ? <View style={[styles.link, linkDone(node) && styles.linkDone]} /> : null}
                  <Dot node={node} />
                </View>
              ))}
            </View>
            {chapter.nodes.filter((node) => node.guardian).map((node) => {
              const entry = byOrder.get(node.order);
              if (!entry) return null;
              return (
                <Pressable
                  key={node.order}
                  onPress={() => onOpen(entry)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Tile node={node} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>{sessionName(entry.session)}</Text>
                    <Text style={styles.rowDetail} numberOfLines={1}>
                      {`${node.boss ? s.boss : s.guardian} · ${kindName(node.kind)}`}
                    </Text>
                  </View>
                  <Text style={[styles.state, (node.state === "won" || node.state === "next") && styles.stateOn]}>
                    {s.state[node.state]}
                  </Text>
                </Pressable>
              );
            })}
          </Panel>
        </View>
      ))}
    </View>
  );
}

const linkDone = (node: CampaignNode) => node.state === "won" || node.state === "passed" || node.state === "next";

/** One session on the path. A guardian is a tile, the others a dot. */
function Dot({ node }: { node: CampaignNode }) {
  if (node.guardian) return <Tile node={node} small />;
  return (
    <View
      style={[
        styles.dot,
        node.state === "won" && styles.dotWon,
        node.state === "next" && styles.dotNext,
        node.state === "passed" && styles.dotPassed,
      ]}
    >
      {node.state === "passed" ? <View style={styles.dash} /> : null}
    </View>
  );
}

function Tile({ node, small = false }: { node: CampaignNode; small?: boolean }) {
  const won = node.state === "won";
  const icon = node.boss ? (won ? "flag" : "flag-outline") : won ? "shield-checkmark" : node.state === "passed" ? "remove" : "shield-outline";
  return (
    <View
      style={[
        styles.tile,
        small && styles.tileSmall,
        won && styles.tileWon,
        node.state === "next" && styles.tileNext,
      ]}
    >
      <Ionicons name={icon} size={small ? 14 : 18} color={won ? colors.accentText : node.state === "next" ? colors.accent : colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    color: colors.muted, fontSize: 15, fontFamily: font.regular, lineHeight: 20,
    paddingHorizontal: 20, paddingTop: 16, minHeight: 40,
  },
  caption: {
    color: colors.subtle, fontSize: 13.5, fontFamily: font.regular,
    paddingHorizontal: 20, marginTop: -4, marginBottom: 10,
  },
  path: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 10,
    paddingHorizontal: PANEL_PADDING + 6, paddingVertical: 16,
  },
  step: { flexDirection: "row", alignItems: "center" },
  link: { width: 10, height: 2, borderRadius: 1, backgroundColor: colors.hairline },
  linkDone: { backgroundColor: colors.accent },
  dot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: colors.hairline,
    alignItems: "center", justifyContent: "center",
  },
  dotWon: { backgroundColor: colors.accent },
  dotNext: { backgroundColor: colors.background, borderWidth: 2.5, borderColor: colors.accent, width: 16, height: 16, borderRadius: 8 },
  dotPassed: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  dash: { width: 6, height: 1.5, backgroundColor: colors.subtle },
  tile: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.background,
  },
  tileSmall: { width: 28, height: 28, borderRadius: 8 },
  tileWon: { backgroundColor: colors.accent },
  tileNext: { borderWidth: 2, borderColor: colors.accent },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: PANEL_PADDING + 6, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
  },
  pressed: { backgroundColor: colors.hairline },
  rowBody: { flex: 1, gap: 1 },
  rowName: { color: colors.text, fontSize: 16.5, fontFamily: font.semibold },
  rowDetail: { color: colors.subtle, fontSize: 13, fontFamily: font.regular },
  state: { color: colors.subtle, fontSize: 13.5, fontFamily: font.medium },
  stateOn: { color: colors.accent, fontFamily: font.semibold },
});
