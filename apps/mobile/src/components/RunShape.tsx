import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { runShape } from "@/lib/db";
import { hideEnds } from "@tread/core/privacy";
import { thumbnail } from "@tread/core/route";
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
  /** Metres trimmed from each end, for a shape that is going to be shared. */
  hideEndsM?: number;
  /**
   * Fixed colours, for a shape drawn on a picture rather than on the page:
   * a picture has no dark mode.
   */
  tint?: { tile: string; line: string; icon: string };
  /** A thicker line for a shape drawn large, as the art of a card. */
  strokeWidth?: number;
}

/**
 * The outline of a run, drawn small — the loop by the river, the out-and-back
 * up the hill — so a history can be read by shape as well as by number.
 *
 * Loaded only when the row is on screen, from a sample of the track. A run
 * with no GPS points, or one still loading, shows a running figure instead of
 * an empty square.
 */
export function RunShape({ runId, track, ride = false, size = 56, hideEndsM = 0, tint, strokeWidth = 2.4 }: Props) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const inner = size - Math.max(12, strokeWidth * 4);
  const key = `${runId}:${track}:${size}:${hideEndsM}:${strokeWidth}`;
  const [loaded, setLoaded] = useState<{ key: string; shape: { x: number; y: number }[] } | null>(null);
  const cached = shapes.get(key);
  const shape = cached ?? (loaded?.key === key ? loaded.shape : null);

  useEffect(() => {
    if (shapes.has(key)) return;
    let active = true;
    void runShape(runId)
      .then((points) => {
        const drawn = thumbnail(hideEnds(points, hideEndsM), inner, Math.max(3, strokeWidth));
        shapes.set(key, drawn);
        if (active) setLoaded({ key, shape: drawn });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [key, runId, inner, hideEndsM, strokeWidth]);

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.min(size * 0.28, 16) },
        tint && { backgroundColor: tint.tile },
      ]}
    >
      {shape && shape.length > 1 ? (
        <Svg width={inner} height={inner}>
          <Polyline
            points={shape.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
            stroke={tint?.line ?? literalColors.track[scheme]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        <Ionicons name={ride ? "bicycle" : "walk"} size={Math.min(size * 0.42, 40)} color={tint?.icon ?? colors.subtle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", backgroundColor: colors.sunken },
});
