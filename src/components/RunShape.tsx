import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { runShape } from "@/lib/db";
import { thumbnail } from "@/lib/route";
import { colors, literalColors } from "@/lib/theme";

/**
 * Shapes already read, by run id and track.
 *
 * Not by id alone: SQLite hands a deleted run's id to the next one saved,
 * and an edit trims a run's track, so the same id can draw two different
 * shapes. Scrolling back up the history draws from here instead of asking
 * the database again.
 */
const shapes = new Map<string, { x: number; y: number }[]>();

interface Props {
  runId: number;
  /** Changes whenever the track does: the run's start and end. */
  track: string;
  /** A ride, shown by a bicycle while it has no shape to draw. */
  ride?: boolean;
  size?: number;
}

/**
 * The outline of a run, drawn small — the loop by the river, the out-and-back
 * up the hill — so a history can be read by shape as well as by number.
 *
 * Loaded only when the row is on screen, from a sample of the track. A run
 * with no GPS points, or one still loading, shows a running figure instead of
 * an empty square.
 */
export function RunShape({ runId, track, ride = false, size = 56 }: Props) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const inner = size - 12;
  const key = `${runId}:${track}`;
  const [loaded, setLoaded] = useState<{ key: string; shape: { x: number; y: number }[] } | null>(null);
  const cached = shapes.get(key);
  const shape = cached ?? (loaded?.key === key ? loaded.shape : null);

  useEffect(() => {
    if (shapes.has(key)) return;
    let active = true;
    void runShape(runId)
      .then((points) => {
        const drawn = thumbnail(points, inner, 3);
        shapes.set(key, drawn);
        if (active) setLoaded({ key, shape: drawn });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [key, runId, inner]);

  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28 }]}>
      {shape && shape.length > 1 ? (
        <Svg width={inner} height={inner}>
          <Polyline
            points={shape.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
            stroke={literalColors.track[scheme]}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        <Ionicons name={ride ? "bicycle" : "walk"} size={size * 0.42} color={colors.subtle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", backgroundColor: colors.sunken },
});
