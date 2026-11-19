"use client";

import Link from "next/link";
import { formatDate } from "@tread/core/format";
import { RunShape } from "@/components/RunShape";
import { distance, outingName, outingRate, typeChip } from "@/lib/display";
import type { OutingRow as Row } from "@/lib/types";

/** One outing in a list: its outline, its name and day, its distance and pace. */
export function OutingRow({ outing }: { outing: Row }) {
  const far = distance(outing.distanceM);
  const rate = outingRate(outing);
  const chip = typeChip(outing.activity);
  return (
    <Link href={`/outings/${outing.id}`} className="row">
      <span className="tile"><RunShape shape={outing.shape} /></span>
      <span className="row-main">
        <span className="row-name" style={{ display: "block" }}>
          {outingName(outing)}
          {chip ? <span className="tag">{chip}</span> : null}
        </span>
        <span className="row-detail" style={{ display: "block" }}>{formatDate(outing.startedAt)}</span>
      </span>
      <span className="row-figures">
        <strong>{far.value}</strong><span className="unit">{far.unit}</span>
        <span className="row-detail num" style={{ display: "block" }}>{rate.value} {rate.unit}</span>
      </span>
    </Link>
  );
}
