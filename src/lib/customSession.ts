import { decimal } from "./i18n.ts";
import { effortName, type Effort, type Session, type Step } from "./workout.ts";

/**
 * Sessions the runner writes themselves.
 *
 * Written as the runner thinks of them — a warm-up, then five times four
 * hundred fast and two hundred easy, then a cool-down — rather than as the
 * flat list of blocks the tracker follows. So a session is kept as groups,
 * each repeated some number of times, and only unrolled into steps when it
 * is run. Editing "five times" into "six times" is then one tap, not two new
 * blocks copied by hand.
 */

export type Measure = "metres" | "seconds";

export interface DraftBlock {
  effort: Effort;
  measure: Measure;
  /** Metres or seconds, depending on the measure. */
  value: number;
}

export interface DraftGroup {
  /** How many times the blocks are run in a row, from 1. */
  times: number;
  blocks: DraftBlock[];
}

export interface CustomSession {
  id: number;
  /** As the runner typed it, or empty for a name worked out from the blocks. */
  name: string;
  groups: DraftGroup[];
}

export const EFFORTS: readonly Effort[] = ["warmup", "fast", "recovery", "steady", "cooldown"];

export const MAX_TIMES = 30;
const MIN_METRES = 100;
const MAX_METRES = 42_000;
const MIN_SECONDS = 15;
const MAX_SECONDS = 3 * 3600;

/** The id a custom session runs under, beside the catalogue's "400" or "easy". */
export const customSessionId = (id: number): string => `custom-${id}`;

/** The stored id behind a session id, or null for any other session. */
export function customIdOf(sessionId: string | null): number | null {
  const match = sessionId?.match(/^custom-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** What a new session starts as: the shape most interval sessions take. */
export function starterGroups(): DraftGroup[] {
  return [
    { times: 1, blocks: [{ effort: "warmup", measure: "seconds", value: 600 }] },
    {
      times: 5,
      blocks: [
        { effort: "fast", measure: "metres", value: 400 },
        { effort: "recovery", measure: "metres", value: 200 },
      ],
    },
    { times: 1, blocks: [{ effort: "cooldown", measure: "seconds", value: 300 }] },
  ];
}

/** The groups unrolled into the flat list of blocks the tracker follows. */
export function expand(groups: readonly DraftGroup[]): Step[] {
  return groups.flatMap((group) =>
    Array.from({ length: Math.max(1, group.times) }, () =>
      group.blocks.map((block): Step => (block.measure === "metres"
        ? { effort: block.effort, metres: block.value }
        : { effort: block.effort, seconds: block.value }))).flat());
}

/** How a block's measure reads: "400 m", "1,5 km", "45 s", "10 min", "2 min 30". */
export function measureLabel(block: Pick<DraftBlock, "measure" | "value">): string {
  if (block.measure === "metres") {
    return block.value >= 1000 ? `${decimal(String(block.value / 1000))} km` : `${block.value} m`;
  }
  if (block.value < 60) return `${block.value} s`;
  const minutes = Math.floor(block.value / 60);
  const seconds = block.value % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${String(seconds).padStart(2, "0")}`;
}

/**
 * A name from the blocks, for a session nobody named: the repeated part if
 * there is one ("5 × 400 m rapide"), otherwise the first real effort.
 */
export function defaultName(groups: readonly DraftGroup[]): string {
  const repeated = groups.find((group) => group.times > 1 && group.blocks.length > 0);
  if (repeated) {
    const main = repeated.blocks[0];
    return `${repeated.times} × ${measureLabel(main)} ${effortName(main.effort)}`;
  }
  const blocks = groups.flatMap((group) => group.blocks);
  const main = blocks.find((block) => block.effort === "fast" || block.effort === "steady") ?? blocks[0];
  return main ? `${measureLabel(main)} ${effortName(main.effort)}` : "";
}

/** The session the tracker runs. */
export function toSession(custom: CustomSession): Session {
  return {
    id: customSessionId(custom.id),
    name: custom.name.trim() || defaultName(custom.groups),
    steps: expand(custom.groups),
  };
}

/**
 * One step up or down, in steps that fit the size: a hundred metres at a
 * time on the track, five hundred beyond a kilometre; fifteen seconds for a
 * short repetition, a minute for a long block.
 */
export function nudge(value: number, measure: Measure, direction: 1 | -1): number {
  const size = direction > 0 ? value : value - 1;
  if (measure === "metres") {
    const step = size < 1000 ? 100 : 500;
    return Math.min(MAX_METRES, Math.max(MIN_METRES, value + direction * step));
  }
  const step = size < 120 ? 15 : size < 600 ? 30 : 60;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, value + direction * step));
}

/**
 * The same block measured the other way, at five minutes a kilometre —
 * the figure `sessionMinutes` already assumes — rounded to a step that
 * `nudge` would land on.
 */
export function switchMeasure(block: DraftBlock): DraftBlock {
  if (block.measure === "metres") {
    const seconds = Math.round((block.value / 1000) * 300 / 30) * 30;
    return { ...block, measure: "seconds", value: Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds)) };
  }
  const metres = Math.round((block.value / 300) * 1000 / 100) * 100;
  return { ...block, measure: "metres", value: Math.min(MAX_METRES, Math.max(MIN_METRES, metres)) };
}

/** Stored groups, or null for anything unreadable. */
export function parseGroups(raw: string | null): DraftGroup[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const groups = parsed.flatMap((group): DraftGroup[] => {
      if (!group || typeof group !== "object") return [];
      const { times, blocks } = group as Partial<DraftGroup>;
      if (typeof times !== "number" || !Array.isArray(blocks)) return [];
      const kept = blocks.filter((block): block is DraftBlock =>
        !!block && EFFORTS.includes(block.effort)
        && (block.measure === "metres" || block.measure === "seconds")
        && typeof block.value === "number" && block.value > 0);
      return kept.length ? [{ times: Math.min(MAX_TIMES, Math.max(1, Math.round(times))), blocks: kept }] : [];
    });
    return groups.length ? groups : null;
  } catch {
    return null;
  }
}
