import type { ReactNode } from "react";
import { Figures, type Figure } from "@/components/Figures";

interface Props {
  /** What the figure is about: "Ce mois-ci", "Cette semaine". */
  label: string;
  value: string;
  unit?: string;
  /** The line under the figure; its room is kept even when empty. */
  detail?: string;
  /** The figures that go with the lead one, in glass at its right. */
  figures?: Figure[];
  /** Share of a goal, 0 to 1: a track under everything. */
  progress?: number | null;
  /** Tags, in words: a comparison, an invitation. */
  tags?: ReactNode;
  big?: boolean;
}

/**
 * The one figure a page leads with, on the cobalt stage of the landing page,
 * lit from the top right, the same in both appearances. One per page.
 */
export function SummaryBanner({ label, value, unit, detail, figures, progress, tags, big }: Props) {
  return (
    <section className={`stage${big ? " stage-big" : ""}`}>
      <div className="stage-row">
        <div>
          <div className="stage-label">{label}</div>
          <div className="stage-value">
            {value}
            {unit ? <small>{unit}</small> : null}
          </div>
          <div className="stage-detail">{detail ?? ""}</div>
        </div>
        {figures && figures.length > 0 ? <Figures figures={figures} tone="glass" /> : null}
      </div>
      {tags ? <div className="stage-tags">{tags}</div> : null}
      {progress !== undefined && progress !== null ? (
        <div className="stage-track" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
        </div>
      ) : null}
    </section>
  );
}

export function BannerTag({ children }: { children: ReactNode }) {
  return <span className="stage-tag">{children}</span>;
}
