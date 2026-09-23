import { useState } from "react";
import { StyleSheet, Text, useColorScheme, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ChartPoint } from "@/lib/charts";
import { colors, font, literalColors } from "@/lib/theme";

interface Props {
  points: ChartPoint[];
  /** How a value is written on the scale: a pace, a heart rate. */
  format: (value: number) => string;
  /** Draw lower values higher up — for a pace, where less is faster. */
  invert?: boolean;
  /** The unit after the scale's figures. */
  unit?: string;
}

const HEIGHT = 96;
/** Air above and below the line, so its extremes are not cut by the frame. */
const PAD = 6;

/**
 * A series drawn as a line over a soft fill, with its two extremes named.
 *
 * Only the best and the worst are labelled — the fastest and slowest pace,
 * the highest and lowest heart rate — because those are the two figures
 * anybody reads off a chart like this; a full axis would be noise at this
 * size.
 */
export function LineChart({ points, format, invert = false, unit }: Props) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [width, setWidth] = useState(0);

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(1e-6, high - low);
  const first = points[0]?.distanceM ?? 0;
  const span = Math.max(1, (points[points.length - 1]?.distanceM ?? 1) - first);

  const x = (distanceM: number) => ((distanceM - first) / span) * width;
  const y = (value: number) => {
    const share = (value - low) / spread;
    const up = invert ? 1 - share : share;
    return PAD + (1 - up) * (HEIGHT - PAD * 2);
  };

  const line = points
    .map((point, i) => `${i === 0 ? "M" : "L"}${x(point.distanceM).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width.toFixed(1)},${HEIGHT} L0,${HEIGHT} Z`;

  // The top of the chart is the better figure for a pace, the higher one for
  // anything else.
  const top = invert ? low : high;
  const bottom = invert ? high : low;
  const suffix = unit ? ` ${unit}` : "";

  return (
    <View style={styles.row}>
      <View style={styles.plot} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && points.length > 1 ? (
          <Svg width={width} height={HEIGHT}>
            <Path d={area} fill={literalColors.track[scheme]} fillOpacity={0.12} />
            <Path
              d={line}
              stroke={literalColors.track[scheme]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        ) : null}
      </View>
      <View style={styles.scale}>
        <Text style={styles.mark}>{format(top)}{suffix}</Text>
        <Text style={styles.mark}>{format(bottom)}{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  plot: { flex: 1, height: HEIGHT, borderRadius: 8, overflow: "hidden", backgroundColor: colors.sunken },
  scale: { justifyContent: "space-between", paddingVertical: 2 },
  mark: {
    color: colors.subtle, fontSize: 12.5, fontFamily: font.medium,
    fontVariant: ["tabular-nums"], textAlign: "right",
  },
});
