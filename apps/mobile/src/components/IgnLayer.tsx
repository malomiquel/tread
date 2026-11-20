import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { UrlTile, type Region } from "react-native-maps";
import Animated from "react-native-reanimated";
import { defineStrings, useStrings } from "@tread/core/i18n";
import { ignCovers } from "@tread/core/tiles";
import { IGN_MAX_ZOOM, IGN_TILE_URL, tileCachePath, useOnline } from "@/lib/offlineMap";
import { useSettings } from "@/lib/settings";
import { colors, floatingShadow, font } from "@/lib/theme";

const ignStrings = defineStrings({
  fr: {
    credit: "© IGN",
    outside: "Carte IGN : France seulement",
    creditLabel: "Carte de l'IGN, l'Institut national de l'information géographique",
  },
  en: {
    credit: "© IGN",
    outside: "IGN map: France only",
    creditLabel: "Map by IGN, the French national mapping agency",
  },
});

/**
 * Whether the middle of the map is somewhere IGN draws.
 *
 * Followed as the map moves rather than worked out once: the record screen
 * follows a runner who may well cross into Italy, and a route can be panned
 * anywhere. Only the yes or no is kept, so the screen redraws when it flips
 * and not on every move.
 */
export function useIgnCoverage(start: { lat: number; lng: number } | null) {
  const [covered, setCovered] = useState(() => (start ? ignCovers(start.lat, start.lng) : true));
  const onRegionChangeComplete = useCallback((region: Region) => {
    setCovered(ignCovers(region.latitude, region.longitude));
  }, []);
  return { covered, onRegionChangeComplete };
}

/** Whether the IGN map is the chosen one. */
export function useIgnChosen(): boolean {
  return useSettings().mapBackground === "ign";
}

/**
 * The IGN topo map, drawn over the platform's own, for a child of MapView.
 *
 * Over it rather than instead of it: where a tile is missing — offline,
 * outside a downloaded area — the street map still shows through. Outside
 * France it is not drawn at all, because there the server only answers
 * "not found" and the platform's map is the better one.
 *
 * Tiles are cached where downloads put them. No maximum age: on iOS a
 * refreshed tile is written without looking at the answer's status, so an
 * error page could replace a good tile on the eve of a run without network.
 * Deleting and downloading an area again is how a map is renewed.
 */
export function IgnTiles({ covered }: { covered: boolean }) {
  const chosen = useIgnChosen();
  const online = useOnline();
  if (!chosen || !covered) return null;
  return (
    <UrlTile
      urlTemplate={IGN_TILE_URL}
      tileCachePath={tileCachePath()}
      // Offline, the map reads only the disk, and where a zoom is missing it
      // enlarges a coarser tile rather than leaving a hole.
      offlineMode={!online}
      maximumZ={IGN_MAX_ZOOM}
      tileSize={256}
      // Android: under the track. iOS keeps tiles under every other overlay.
      zIndex={-1}
    />
  );
}

interface CreditProps {
  covered: boolean;
  style?: React.ComponentProps<typeof Animated.View>["style"];
}

/**
 * Who drew the map, while IGN's map is the one shown; and, outside France,
 * why it is not.
 *
 * The credit is the licence's one condition. The notice replaces an empty
 * map that would otherwise look broken.
 */
export function IgnCredit({ covered, style }: CreditProps) {
  const s = useStrings(ignStrings);
  const chosen = useIgnChosen();
  if (!chosen) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.credit, style]}>
      <View style={styles.pill}>
        <Text
          style={[styles.text, !covered && styles.notice]}
          accessibilityLabel={covered ? s.creditLabel : undefined}
        >
          {covered ? s.credit : s.outside}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  credit: { position: "absolute", left: 12 },
  pill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: colors.background, ...floatingShadow,
  },
  text: { color: colors.muted, fontSize: 12, fontFamily: font.medium },
  notice: { color: colors.text, fontSize: 13 },
});
