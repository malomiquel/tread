import type { ReactNode } from "react";

/** Title and the page's action on one row; the subtitle once there is something to count. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string | null; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle ?? ""}</p>
      </div>
      {action}
    </div>
  );
}
