import type { ReactNode } from "react";
import Link from "next/link";
import { IoChevronForward } from "react-icons/io5";

interface Props {
  icon: ReactNode;
  name: string;
  detail?: string;
  value: string;
  unit?: string;
  href?: string;
}

/** A figure worth keeping: tile, name and detail, figure right; a chevron when it leads somewhere. */
export function RecordRow({ icon, name, detail, value, unit, href }: Props) {
  const body = (
    <>
      <span className="tile" aria-hidden>{icon}</span>
      <span className="row-main">
        <span className="row-name" style={{ display: "block" }}>{name}</span>
        <span className="row-detail" style={{ display: "block" }}>{detail ?? " "}</span>
      </span>
      <span className="row-figures">
        <strong>{value}</strong>
        {unit ? <span className="unit">{unit}</span> : null}
      </span>
      {href ? <IoChevronForward className="chevron" aria-hidden /> : null}
    </>
  );
  return href ? <Link href={href} className="row">{body}</Link> : <div className="row">{body}</div>;
}
