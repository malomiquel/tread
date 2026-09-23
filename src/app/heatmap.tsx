import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Segmented } from "@/components/Segmented";
import { allShapes } from "@/lib/db";
import { denseRegion, tracksOf, type LatLng } from "@/lib/heatmap";
import { defineStrings, plural, useStrings } from "@/lib/i18n";
import { colors, floatingShadow, font, literalColors } from "@/lib/theme";

const strings = defineStrings({
  fr: {
    all: "Tout",
    year: "Cette année",
    count: (runs: number) => plural(runs, "course", "courses"),
    empty: "Aucune course avec un tracé GPS pour l'instant.",
  },
  en: {
    all: "All",
    year: "This year",
    count: (runs: number) => plural(runs, "run", "runs"),
    empty: "No runs with a GPS track yet.",
  },
});

type Span = "all" | "year";

/** "#00348f" with an alpha, as the map's lines want it. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/**
 * Every run on one map. The streets run most often come out darkest, simply
 * because their lines are laid over one another most often.
 */
export default function HeatmapScreen() {
  const s = useStrings(strings);
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const insets = useSafeAreaInsets();
  const [span, setSpan] = useState<Span>("all");
  const [tracks, setTracks] = useState<LatLng[][] | null>(null);

  useEffect(() => {
    let active = true;
    const since = span === "year" ? new Date(new Date().getFullYear(), 0, 1).getTime() : 0;
    void allShapes(since)
      .then((rows) => {
        if (active) setTracks(tracksOf(rows));
      })
      .catch(() => {
        if (active) setTracks([]);
      });
    return () => { active = false; };
  }, [span]);

  if (tracks === null) {
    return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;
  }

  const region = denseRegion(tracks);
  // Fainter in the dark: light lines on a dark map saturate much sooner.
  const ink = withAlpha(literalColors.track[scheme], scheme === "dark" ? 0.3 : 0.22);

  return (
    <View style={styles.screen}>
      {region ? (
        <MapView
          // Remounted per span, so the camera frames the runs being shown.
          key={span}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          userInterfaceStyle={scheme}
          showsCompass={false}
          pitchEnabled={false}
        >
          {tracks.map((track, index) => (
            <Polyline
              key={index}
              coordinates={track.map((point) => ({ latitude: point.lat, longitude: point.lng }))}
              strokeColor={ink}
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.centered}><Text style={styles.empty}>{s.empty}</Text></View>
      )}

      <View style={[styles.bar, { bottom: insets.bottom + 16 }]}>
        <Segmented
          options={[{ value: "all", label: s.all }, { value: "year", label: s.year }]}
          value={span}
          onChange={setSpan}
        />
        <Text style={styles.count}>{s.count(tracks.length)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
  empty: { color: colors.muted, fontSize: 15, fontFamily: font.regular, textAlign: "center" },
  bar: {
    position: "absolute", left: 16, right: 16, gap: 8, padding: 10, borderRadius: 16,
    backgroundColor: colors.background, ...floatingShadow,
  },
  count: { color: colors.subtle, fontSize: 13.5, fontFamily: font.medium, textAlign: "center" },
});
