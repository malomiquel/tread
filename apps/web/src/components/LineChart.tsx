"use client";

import { useId } from "react";
import { formatDistance } from "@tread/core/format";
import { distanceUnit } from "@tread/core/units";

interface Point {
  distanceM: number;
  value: number;
}

interface Props {
  series: readonly Point[];
  /** How a value reads, with its unit. */
  format: (value: number) => string;
  /** Pace: lower is better, so it is drawn upside down, fast at the top. */
  invert?: boolean;
  /** "Min", "Max" in words for the two extremes named under the chart. */
  lowLabel: string;
  highLabel: string;
  label: string;
}

const WIDTH = 600;
const HEIGHT = 150;

/** A series against distance: a line over a soft fill, the two extremes named. */
export function LineChart({ series, format, invert, lowLabel, highLabel, label }: Props) {
  const fill = useId();
  if (series.length < 2) return null;
  const values = series.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const end = series[series.length - 1].distanceM || 1;
  const x = (d: number) => (d / end) * WIDTH;
  const y = (v: number) => {
    const share = (v - low) / span;
    return 8 + (invert ? share : 1 - share) * (HEIGHT - 16);
  };
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(p.distanceM).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <defs>
          <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${fill})`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="chart-caption">
        <span>{lowLabel} {format(invert ? high : low)}</span>
        <span>{formatDistance(end)} {distanceUnit()}</span>
        <span>{highLabel} {format(invert ? low : high)}</span>
      </figcaption>
    </figure>
  );
}
