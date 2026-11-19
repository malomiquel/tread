/**
 * The way into the card stage (`app/card.tsx`): which cards to show, in
 * what order, and whether they arrive face down.
 */

/** One card on the stage: a run's, or a week's, a block's or a race's. */
export type StageItem = { kind: "run"; runId: number } | { kind: "meta"; key: string };

export function readItems(raw: string | undefined): StageItem[] {
  if (!raw) return [];
  return raw.split(",").flatMap((part): StageItem[] => {
    const [kind, value] = part.split(":");
    if (kind === "run" && Number.isInteger(Number(value))) return [{ kind: "run", runId: Number(value) }];
    if (kind === "meta" && value) return [{ kind: "meta", key: value }];
    return [];
  });
}

/**
 * The path that opens cards on the stage, face up, or face down to be
 * turned (`seenThrough`: the run up to which they then count as seen).
 */
export function cardHref(items: readonly StageItem[], reveal?: { seenThrough: number }) {
  return {
    pathname: "/card" as const,
    params: {
      items: items.map((item) => (item.kind === "run" ? `run:${item.runId}` : `meta:${item.key}`)).join(","),
      ...(reveal ? { reveal: "1", seen: String(reveal.seenThrough) } : {}),
    },
  };
}
