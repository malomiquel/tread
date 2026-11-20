"use client";

import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { IoBicycleOutline, IoFootstepsOutline } from "react-icons/io5";
import { contourPaths, fade, foilBands, type Look } from "@tread/core/cardLook";
import { hideEnds } from "@tread/core/privacy";

/**
 * What every card is printed on, on the web as on the phone: a metal edge,
 * the ground, the light from the top right, contour lines engraved from the
 * card's seed, and from rare up a holographic sheen. Its content is laid on
 * top, the sheen over everything. The colours are the phone's
 * (`@tread/core/cardLook`), and follow neither appearance: a card is printed.
 *
 * Held under the pointer (`TiltCard`), the light runs along the edge, the
 * sheen slides and the contours drift under the outline; still otherwise.
 */
export function CardSurface({ look, seed, small = false, style, className, children }: {
  look: Look;
  /** Changes the contour lines, so no two cards are engraved alike. */
  seed: number;
  /** A thumbnail: a thinner edge and a smaller radius. */
  small?: boolean;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  const paths = useMemo(() => contourPaths(seed), [seed]);
  const metal = [...look.metal, ...look.metal.slice(0, -1).reverse()];
  const vars = {
    "--card-page": look.page,
    "--card-ink": look.ink,
    "--card-soft": look.soft,
    "--card-strong": look.strong,
    "--card-lit": look.lit,
    "--card-rule": look.rule,
    "--card-line": look.line,
    "--card-fade": `linear-gradient(to bottom, ${fade(look.page, 0)} 0%, ${fade(look.page, 0.92)} 55%)`,
    backgroundImage: `linear-gradient(135deg, ${metal.join(", ")})`,
    ...style,
  } as CSSProperties;
  const bands = look.foil > 0 ? foilBands(look.foil) : null;
  return (
    <div className={`card-surface${small ? " small" : ""}${className ? ` ${className}` : ""}`} style={vars}>
      <div className="card-ground">
        {look.glow ? (
          <div className="card-glow" style={{ background: `linear-gradient(225deg, ${look.glow[0]} 0%, ${look.glow[1]} 72%)` }} />
        ) : null}
        <svg className="card-contours" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {paths.map((d, index) => <path key={index} d={d} stroke={look.contour} strokeWidth={1.1} fill="none" />)}
        </svg>
        {children}
        {bands ? (
          <div
            className="card-foil"
            style={{
              background: `linear-gradient(100deg, ${bands.colors.map((color, index) => `${color} ${bands.locations[index] * 100}%`).join(", ")})`,
            }}
          />
        ) : null}
        {look.innerFrame ? <div className="card-inner" style={{ borderColor: look.innerFrame }} /> : null}
      </div>
    </div>
  );
}

/** At most this many degrees each way, as the phone leans a card. */
const MAX_TILT = 9;

/**
 * A card held under the pointer: it leans towards it, at most 9°, and its
 * layers move with it through `--lean-x` and `--lean-y`, from −1 to 1.
 * Nothing moves with reduce motion, nor under a finger.
 */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lean = (x: number, y: number) => {
    const node = holder.current;
    if (!node) return;
    node.style.setProperty("--lean-x", x.toFixed(3));
    node.style.setProperty("--lean-y", y.toFixed(3));
    node.style.transform = x === 0 && y === 0
      ? ""
      : `perspective(900px) rotateX(${(y * MAX_TILT).toFixed(2)}deg) rotateY(${(x * MAX_TILT).toFixed(2)}deg)`;
  };
  return (
    <div
      ref={holder}
      className={`tilt${className ? ` ${className}` : ""}`}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || still()) return;
        const box = event.currentTarget.getBoundingClientRect();
        lean(((event.clientX - box.left) / box.width) * 2 - 1, -(((event.clientY - box.top) / box.height) * 2 - 1));
      }}
      onPointerLeave={() => lean(0, 0)}
    >
      {children}
    </div>
  );
}

/**
 * A run's outline as a card draws it: from its sampled shape, its ends
 * trimmed by the runner's privacy radius, centred in a square. With no
 * shape to draw (a treadmill), the outing's icon instead.
 */
export function CardOutline({ shape, size, stroke, hideEndsM = 0, ride = false }: {
  shape: readonly (readonly [number, number])[];
  /** In pixels, or the width of what holds it. */
  size: number | "100%";
  /** In pixels, whatever the size. */
  stroke: number;
  hideEndsM?: number;
  ride?: boolean;
}) {
  const kept = hideEnds(shape.map(([lat, lng]) => ({ lat, lng })), hideEndsM);
  if (kept.length < 2) {
    const Icon = ride ? IoBicycleOutline : IoFootstepsOutline;
    return (
      <span className="card-outline-empty" style={typeof size === "number" ? { width: size } : undefined}>
        <Icon size={typeof size === "number" ? Math.round(size / 4) : 28} aria-hidden />
      </span>
    );
  }
  const box = 100;
  const margin = 8;
  const inner = box - margin * 2;
  const lats = kept.map((point) => point.lat);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const xs = kept.map((point) => point.lng * Math.cos(midLat));
  const minX = Math.min(...xs);
  const maxY = Math.max(...lats);
  const spanX = Math.max(...xs) - minX;
  const spanY = maxY - Math.min(...lats);
  const span = Math.max(spanX, spanY) || 1;
  const offX = margin + ((span - spanX) / span) * inner * 0.5;
  const offY = margin + ((span - spanY) / span) * inner * 0.5;
  const d = kept
    .map((point, index) => {
      const x = offX + ((xs[index] - minX) / span) * inner;
      const y = offY + ((maxY - point.lat) / span) * inner;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className="card-outline" width={size} viewBox={`0 0 ${box} ${box}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--card-line)"
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A stable number to engrave an outing's card from: the minute it started. */
export const outingSeed = (startedAt: number): number => Math.floor(startedAt / 60_000) % 1_000_000;
