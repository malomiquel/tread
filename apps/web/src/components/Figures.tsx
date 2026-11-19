export interface Figure {
  value: string;
  unit?: string;
  label: string;
}

/**
 * A row of figures split by rules: value large, unit small beside it, label
 * in capitals under it. `glass` on the stage, `page` on a panel. Two to a row
 * past two figures at a phone's width.
 */
export function Figures({ figures, tone }: { figures: Figure[]; tone: "glass" | "page" | "stage" }) {
  const toneClass = tone === "glass" ? " glass" : tone === "stage" ? " on-stage" : "";
  return (
    <dl className={`figures${toneClass}${figures.length > 2 ? " wrap" : ""}`} style={{ margin: 0 }}>
      {figures.map((figure) => (
        <div className="figure" key={figure.label}>
          <dd className="figure-value" style={{ margin: 0 }}>
            {figure.value}
            {figure.unit ? <small>{figure.unit}</small> : null}
          </dd>
          <dt className="figure-label">{figure.label}</dt>
        </div>
      ))}
    </dl>
  );
}
