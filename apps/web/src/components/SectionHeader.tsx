/** A block's heading: bold name left, accent total right. */
export function SectionHeader({ title, aside, sticky, id }: { title: string; aside?: string; sticky?: boolean; id?: string }) {
  return (
    <div className={`section-head${sticky ? " sticky" : ""}`}>
      <h2 id={id}>{title}</h2>
      {aside ? <span className="aside">{aside}</span> : null}
    </div>
  );
}
