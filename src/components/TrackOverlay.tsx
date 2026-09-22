import { useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { cardRegion, CARD_HEIGHT, CARD_WIDTH } from "@/components/ShareCard";
import { projectPoint, type TrackPoint } from "@/lib/geo";
import { buildReplay, drawnSoFar, headAt } from "@/lib/replay";
import { literalColors } from "@/lib/theme";

/**
 * How many points the shared animation is drawn from.
 *
 * Fewer than the screen's replay uses. This one is redrawn as vectors inside
 * a view that is then photographed, frame by frame, rather than handed to a
 * map — and at the card's size, four hundred points already put several of
 * them on every pixel of the route.
 */
const DRAWN_POINTS = 400;

/** Matches the weight the card's own map draws its track at. */
const STROKE = 2.5;

/**
 * The run's line, drawn over a photograph of a map that has none.
 *
 * This is the half of the share animation that moves. The map underneath is
 * one fixed picture taken once — asking for a fresh one per frame would be
 * forty native renders — so everything that changes between frames happens
 * here, in vectors, over the top of it.
 */
export function TrackOverlay({ points, progress }: { points: TrackPoint[]; progress: number }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const region = useMemo(() => cardRegion(points), [points]);
  const replay = useMemo(() => buildReplay(points, DRAWN_POINTS), [points]);

  if (!region || !replay) return null;

  const head = headAt(replay, progress);
  const at = (point: { lat: number; lng: number }) =>
    projectPoint(region, point, CARD_WIDTH, CARD_HEIGHT);

  return (
    <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
      {drawnSoFar(replay, head).map((leg) => (
        <Polyline
          key={leg[0].ts}
          points={leg.map((point) => {
            const { x, y } = at(point);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ")}
          stroke={literalColors.track[scheme]}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}

      {/* Only while it is moving. On the finished frame the dot would read as
          a marker somebody dropped rather than as a runner. */}
      {progress > 0 && progress < 1 ? (
        <Circle
          cx={at(head).x}
          cy={at(head).y}
          r={4}
          fill="#ffffff"
          stroke={literalColors.track[scheme]}
          strokeWidth={2}
        />
      ) : null}
    </Svg>
  );
}
